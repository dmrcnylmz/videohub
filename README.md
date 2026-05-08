# Cliphie

**Multi-model AI video studio with self-hosted $0 pipeline option.**

Cliphie tek bir prompt ya da Türkçe brief alır, **fal.ai / Replicate / MuApi** üzerinden farklı video modellerine yönlendirir veya **kendi GPU'nuzdaki ComfyUI** üzerinden $0 maliyetle üretir. Multi-shot reklam modu sahneler arasında **image-to-video continuity** kurar.

## Modlar

### Tek Klip
Tek prompt → tek 5-10 sn'lik klip. 17 modelden biri:
- **fal.ai** (6) — Seedance 2.0 Fast/Pro, Veo 3.1 Fast/Pro, Kling 3.0, Hunyuan, Wan 2.7 Pro, LTX 2.3
- **Replicate** (4) — Wan 2.7 T2V, Wan 2.5 Fast (Apache-2.0), Mochi 1, LTX-2
- **MuApi** (2) — Veo 3, Sora 2 (kredi bazlı)
- **Local ComfyUI** (3) — Wan 2.1 T2V, Wan 2.1 I2V, LTX-Video — **$0**

I2V modellerinde başlangıç görseli upload edilir. Süre / çözünürlük / seed gelişmiş ayarlardan ayarlanabilir.

### Reklam (Multi-Shot)
1. **Brief** — firma + ürün + tonalite Türkçe yaz
2. **Storyboard** — Gemini 2.5 Flash 6 sahnelik shotlist'i JSON olarak çıkarır
3. **Üretim** — klip 1 T2V; klip 2..N I2V (her klip önceki klibin son frame'inden başlar — continuity)
4. **Birleştir** — ComfyUI stitch workflow'u tüm klipleri tek mp4'a crossfade ile bağlar

Maliyet local-comfy'de **$0**, fal.ai'de ~$5-15 (model bazlı, 30 sn).

---

## Hızlı Başlangıç

### Yalnız cloud (fal/Replicate)
```bash
git clone <repo>
cd cliphie
npm install
cp .env.example .env.local
# .env.local'e GOOGLE_API_KEY ve FAL_KEY veya REPLICATE_TOKEN ekle
npx vercel dev
```

`.env.local` minimum:
```
GOOGLE_API_KEY=AIzaSy...     # Gemini (prompt optimizer + shot planner)
FAL_KEY=...                  # fal.ai modellerine erişim
```

İsteğe bağlı:
```
REPLICATE_TOKEN=r8_...        # Wan 2.7, Mochi 1, LTX-2 vs.
MUAPI_KEY=...                 # Veo 3, Sora 2
LOCAL_COMFY_URL=https://...   # Self-hosted ComfyUI tunnel (bkz SELFHOST.md)
```

### Self-hosted ($0 üretim)
[SELFHOST.md](SELFHOST.md) → ComfyUI + Wan 2.1 + LTX-Video kurulumu, Cloudflare Tunnel, Vercel env. Diğer PC'ye geçtiğinde adım-adım takip et.

---

## Mimari

```
┌─────────────────┐         ┌──────────────────────┐
│  Cliphie SPA    │         │  Vercel Serverless   │
│  React 19+Vite  │ ───────▶│  Node 20             │
│                 │   /api  │  api/_lib/providers  │
└─────────────────┘         └──────────┬───────────┘
                                       │
            ┌──────────────────────────┼──────────────────────┐
            ▼                          ▼                      ▼
       ┌─────────┐                ┌──────────┐         ┌──────────────┐
       │ fal.ai  │                │Replicate │         │ Cloudflare   │
       │ Queue   │                │ Predict  │         │   Tunnel     │
       └─────────┘                └──────────┘         └──────┬───────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │  ComfyUI     │
                                                       │  (Home GPU)  │
                                                       │  Wan/LTX     │
                                                       └──────────────┘
```

### API Endpoint'leri
| Endpoint | Method | Amaç |
|---|---|---|
| `/api/models` | GET | Aktif catalog (LOCAL_COMFY_URL yokken local-* gizlenir) |
| `/api/optimize-prompt` | POST | Tek prompt'u Gemini ile cilala (Türkçe→İngilizce, 60-110 word) |
| `/api/plan-shots` | POST | Brief'i N sahnelik JSON shotlist'e böl |
| `/api/video-generate` | POST | T2V/I2V submit (provider router) |
| `/api/video-status/[id]` | GET | Submit edilen task'ı poll et |
| `/api/stitch-clips` | POST | N video URL'sini ComfyUI stitch workflow'una gönder |

### Cost-aware resilience
- **Submit single attempt** — duplicate billing önler (paid provider'lar)
- **Status/result retries** — 3× exp backoff (job zaten çalıştı, son URL'i kaybetmek $ kaybı)
- **25 sn fetch timeout** — Vercel 30 sn ceiling altında

### Catalog konvansiyonu
Her model `api/_lib/catalog.js` içinde:
```js
{
    id, provider, displayName, vendor, tier, license,
    pricePerSec, priceLabel, defaultDuration,
    endpoint,           // provider-specific path/version
    workflow,           // local-comfy: comfy-workflows/<name>.js
    supportsImage,      // true → I2V, gerekli image_url
    requiresEnv,        // 'LOCAL_COMFY_URL' → tunnel olmadan filtrelenir
    verified,           // false → sarı badge UI'da
    blurb,              // Türkçe açıklama
}
```

---

## Bilinen Sınırlamalar / Roadmap

- [ ] **YouTube publish** — `apiService.js:publishToYouTube` stub
- [ ] ComfyUI stitch workflow'u **iskelet** — diğer PC'de gerçek crossfade workflow export'una ihtiyaç var (bkz SELFHOST.md §4)
- [ ] LoRA fine-tune (firma logosu/ürün ID consistency)
- [ ] Audit-shot endpoint'i (Gemini Vision ile her klibin prompt uyumunu kontrol)
- [ ] Tek-klip dark-mode toggle (şu an dark hard-coded)

---

## Geliştirme

```bash
npm install
npm run dev          # Vite dev (frontend only — API çalışmaz)
npx vercel dev       # Tam local stack — API + frontend
npm run build        # Production build → dist/
npm run lint         # ESLint
```

API dosyaları `api/` altında; Vercel her .js dosyasını ayrı serverless function olarak deploy eder.

## Kaynaklar
- [SELFHOST.md](SELFHOST.md) — ComfyUI / Wan / LTX kurulum
- [.env.example](.env.example) — env şablonu
- `knowledge/` — vendor-specific notlar (Seedance entegrasyon stratejisi vs.)

## Lisans
Internal — paylaşmadan önce sahibine sor.
