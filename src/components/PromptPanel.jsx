import { useState, useRef } from 'react';
import { Sparkles, Play, Loader2, Image as ImageIcon, X, Dice5, ChevronDown, ChevronUp } from 'lucide-react';

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.readAsDataURL(file);
    });
}

export default function PromptPanel({
    prompt,
    onPromptChange,
    onOptimize,
    onGenerate,
    isOptimizing,
    isGenerating,
    disabled,
    canGenerate = true,
    selectedModel,
    imageUrl,
    onImageChange,
    duration,
    onDurationChange,
    resolution,
    onResolutionChange,
    seed,
    onSeedChange,
}) {
    const [charCount, setCharCount] = useState(prompt.length);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const fileInputRef = useRef(null);

    const handleChange = (e) => {
        const val = e.target.value;
        setCharCount(val.length);
        onPromptChange(val);
    };

    const handleImagePick = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Lütfen bir görsel seç (PNG/JPG).');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            alert('Görsel 8 MB\'dan büyük olamaz.');
            return;
        }
        const dataUrl = await fileToDataUrl(file);
        onImageChange?.(dataUrl);
    };

    const requiresImage = !!selectedModel?.supportsImage;
    const isLocalFree = selectedModel?.provider === 'local-comfy';

    return (
        <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center">
                    <Sparkles size={20} className="text-neon-blue" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-text-primary">Prompt Giriş Paneli</h2>
                    <p className="text-xs text-text-muted">
                        {requiresImage ? 'Image-to-video — başlangıç görseli + prompt' : 'Video konusu ve görsel detayları'}
                    </p>
                </div>
            </div>

            {requiresImage && (
                <div className="mb-4">
                    <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
                        Başlangıç görseli (zorunlu)
                    </label>
                    {imageUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-white/10 group">
                            <img src={imageUrl} alt="start frame" className="w-full max-h-48 object-contain bg-dark-bg" />
                            <button
                                type="button"
                                onClick={() => onImageChange?.(null)}
                                disabled={isGenerating || disabled}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-neon-red/80 text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="görseli kaldır"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isGenerating || disabled}
                            className="w-full py-6 rounded-lg border-2 border-dashed border-white/10 hover:border-neon-blue/40 hover:bg-neon-blue/5 transition-all flex flex-col items-center justify-center gap-2 text-text-muted hover:text-text-secondary"
                        >
                            <ImageIcon size={28} />
                            <span className="text-sm font-medium">Görsel seç (PNG/JPG, max 8 MB)</span>
                            <span className="text-[11px] text-text-muted/70">İlk frame buradan başlar</span>
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImagePick}
                        className="hidden"
                    />
                </div>
            )}

            <div className="relative mb-4">
                <textarea
                    className="input-field resize-none min-h-[180px] text-[15px] leading-relaxed"
                    placeholder={requiresImage
                        ? 'Görseldeki sahnenin nasıl hareket edeceğini yaz... Örn: "kamera yavaşça yaklaşıyor, soldan sağa ışık değişiyor"'
                        : "Video konunuzu detaylı bir şekilde yazın... Örn: 'Uzayda süzülen bir astronotun, arkasında Dünya'nın göründüğü sinematik bir sahne. Yavaş kamera hareketi, lens flareler, koyu mavi ve mor tonlar.'"
                    }
                    value={prompt}
                    onChange={handleChange}
                    disabled={disabled}
                />
                <span className="absolute bottom-3 right-3 text-xs text-text-muted">
                    {charCount} karakter
                </span>
            </div>

            <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="w-full flex items-center justify-between px-3 py-2 mb-3 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-colors text-xs text-text-muted hover:text-text-secondary"
            >
                <span className="font-semibold uppercase tracking-wider">Gelişmiş ayarlar</span>
                {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {advancedOpen && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Süre (sn)</label>
                        <input
                            type="number"
                            min="1" max="15" step="1"
                            className="input-field text-sm"
                            value={duration ?? selectedModel?.defaultDuration ?? 5}
                            onChange={(e) => onDurationChange?.(Number(e.target.value) || 5)}
                            disabled={isGenerating || disabled}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Çözünürlük</label>
                        <select
                            className="input-field text-sm"
                            value={resolution || (isLocalFree ? '480p' : '1080p')}
                            onChange={(e) => onResolutionChange?.(e.target.value)}
                            disabled={isGenerating || disabled}
                        >
                            <option value="480p">480p</option>
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Seed</label>
                        <div className="flex gap-1">
                            <input
                                type="number"
                                min="0" max="4294967295"
                                className="input-field text-sm flex-1"
                                value={seed ?? ''}
                                placeholder="rastgele"
                                onChange={(e) => onSeedChange?.(e.target.value === '' ? null : Number(e.target.value))}
                                disabled={isGenerating || disabled}
                            />
                            <button
                                type="button"
                                onClick={() => onSeedChange?.(Math.floor(Math.random() * 2 ** 32))}
                                disabled={isGenerating || disabled}
                                className="px-2 py-1 rounded border border-white/10 hover:border-neon-blue/40 text-text-muted hover:text-neon-blue transition-colors disabled:opacity-50"
                                title="Rastgele seed"
                            >
                                <Dice5 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <button
                    className="btn-secondary flex items-center gap-2"
                    onClick={onOptimize}
                    disabled={!prompt.trim() || isOptimizing || disabled}
                >
                    {isOptimizing ? (
                        <Loader2 size={16} className="animate-spin-slow" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    {isOptimizing ? 'Optimize Ediliyor...' : 'AI ile Optimize Et'}
                </button>

                <button
                    className="btn-primary flex items-center gap-2"
                    onClick={onGenerate}
                    disabled={!prompt.trim() || isGenerating || disabled || !canGenerate || (requiresImage && !imageUrl)}
                >
                    {isGenerating ? (
                        <Loader2 size={16} className="animate-spin-slow" />
                    ) : (
                        <Play size={16} />
                    )}
                    {isGenerating ? 'Video Üretiliyor...' : 'Video Üret'}
                </button>

                {requiresImage && !imageUrl && (
                    <p className="w-full text-[11px] text-neon-yellow/80 mt-1">
                        Bu model image-to-video — devam etmek için bir başlangıç görseli yüklemen gerekiyor.
                    </p>
                )}
            </div>
        </div>
    );
}
