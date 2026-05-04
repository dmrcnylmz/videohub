import { getModelById } from '../_lib/catalog.js';
import { PROVIDERS } from '../_lib/providers.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { id } = req.query;
    const { provider, modelId } = req.query;

    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'id is required' });
        return;
    }
    if (!provider || typeof provider !== 'string') {
        res.status(400).json({ error: 'provider query param is required' });
        return;
    }

    const adapter = PROVIDERS[provider];
    if (!adapter) {
        res.status(400).json({ error: `Unknown provider: ${provider}` });
        return;
    }

    const model = modelId ? getModelById(modelId) : null;

    try {
        const result = await adapter.status(id, model);
        res.status(200).json(result);
    } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({ status: 'error', error: err.message || 'Unknown error' });
    }
}
