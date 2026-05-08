const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function listModels() {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
    const data = await res.json();
    return data.models || [];
}

export async function optimizePrompt(rawPrompt) {
    const res = await fetch(`${API_BASE}/optimize-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rawPrompt }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Prompt optimization failed: ${res.status}`);
    }
    const data = await res.json();
    return data.optimizedPrompt || rawPrompt;
}

/**
 * Trigger video generation via the chosen model.
 * @param {string} prompt
 * @param {{
 *   modelId: string,
 *   duration?: number,
 *   resolution?: string,
 *   aspect_ratio?: string,
 *   image_url?: string,   // data URI or http(s) URL — required for I2V models
 *   seed?: number,
 * }} options
 * @returns {Promise<{ taskId: string, modelId: string, provider: string }>}
 */
export async function generateVideo(prompt, options = {}) {
    const { modelId, duration, resolution, aspect_ratio = '16:9', image_url, seed } = options;
    if (!modelId) throw new Error('modelId is required');

    const body = { modelId, prompt, duration, aspect_ratio };
    if (resolution) body.resolution = resolution;
    if (image_url) body.image_url = image_url;
    if (typeof seed === 'number') body.seed = seed;

    const res = await fetch(`${API_BASE}/video-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Video generation failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.taskId) throw new Error('Server did not return a taskId.');
    return { taskId: data.taskId, modelId: data.modelId, provider: data.provider };
}

/**
 * Trigger stitching of N clip URLs into a single mp4 via ComfyUI.
 * @param {{ clip_urls: string[], transition_seconds?: number, frame_rate?: number }} opts
 * @returns {Promise<{ taskId: string, provider: string }>}
 */
export async function stitchClips(opts) {
    const res = await fetch(`${API_BASE}/stitch-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Stitch failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Plan a multi-shot ad storyboard from a brief.
 * @param {{ brief: string, totalDuration?: number, shotCount?: number, brand?: string, style?: string }} opts
 * @returns {Promise<{ shots: Array<{ i:number, duration:number, shot_type:string, prompt:string, use_prev_frame:boolean, notes:string }> }>}
 */
export async function planShots(opts) {
    const res = await fetch(`${API_BASE}/plan-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Shot planning failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Extract the last frame of a video as a JPEG data URI.
 * Used to feed clip N's last frame into clip N+1's I2V input for continuity.
 * @param {string} videoUrl
 * @returns {Promise<string>} data URI (image/jpeg;base64,...)
 */
export async function extractLastFrame(videoUrl) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';
        video.src = videoUrl;

        const cleanup = () => {
            video.removeAttribute('src');
            video.load();
        };

        video.addEventListener('loadedmetadata', () => {
            // Seek to a tick before the end — exactly duration sometimes returns black
            const target = Math.max(0, video.duration - 0.05);
            video.currentTime = target;
        }, { once: true });

        video.addEventListener('seeked', () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                cleanup();
                resolve(dataUrl);
            } catch (e) {
                cleanup();
                reject(new Error(`Frame extraction failed (likely CORS on ${new URL(videoUrl).host}): ${e.message}`));
            }
        }, { once: true });

        video.addEventListener('error', () => {
            cleanup();
            reject(new Error('Video load failed for frame extraction'));
        }, { once: true });

        // Safety timeout
        setTimeout(() => {
            cleanup();
            reject(new Error('Frame extraction timed out'));
        }, 30_000);
    });
}

/**
 * Run a full multi-shot ad: shot-by-shot generation + I2V chaining.
 * Each shot beyond the first uses the previous shot's last frame as start_image.
 * @param {{
 *   shots: Array<{ i:number, duration:number, prompt:string, use_prev_frame:boolean }>,
 *   t2vModelId: string,
 *   i2vModelId: string,
 *   onProgress?: (state: { shot: number, status: string, videoUrl?: string, error?: string }) => void,
 * }} opts
 * @returns {Promise<{ clips: string[] }>} array of clip videoUrls in order
 */
export async function generateAdSequence({ shots, t2vModelId, i2vModelId, onProgress }) {
    const clips = [];
    const report = (state) => onProgress && onProgress(state);

    for (let idx = 0; idx < shots.length; idx++) {
        const shot = shots[idx];
        report({ shot: shot.i, status: 'generating' });

        const useI2V = idx > 0 && shot.use_prev_frame;
        const modelId = useI2V ? i2vModelId : t2vModelId;
        let imageUrl;
        if (useI2V) {
            report({ shot: shot.i, status: 'extracting-frame' });
            try {
                imageUrl = await extractLastFrame(clips[idx - 1]);
            } catch (e) {
                report({ shot: shot.i, status: 'error', error: e.message });
                throw e;
            }
        }

        const submission = await generateVideo(shot.prompt, {
            modelId,
            duration: shot.duration,
            image_url: imageUrl,
        });

        const url = await new Promise((resolve, reject) => {
            pollVideoStatus(submission.taskId, submission.provider, submission.modelId, (update) => {
                if (update.status === 'complete') resolve(update.videoUrl);
                else if (update.status === 'error') reject(new Error(update.error || 'shot generation failed'));
                else report({ shot: shot.i, status: update.status });
            });
        });

        clips.push(url);
        report({ shot: shot.i, status: 'complete', videoUrl: url });
    }

    return { clips };
}

export async function checkVideoStatus(taskId, provider, modelId) {
    const params = new URLSearchParams({ provider });
    if (modelId) params.set('modelId', modelId);
    const res = await fetch(`${API_BASE}/video-status/${encodeURIComponent(taskId)}?${params}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Status check failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Poll for video status at regular intervals until complete or error.
 * Returns a cleanup function that cancels polling.
 */
export function pollVideoStatus(taskId, provider, modelId, onUpdate, intervalMs = 5000) {
    let timer = null;
    let attempts = 0;
    const maxAttempts = 120;

    const poll = async () => {
        attempts++;
        try {
            const result = await checkVideoStatus(taskId, provider, modelId);
            onUpdate(result);
            if (result.status === 'complete' || result.status === 'error') {
                if (timer) clearInterval(timer);
            }
        } catch (err) {
            console.error('Polling error:', err);
        }
        if (attempts >= maxAttempts) {
            onUpdate({ status: 'error', error: 'Operation timed out.' });
            if (timer) clearInterval(timer);
        }
    };

    timer = setInterval(poll, intervalMs);
    poll();

    return () => {
        if (timer) clearInterval(timer);
    };
}

export async function publishToYouTube() {
    throw new Error('YouTube publish not yet wired. Coming in a later iteration.');
}
