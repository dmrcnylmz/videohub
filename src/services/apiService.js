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
 * @param {{ modelId: string, duration?: number, resolution?: string, aspect_ratio?: string }} options
 * @returns {Promise<{ taskId: string, modelId: string, provider: string }>}
 */
export async function generateVideo(prompt, options = {}) {
    const { modelId, duration, resolution = '1080p', aspect_ratio = '16:9' } = options;
    if (!modelId) throw new Error('modelId is required');

    const res = await fetch(`${API_BASE}/video-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, prompt, duration, resolution, aspect_ratio }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Video generation failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.taskId) throw new Error('Server did not return a taskId.');
    return { taskId: data.taskId, modelId: data.modelId, provider: data.provider };
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
