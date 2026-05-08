# Cliphie Self-Hosted Backend — Setup Guide

Bu rehber Cliphie'yi **$0 üretim modunda** çalıştırmak içindir. Ev/ofis PC'sinde ComfyUI kuruyoruz, bir public tunnel açıyoruz, Cliphie (Vercel) o tunnel'a bağlanıyor.

> **Hardware doğrulama** ile başla — hangi modelleri indireceğin VRAM'e bağlı.

---

## 0. Hardware Check (ilk iş)

Diğer PC'ye geçer geçmez:

```bash
# Linux / macOS
nvidia-smi
free -h

# Windows (PowerShell)
nvidia-smi
wmic memorychip get capacity
```

Çıktıdan iki bilgi al:
1. **GPU adı** ve **VRAM** (örn `NVIDIA GeForce RTX 3090 Total Memory 24576 MiB`)
2. **Sistem RAM** (en az 16 GB önerilir, 32 GB ideal)

VRAM'e göre model seti:

| VRAM | İndirilecek modeller | Gerçekçi süre/klip |
|---|---|---|
| **24 GB** (3090, 4090, 5090) | Wan 2.1 I2V **14B 720p** + LTX-Video + CogVideoX-5B-I2V | 60-180 sn |
| **16 GB** (4080, 4070 Ti Super) | Wan 2.1 I2V **14B 480p** + LTX-Video | 90-300 sn |
| **12 GB** (3080, 4070) | Wan 2.1 I2V **1.3B 480p** + LTX-Video quantized | 60-200 sn |
| **8 GB** (3060 Ti, 3070, 4060) | Wan 2.1 T2V **1.3B** + LTX quantized — I2V zor | 90-300 sn |

---

## 1. ComfyUI Kurulumu

**Önkoşullar:** NVIDIA driver 545+, CUDA 12.x, Python 3.11, Git.

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python -m venv .venv

# macOS / Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

# İlk başlatma
python main.py --listen 0.0.0.0 --port 8188
```

Tarayıcıdan `http://localhost:8188` → ComfyUI default arayüzü açılırsa OK.

> `--listen 0.0.0.0` LAN'a açar (tunnel için gerekli). Yalnızca güvenli ağda kullan.

---

## 2. ComfyUI-Manager + Custom Nodes

ComfyUI-Manager'ı yüklemek `custom_nodes` altına git:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git
cd ../..
# ComfyUI'yi yeniden başlat (Ctrl+C → yukarıdaki python main.py komutu)
```

Tarayıcıda Manager butonu sağ üstte belirir. **Manager → Install Custom Nodes** ile sırayla şunları kur:

- `VideoHelperSuite` — son-frame extract, video concat, FFmpeg wrapper
- `ComfyUI-WanVideoWrapper` (kijai) — Wan 2.1 native nodes (T2V + I2V)
- `ComfyUI-LTXVideo` — LTX-Video native nodes
- `ComfyUI-CogVideoXWrapper` — opsiyonel I2V yedek

Her birinden sonra **Restart ComfyUI** butonu.

---

## 3. Model Checkpoint'leri İndir

Aşağıdaki dosyaları indir → `ComfyUI/models/diffusion_models/` (veya checkpoints/) altına koy.

### Hep gerekli
| Dosya | Boyut | Kaynak |
|---|---|---|
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 5 GB | [HF: Comfy-Org/Wan_2.1_ComfyUI_repackaged](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged) → `text_encoders/` |
| `wan_2.1_vae.safetensors` | 0.5 GB | aynı repo → `vae/` |
| `clip_vision_h.safetensors` | 1.3 GB | aynı repo → `clip_vision/` |

### VRAM senin durumuna göre
**24 GB için (en kalite):**
| Dosya | Boyut |
|---|---|
| `Wan2_1-T2V-14B-720P_fp8_e4m3fn.safetensors` | 16 GB |
| `Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors` | 16 GB |

**16 GB için:**
| Dosya | Boyut |
|---|---|
| `Wan2_1-T2V-14B_fp8_e4m3fn.safetensors` | 16 GB (480p) |
| `Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors` | 16 GB |

**12 GB için:**
| Dosya | Boyut |
|---|---|
| `Wan2_1-T2V-1_3B_bf16.safetensors` | 3 GB |
| `Wan2_1-I2V-1_3B-480P.safetensors` | 3 GB |

**8 GB için:**
| Dosya | Boyut |
|---|---|
| `Wan2_1-T2V-1_3B_fp8_e4m3fn.safetensors` | 1.7 GB |
| (I2V çalıştırmak zor; sadece T2V + post-prod stitch ile devam) | |

### LTX-Video (her durumda)
| Dosya | Boyut | Kaynak |
|---|---|---|
| `ltx-video-2b-v0.9.7.safetensors` | 9 GB | [HF: Lightricks/LTX-Video](https://huggingface.co/Lightricks/LTX-Video) |
| `t5xxl_fp16.safetensors` | 9 GB | LTX-Video repo'sunun text_encoders/ dizini |

> `huggingface-cli download <repo-id> <filename>` veya tarayıcıdan tek tek. İlk seferde ~30-50 GB indireceksin, internet planı buna izin veriyor mu kontrol et.

---

## 4. Workflow'ları Test Et

`api/_lib/comfy-workflows/*.js` içinde **iskelet** workflow'lar var. ComfyUI'da gerçek çalışan workflow'ları kurman ve `Save (API Format)` ile JSON export'larını alıp bu dosyalara yapıştırman gerekiyor.

### Adım 4a — T2V workflow
1. ComfyUI'yi aç
2. Sağ panelden `Workflows → Browse templates → Wan 2.1 T2V` (veya WanVideoWrapper'ın örneklerinden birini yükle)
3. Pozitif prompt: `cinematic wide shot of a serene mountain lake at sunrise, mist over the water, slow drone push-in, golden hour lighting, muted teal and amber palette, photorealistic`
4. Çalıştır, ~60-120 sn bekle
5. `output/` altında bir mp4 oluşmalı — ffprobe ile süre kontrol et:
   ```bash
   ffprobe -v error -select_streams v:0 -show_entries stream=duration,width,height output/<filename>.mp4
   ```
6. **Workflow → Save (API Format)** → çıkan JSON'u `api/_lib/comfy-workflows/t2v-wan21.js` içindeki `WORKFLOW` const'ına yapıştır
7. `NODE_IDS` mapini gerçek node id'lerine güncelle (positive_prompt CLIPTextEncode'un id'si, sampler_seed KSampler'ın id'si, vb.)

### Adım 4b — I2V workflow
Aynı süreç, `Wan 2.1 I2V` template'i ile. ÖNEMLİ: workflow'da bir `LoadImage` node'u olmalı, çünkü Cliphie adapter o node'a uploaded filename'i set ediyor.

1. Bir test image'i `ComfyUI/input/` dizinine koy (mountain.jpg gibi)
2. Workflow'da `LoadImage` node'unu seç → image dropdown'undan o dosyayı seç
3. Pozitif prompt: `the same mountain lake, camera slowly orbiting clockwise, mist drifting, identical lighting and color palette`
4. Çalıştır → ilk frame input image'le aynı görünmeli
5. Save (API Format) → `i2v-wan21.js`'e yapıştır + `NODE_IDS.load_image` doğru id'ye

---

## 5. Public Tunnel Aç

### Yol 1 — Cloudflare Tunnel (önerilen, kalıcı URL)

```bash
# Kurulum (bir kere)
brew install cloudflared       # macOS
# Windows: https://github.com/cloudflare/cloudflared/releases
cloudflared tunnel login        # tarayıcı açılır, Cloudflare hesabıyla auth

# Tunnel yarat
cloudflared tunnel create cliphie-comfy
cloudflared tunnel route dns cliphie-comfy comfy.SENIN-DOMAIN.com

# Çalıştır (her açılışta)
cloudflared tunnel run --url http://localhost:8188 cliphie-comfy
```

Cliphie env: `LOCAL_COMFY_URL=https://comfy.SENIN-DOMAIN.com`

### Yol 2 — ngrok (hızlı test, URL her başlatışta değişir)

```bash
brew install ngrok
ngrok config add-authtoken <ngrok-token>
ngrok http 8188
```

Çıkan URL'yi (örn `https://abc123.ngrok-free.app`) kopyala → Cliphie env'e yaz.

> Free plan ngrok: bağlantı başına 2 saat limit. Kalıcı kullanım için Cloudflare.

---

## 6. Cliphie'yi Yeni Backend'e Bağla

### Lokal dev için
`.env.local` dosyana ekle:
```
LOCAL_COMFY_URL=https://comfy.SENIN-DOMAIN.com
```
`vercel dev` çalıştırırsan local-* modeller görünür.

### Vercel deploy için
Vercel Dashboard → Project (cliphie) → **Settings → Environment Variables**:
- Key: `LOCAL_COMFY_URL`
- Value: tunnel URL'in
- Environments: Production + Preview

Save → bir sonraki deploy'da `/api/models` endpoint'i `local-wan21-t2v`, `local-wan21-i2v`, `local-ltx-t2v` modellerini de döndürür.

---

## 7. End-to-End Test

1. Cliphie UI'da "Tek klip" modunda **Wan 2.1 T2V (Local)** seç → kısa prompt → "Video Üret"
2. Network tab'inde POST `/api/video-generate` → 200 + taskId; sonra GET `/api/video-status/<id>?provider=local-comfy` 5 sn aralıkla pollanmalı
3. ~60-180 sn sonra video görünür → ev PC'nin ekranında ComfyUI loglarında "Prompt executed" görmelisin
4. "Reklam (multi-shot)" moduna geç → brief gir → "Storyboard Oluştur" → 6 klip plan görünür → "Reklamı Üret"
5. Klip 1 üretilir, son frame extract edilir, klip 2 I2V ile başlar (ilk frame'i klip 1'in son frame'i ile aynı olmalı)

---

## 8. Sorun Giderme

| Belirti | Sebep | Çözüm |
|---|---|---|
| `503 LOCAL_COMFY_URL not configured` | Vercel env eksik | Dashboard'dan ekle, redeploy |
| `502 ComfyUI did not return prompt_id` | Workflow JSON bozuk | API Format export'unu yeniden yapıştır |
| Frame extraction CORS hatası | Tunnel CORS kapalı | Cloudflare Access kuralı / ComfyUI `--enable-cors-header '*'` flag |
| Video boyut/duration uyuşmuyor | Workflow'da `length` 81 değil | `t2v-wan21.js` `durationToFrames()` kontrol |
| OOM "CUDA out of memory" | Model VRAM'i aştı | Daha küçük model (1.3B) veya quantization (fp8) kullan |
| "execution_error" history'de | Custom node eksik | ComfyUI-Manager → Install Missing Custom Nodes |

---

## 9. Sonraki Adımlar (Wave 4 polish)

- [ ] ComfyUI'da `stitch.json` workflow'u: N adet mp4 alıp tek crossfade-concat mp4 üretsin
- [ ] Cliphie'ye stitching tetikleyen UI butonu (klip listesinin altında "Reklamı birleştir")
- [ ] LoRA fine-tune workflow'ları (firma logo / ürün ID consistency)
- [ ] `audit-shot` endpoint'i: Gemini Vision ile her klibin prompt'a uygunluğunu kontrol et

---

## Referanslar

- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- ComfyUI-Manager: https://github.com/ltdrdata/ComfyUI-Manager
- Wan 2.1 (Comfy-Org repackaged): https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged
- WanVideoWrapper (kijai): https://github.com/kijai/ComfyUI-WanVideoWrapper
- LTX-Video: https://huggingface.co/Lightricks/LTX-Video
- VideoHelperSuite: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
