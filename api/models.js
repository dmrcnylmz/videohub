import { MODELS } from './_lib/catalog.js';

export default function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const safe = MODELS.map(({ id, provider, displayName, vendor, tier, priceLabel, defaultDuration, blurb, verified, license }) => ({
        id,
        provider,
        displayName,
        vendor,
        tier,
        priceLabel,
        defaultDuration,
        blurb,
        verified,
        license: license || null,
    }));
    res.status(200).json({ models: safe });
}
