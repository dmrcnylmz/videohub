import { getModelById } from './_lib/catalog.js';
import { PROVIDERS } from './_lib/providers.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { modelId, prompt, duration, resolution, aspect_ratio } = req.body || {};

    if (!modelId || typeof modelId !== 'string') {
        res.status(400).json({ error: 'modelId is required' });
        return;
    }
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'prompt is required' });
        return;
    }

    const model = getModelById(modelId);
    if (!model) {
        res.status(400).json({ error: `Unknown modelId: ${modelId}` });
        return;
    }

    const adapter = PROVIDERS[model.provider];
    if (!adapter) {
        res.status(500).json({ error: `Provider ${model.provider} not implemented` });
        return;
    }

    try {
        const { taskId } = await adapter.submit(model, {
            prompt,
            duration: duration || model.defaultDuration || 5,
            resolution: resolution || '1080p',
            aspect_ratio: aspect_ratio || '16:9',
        });
        res.status(200).json({ taskId, modelId, provider: model.provider });
    } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({ error: err.message || 'Unknown error' });
    }
}
