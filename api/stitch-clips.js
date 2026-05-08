// Stitch endpoint — combines a list of clip URLs into a single mp4 via ComfyUI.
// Input: { clip_urls: string[], transition_seconds?: number, frame_rate?: number }
// Output: { taskId, provider: 'local-comfy' } — poll via /api/video-status/<id>?provider=local-comfy
//
// The clip_urls must be ComfyUI /view URLs (same LOCAL_COMFY_URL host) — these
// are exactly what the local-comfy provider returns from its videoUrl field.
// We extract the filename from the URL and pass it to the stitch workflow,
// which uses VHS_LoadVideoPath to read from ComfyUI's output/ directory.

import { getWorkflow } from './_lib/comfy-workflows/index.js';

const TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

function extractFilename(viewUrl, base) {
    try {
        const u = new URL(viewUrl);
        // Reject URLs from a different host — would mean the clip wasn't
        // produced by our local ComfyUI and can't be referenced by filename.
        if (base) {
            const baseHost = new URL(base).host;
            if (u.host !== baseHost) return null;
        }
        return u.searchParams.get('filename');
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const base = process.env.LOCAL_COMFY_URL?.replace(/\/+$/, '');
    if (!base) {
        res.status(503).json({ error: 'LOCAL_COMFY_URL not configured (stitching requires self-host backend)' });
        return;
    }

    const { clip_urls, transition_seconds = 0.4, frame_rate = 16 } = req.body || {};
    if (!Array.isArray(clip_urls) || clip_urls.length < 1) {
        res.status(400).json({ error: 'clip_urls must be a non-empty array' });
        return;
    }
    if (clip_urls.length > 20) {
        res.status(400).json({ error: 'too many clips (max 20)' });
        return;
    }

    const filenames = [];
    for (const url of clip_urls) {
        const fname = extractFilename(url, base);
        if (!fname) {
            res.status(400).json({ error: `clip_urls must be ComfyUI /view URLs from ${base}; got: ${url.slice(0, 80)}` });
            return;
        }
        filenames.push(fname);
    }

    const wf = getWorkflow('stitch');
    if (!wf) {
        res.status(500).json({ error: 'stitch workflow missing' });
        return;
    }

    let body;
    try {
        body = wf.buildPrompt({ clip_filenames: filenames, transition_seconds, frame_rate });
    } catch (e) {
        res.status(500).json({ error: e.message || 'failed to build stitch workflow' });
        return;
    }

    try {
        const r = await fetchWithTimeout(`${base}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            res.status(r.status).json({ error: data?.error?.message || `ComfyUI submit failed (${r.status})` });
            return;
        }
        if (!data.prompt_id) {
            res.status(502).json({ error: 'ComfyUI did not return prompt_id' });
            return;
        }
        res.status(200).json({ taskId: data.prompt_id, provider: 'local-comfy', clipCount: filenames.length });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Unknown error' });
    }
}
