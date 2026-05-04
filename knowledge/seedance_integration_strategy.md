---
description: Multi-model video generation strategy — Vercel Serverless + fal.ai + MuApi
last_updated: 2026-05-04
---

# Video Generation Architecture

## Overview
Cliphie video üretimi **Vercel Serverless Functions** + **multi-provider dispatcher** üzerinde çalışır. Tarayıcı yalnızca `/api/*`'a konuşur; sunucu fonksiyonları seçilen modele göre fal.ai veya MuApi'ye yönlendirir. Anahtarlar tarayıcıya hiçbir zaman çıkmaz.

```
Browser (React/Vite)
   │  GET /api/models                 → catalog (provider+modelId+priceLabel+blurb)
   ├─► POST /api/optimize-prompt      → Google Gemini 2.5 Flash → optimized English prompt
   ├─► POST /api/video-generate       → dispatcher → fal.ai or MuApi → { taskId, provider, modelId }
   └─► GET  /api/video-status/:id     → provider-aware status → { status, videoUrl?, error? }
       (5s polling, 10 dk timeout)
```

## Model katalogu — tek doğruluk kaynağı
[api/_lib/catalog.js](../api/_lib/catalog.js) dosyası provider+model+endpoint bilgisini tutar. Yeni model eklemek = bu dosyaya bir entry. Frontend ve backend ikisi de buradan okur. Verified=false ile işaretli endpoint'ler, fal.ai dashboard'undan exact path doğrulanmadıysa 404 dönebilir; UI'da sarı ⚠ uyarısı gösterilir.

## Provider'lar
- **fal.ai** — birincil hosted aggregator. Seedance, Veo 3.1, Kling 3, Hunyuan, Wan 2.7, LTX. Auth: `Authorization: Key ${FAL_KEY}`.
- **MuApi** — agregator (200+ model — Sora 2, Veo 3, vb). Auth: `x-api-key: ${MUAPI_KEY}`. Submit `POST /api/v1/{endpoint}` → `{ request_id }`; poll `GET /api/v1/predictions/{id}/result`.
- **Replicate** — açık kaynak SaaS-uygun modeller (Wan 2.7 Apache-2.0, Mochi 1 Apache-2.0, LTX-2 LTX-OWL). Auth: `Authorization: Bearer ${REPLICATE_TOKEN}`. Submit `POST /v1/models/{owner}/{name}/predictions` (latest version) veya `POST /v1/predictions` (versiyon ID'li); poll `GET /v1/predictions/{id}` → status `starting|processing|succeeded|failed|canceled`.

## Lisans / SaaS uyumu
Catalog'daki her model `license` alanı ile etiketli (varsa):
- `apache-2.0` → SaaS dahil sınırsız ticari (Wan, Mochi, CogVideoX). UI'da yeşil "SaaS Ready" rozeti.
- `ltx-owl` → $10M altı yıllık gelirde tamamen serbest (LTX). Mavi "SaaS <$10M" rozeti.
- `tencent-community` → territorial restrictions, SaaS riskli (Hunyuan). Kırmızı "SaaS riskli" rozeti.
- Proprietary hosted modeller (Seedance/Veo/Kling/Sora) lisans alanı boş — fiyat üzerinden satın alıyorsun, kendi outputunu serbest kullanırsın.

## Frontend kuralı (sabit)
- Tarayıcı **hiçbir Seedance/fal/Replicate/Gemini anahtarına dokunmaz**.
- `VITE_*` env'lerinde sır olamaz (Vite bunları bundle eder).
- Tüm üçüncü taraf API trafiği `/api/*` üzerinden geçer.

## Sağlayıcılar

### Video — fal.ai (resmi)
- **Endpoint'ler** (sadece `/api` içinden çağrılır):
  - Pro: `POST https://queue.fal.run/fal-ai/bytedance/seedance/v2/text-to-video`
  - Fast: `POST https://queue.fal.run/fal-ai/bytedance/seedance/v2-fast/text-to-video`
  - Status: `GET https://queue.fal.run/fal-ai/bytedance/requests/{request_id}/status`
  - Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/{request_id}`
- **Auth:** `Authorization: Key ${FAL_KEY}` (Vercel env var).
- **Sığma payload:** `{ prompt, duration, resolution, aspect_ratio }`.

### Prompt iyileştirme — Google Gemini 2.5 Flash
- **Model:** `gemini-2.5-flash` ($0.30/M input, $2.50/M output, 1M context).
- **Maliyet:** Çağrı başına ~$0.001 (200 input + 500 output token tipik). Google AI Studio ücretsiz tier 1500 req/gün.
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`
- **Auth:** Query string `?key=...`. Raw fetch (SDK gerekmiyor).

## Fiyatlandırma (Mayıs 2026)
| Tier   | $/sn    | 5 sn klip | Notlar |
|--------|---------|-----------|--------|
| Fast   | ~$0.022 | ~$0.11    | %91 ucuz, kalite kaybı minimal |
| Pro    | ~$0.247 | ~$1.24    | Tam 1080p fidelity |

BytePlus direkt rotası (~46 CNY / 1M token, 5M token ücretsiz onboarding) sonraki iterasyonda; arayüzde değişiklik gerektirmez (sadece n8n yerine BytePlus, kod aynı).

## Performans (bağımsız karşılaştırma)
- **Lider** (kompozit liderlik tablosu): görsel sadakat, hareket, prompt uyumu, zamansal tutarlılık.
- **Güçlü:** insan/karakter animasyonu, doğal hareket, hız.
- **Zayıf:** sinematik renk gradingi (Veo 3.1 önde), native ses (Seedance üretmez — prompt'ta ses tarif etme).

## API kontratı

### `GET /api/models`
Response 200: `{ models: [{ id, provider, displayName, vendor, tier, priceLabel, defaultDuration, blurb, verified }] }`

### `POST /api/optimize-prompt`
Body: `{ prompt: string }`
Response 200: `{ optimizedPrompt: string, usage: {...} }`
Response 422: `{ error }` — model REJECTED dönerse.

### `POST /api/video-generate`
Body: `{ modelId: string, prompt: string, duration?: number, resolution?: string, aspect_ratio?: string }`
Response 200: `{ taskId: string, modelId: string, provider: 'fal'|'muapi' }`

### `GET /api/video-status/:id?provider=fal|muapi&modelId=...`
Response 200: `{ status: 'queued'|'processing'|'complete'|'error', videoUrl?, error?, progress? }`

## Lokal geliştirme
```bash
# Anahtarları .env.local'a yaz (.env.example'a bak)
vercel dev   # /api/* fonksiyonlarını da serve eder, port 3000
```
`npm run dev` (Vite) çalışır ama `/api/*` çağrıları 404 döner — Vercel fonksiyonları için `vercel dev` lazım.

## Üretim
- Vercel'a deploy: `vercel --prod` (veya GitHub bağla, push'la).
- Vercel Dashboard → Settings → Environment Variables: `GOOGLE_API_KEY`, `FAL_KEY`, `REPLICATE_TOKEN` ekle.
- Frontend `VITE_API_BASE` set edilmediği sürece relative `/api` kullanır → aynı origin → CORS yok.

## Resilience
- Frontend: 5 sn polling, 10 dk ceiling.
- Server fonksiyonları: 30 sn timeout (vercel.json'da). Provider 5xx → status endpoint'i `error` olarak forward eder; UI hata gösterir.
- fal.ai 5xx → `/api/seedance-status` 502 olarak forward eder; UI `error` durumuna geçer.

## YouTube otomasyonu (sonra)
Bu iterasyonda kapsam dışı. `apiService.publishToYouTube` placeholder; YouTube Data API v3 entegrasyonu ayrı bir iterasyonda eklenecek (refresh token persistence için Vercel KV veya Supabase gerekecek).
