// Provider adapters — translate our normalized request/status into each provider's wire format.
// Each adapter exposes: submit(model, params) -> { taskId } and status(taskId, model) -> normalized.

const FAL_QUEUE_BASE = 'https://queue.fal.run';
const MUAPI_BASE = 'https://api.muapi.ai/api/v1';
const REPLICATE_BASE = 'https://api.replicate.com/v1';

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

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw httpError(res.status, data?.detail || data?.message || 'fal.ai submit failed');
    }
    if (!data.request_id) throw httpError(502, 'fal.ai did not return request_id');
    return { taskId: data.request_id };
}

async function falStatus(taskId, model) {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw httpError(500, 'FAL_KEY not configured');

    // fal.ai status path is namespaced by app prefix. We accept either a model
    // (preferred — derives prefix from endpoint) or fall back to the bytedance prefix.
    const prefix = model
        ? model.endpoint.split('/text-to-video')[0].replace(/\/(fast|v2|v2-fast|master)$/, '')
        : 'fal-ai/bytedance';
    const auth = { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` };

    const statusResp = await fetch(
        `${FAL_QUEUE_BASE}/${prefix}/requests/${encodeURIComponent(taskId)}/status`,
        { headers: auth },
    );
    const statusData = await statusResp.json().catch(() => ({}));
    if (!statusResp.ok) {
        return { status: 'error', error: statusData?.detail || 'fal.ai status check failed' };
    }

    const s = statusData.status;
    if (s === 'IN_QUEUE') return { status: 'queued', progress: statusData.queue_position };
    if (s === 'IN_PROGRESS') return { status: 'processing' };
    if (s === 'FAILED' || s === 'ERROR') {
        return { status: 'error', error: statusData?.error || statusData?.logs?.[0]?.message || 'fal.ai job failed' };
    }
    if (s === 'COMPLETED') {
        const resultResp = await fetch(
            `${FAL_QUEUE_BASE}/${prefix}/requests/${encodeURIComponent(taskId)}`,
            { headers: auth },
        );
        const resultData = await resultResp.json().catch(() => ({}));
        if (!resultResp.ok) return { status: 'error', error: resultData?.detail || 'failed to fetch result' };
        const videoUrl =
            resultData?.video?.url ||
            resultData?.output?.video?.url ||
            resultData?.video_url ||
            (Array.isArray(resultData?.outputs) ? resultData.outputs[0] : null);
        if (!videoUrl) return { status: 'error', error: 'result missing video url' };
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

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': MUAPI_KEY },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw httpError(res.status, data?.detail || data?.message || 'MuApi submit failed');
    }
    const taskId = data.request_id || data.id;
    if (!taskId) throw httpError(502, 'MuApi did not return request_id');
    return { taskId };
}

async function muapiStatus(taskId) {
    const MUAPI_KEY = process.env.MUAPI_KEY;
    if (!MUAPI_KEY) throw httpError(500, 'MUAPI_KEY not configured');

    const res = await fetch(`${MUAPI_BASE}/predictions/${encodeURIComponent(taskId)}/result`, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': MUAPI_KEY },
    });
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
    if (s === 'failed' || s === 'error') {
        return { status: 'error', error: data.error || 'MuApi job failed' };
    }
    return { status: 'processing' };
}

// ------------- Replicate -------------

async function replicateSubmit(model, params) {
    const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
    if (!REPLICATE_TOKEN) throw httpError(500, 'REPLICATE_TOKEN not configured');

    // model.endpoint can be either:
    //   - "owner/name"  → use official-models endpoint, no version needed
    //   - "owner/name:version-id" → use generic /predictions endpoint
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

    const res = await fetch(url, {
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
        throw httpError(res.status, data?.detail || data?.title || 'Replicate submit failed');
    }
    if (!data.id) throw httpError(502, 'Replicate did not return prediction id');
    return { taskId: data.id };
}

async function replicateStatus(taskId) {
    const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
    if (!REPLICATE_TOKEN) throw httpError(500, 'REPLICATE_TOKEN not configured');

    const res = await fetch(`${REPLICATE_BASE}/predictions/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
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
