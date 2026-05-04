// Provider adapters — translate our normalized request/status into each provider's wire format.
// Each adapter exposes: submit(model, params) -> { taskId } and status(taskId, model) -> normalized.
//
// Resilience strategy (cost-aware — paid Pro models, no waste):
//   - SUBMIT: single attempt, no retry. Duplicate submits = duplicate billing.
//     Caller (frontend) sees the upstream error and decides whether to retry.
//   - STATUS / RESULT: up to 3 retries with exponential backoff on transient
//     errors (408/429/5xx + network failures). The job is already running on
//     the provider's side; losing the status due to a flaky network hop is
//     pure money waste. Result fetch retry is critical — provider charges
//     fire on COMPLETED, missing the URL means we paid for a video we can't
//     play back.
//   - TIMEOUTS: 25s wall-clock per fetch. Vercel function ceiling is 30s.

const FAL_QUEUE_BASE = 'https://queue.fal.run';
const MUAPI_BASE = 'https://api.muapi.ai/api/v1';
const REPLICATE_BASE = 'https://api.replicate.com/v1';

const TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Retrying fetch for IDEMPOTENT requests (status checks, result reads).
 * Never use on submit/POST that creates a new billable job.
 */
async function fetchIdempotent(url, options) {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetchWithTimeout(url, options);
            if (TRANSIENT_HTTP.has(res.status) && attempt < MAX_RETRIES) {
                lastErr = new Error(`upstream ${res.status}`);
                await sleep(700 * Math.pow(2, attempt) + Math.random() * 200);
                continue;
            }
            return res;
        } catch (err) {
            lastErr = err;
            if (attempt < MAX_RETRIES) {
                await sleep(700 * Math.pow(2, attempt) + Math.random() * 200);
            }
        }
    }
    throw lastErr;
}

// ------------- fal.ai -------------

async function falSubmit(model, params) {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw httpError(500, 'FAL_KEY not configured');

    const url = `${FAL_QUEUE_BASE}/${model.endpoint}`;
    const body = {
        prompt: params.prompt,
        ...(params.duration ? { duration: params.duration } : {}),
        ...(params.resolution ? { resolution: params.resolution } : {}),
        ...(params.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
    };

    // SINGLE ATTEMPT — submit creates a billable job; retry would double-charge
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw httpError(res.status, data?.detail || data?.message || `fal.ai submit failed (${res.status})`);
    }
    if (!data.request_id) throw httpError(502, 'fal.ai did not return request_id');
    return { taskId: data.request_id };
}

async function falStatus(taskId, model) {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw httpError(500, 'FAL_KEY not configured');

    // fal.ai status path = app-level namespace (strip /text-to-video and /fast suffixes).
    // e.g. `bytedance/seedance-2.0/text-to-video`     -> `bytedance/seedance-2.0`
    //      `bytedance/seedance-2.0/fast/text-to-video` -> `bytedance/seedance-2.0`
    const prefix = model
        ? model.endpoint.split('/text-to-video')[0].replace(/\/(fast|v2|v2-fast|master)$/, '')
        : 'bytedance/seedance-2.0';
    const auth = { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` };

    const statusResp = await fetchIdempotent(
        `${FAL_QUEUE_BASE}/${prefix}/requests/${encodeURIComponent(taskId)}/status`,
        { headers: auth },
    );
    const statusData = await statusResp.json().catch(() => ({}));
    if (!statusResp.ok) {
        return { status: 'error', error: statusData?.detail || `fal.ai status ${statusResp.status}` };
    }

    const s = statusData.status;
    if (s === 'IN_QUEUE') return { status: 'queued', progress: statusData.queue_position };
    if (s === 'IN_PROGRESS') return { status: 'processing' };
    if (s === 'FAILED' || s === 'ERROR' || s === 'CANCELLED') {
        return {
            status: 'error',
            error: statusData?.error || statusData?.logs?.[0]?.message || `fal.ai job ${s.toLowerCase()}`,
        };
    }
    if (s === 'COMPLETED') {
        // Result fetch is retried — this is where money has been spent.
        // Failing here = paid for a video we can't retrieve.
        const resultResp = await fetchIdempotent(
            `${FAL_QUEUE_BASE}/${prefix}/requests/${encodeURIComponent(taskId)}`,
            { headers: auth },
        );
        const resultData = await resultResp.json().catch(() => ({}));
        if (!resultResp.ok) {
            return { status: 'error', error: resultData?.detail || `fal.ai result fetch ${resultResp.status}` };
        }
        const videoUrl =
            resultData?.video?.url ||
            resultData?.output?.video?.url ||
            resultData?.video_url ||
            (Array.isArray(resultData?.outputs) ? resultData.outputs[0] : null);
        if (!videoUrl) return { status: 'error', error: 'fal.ai result missing video url' };
        return { status: 'complete', videoUrl };
    }
    return { status: 'processing' };
}

// ------------- MuApi -------------

async function muapiSubmit(model, params) {
    const MUAPI_KEY = process.env.MUAPI_KEY;
    if (!MUAPI_KEY) throw httpError(500, 'MUAPI_KEY not configured');

    const url = `${MUAPI_BASE}/${model.endpoint}`;
    const body = {
        prompt: params.prompt,
        ...(params.duration ? { duration: params.duration } : {}),
        ...(params.resolution ? { resolution: params.resolution } : {}),
        ...(params.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
    };

    // SINGLE ATTEMPT
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': MUAPI_KEY },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw httpError(res.status, data?.detail || data?.message || `MuApi submit failed (${res.status})`);
    }
    const taskId = data.request_id || data.id;
    if (!taskId) throw httpError(502, 'MuApi did not return request_id');
    return { taskId };
}

async function muapiStatus(taskId) {
    const MUAPI_KEY = process.env.MUAPI_KEY;
    if (!MUAPI_KEY) throw httpError(500, 'MUAPI_KEY not configured');

    const res = await fetchIdempotent(
        `${MUAPI_BASE}/predictions/${encodeURIComponent(taskId)}/result`,
        { headers: { 'Content-Type': 'application/json', 'x-api-key': MUAPI_KEY } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { status: 'error', error: data?.detail || `MuApi status ${res.status}` };
    }

    const s = (data.status || '').toLowerCase();
    if (s === 'completed' || s === 'succeeded' || s === 'success') {
        const videoUrl =
            (Array.isArray(data.outputs) ? data.outputs[0] : null) ||
            data.url ||
            data.output?.url ||
            data.video?.url;
        if (!videoUrl) return { status: 'error', error: 'MuApi result missing url' };
        return { status: 'complete', videoUrl };
    }
    if (s === 'failed' || s === 'error' || s === 'cancelled') {
        return { status: 'error', error: data.error || `MuApi job ${s}` };
    }
    return { status: 'processing' };
}

// ------------- Replicate -------------

async function replicateSubmit(model, params) {
    const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
    if (!REPLICATE_TOKEN) throw httpError(500, 'REPLICATE_TOKEN not configured');

    const hasVersion = model.endpoint.includes(':');
    const url = hasVersion
        ? `${REPLICATE_BASE}/predictions`
        : `${REPLICATE_BASE}/models/${model.endpoint}/predictions`;

    const input = {
        prompt: params.prompt,
        ...(params.duration ? { num_frames: Math.round(params.duration * 24) } : {}),
        ...(params.duration ? { duration: params.duration } : {}),
        ...(params.resolution ? { resolution: params.resolution } : {}),
        ...(params.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
    };
    const body = hasVersion ? { version: model.endpoint, input } : { input };

    // SINGLE ATTEMPT
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${REPLICATE_TOKEN}`,
            Prefer: 'respond-async',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw httpError(res.status, data?.detail || data?.title || `Replicate submit failed (${res.status})`);
    }
    if (!data.id) throw httpError(502, 'Replicate did not return prediction id');
    return { taskId: data.id };
}

async function replicateStatus(taskId) {
    const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
    if (!REPLICATE_TOKEN) throw httpError(500, 'REPLICATE_TOKEN not configured');

    const res = await fetchIdempotent(
        `${REPLICATE_BASE}/predictions/${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { status: 'error', error: data?.detail || `Replicate status ${res.status}` };
    }

    const s = data.status;
    if (s === 'starting') return { status: 'queued' };
    if (s === 'processing') return { status: 'processing' };
    if (s === 'failed' || s === 'canceled') {
        return { status: 'error', error: data.error || `Replicate ${s}` };
    }
    if (s === 'succeeded') {
        const output = data.output;
        let videoUrl = null;
        if (typeof output === 'string') videoUrl = output;
        else if (Array.isArray(output)) videoUrl = output[output.length - 1];
        else if (output && typeof output === 'object') videoUrl = output.video || output.url;
        if (!videoUrl) return { status: 'error', error: 'Replicate output missing video url' };
        return { status: 'complete', videoUrl };
    }
    return { status: 'processing' };
}

// ------------- exports -------------

export const PROVIDERS = {
    fal: { submit: falSubmit, status: falStatus },
    muapi: { submit: muapiSubmit, status: muapiStatus },
    replicate: { submit: replicateSubmit, status: replicateStatus },
};

export function httpError(status, message) {
    const err = new Error(message);
    err.statusCode = status;
    return err;
}
