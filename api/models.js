import { MODELS } from './_lib/catalog.js';

export default function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const visible = MODELS.filter((m) => !m.requiresEnv || process.env[m.requiresEnv]);
    const safe = visible.map(({
        id, provider, displayName, vendor, tier, pricePerSec, priceLabel,
        defaultDuration, blurb, verified, license, supportsImage,
    }) => ({
        id,
        provider,
        displayName,
        vendor,
        tier,
        pricePerSec: typeof pricePerSec === 'number' ? pricePerSec : null,
        priceLabel,
        defaultDuration,
        blurb,
        verified,
        license: license || null,
        supportsImage: !!supportsImage,
    }));
    res.status(200).json({ models: safe });
}
