import { useState } from 'react';
import { Sparkles, Play, Loader2 } from 'lucide-react';

export default function PromptPanel({
    prompt,
    onPromptChange,
    onOptimize,
    onGenerate,
    isOptimizing,
    isGenerating,
    disabled,
    canGenerate = true,
}) {
    const [charCount, setCharCount] = useState(0);

    const handleChange = (e) => {
        const val = e.target.value;
        setCharCount(val.length);
        onPromptChange(val);
    };

    return (
        <div className="glass-card p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center">
                    <Sparkles size={20} className="text-neon-blue" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-text-primary">Prompt Giriş Paneli</h2>
                    <p className="text-xs text-text-muted">Video konusu ve görsel detayları belirleyin</p>
                </div>
            </div>

            {/* Textarea */}
            <div className="relative mb-4">
                <textarea
                    className="input-field resize-none min-h-[180px] text-[15px] leading-relaxed"
                    placeholder="Video konunuzu detaylı bir şekilde yazın... Örn: 'Uzayda süzülen bir astronotun, arkasında Dünya'nın göründüğü sinematik bir sahne. Yavaş kamera hareketi, lens flareler, koyu mavi ve mor tonlar.'"
                    value={prompt}
                    onChange={handleChange}
                    disabled={disabled}
                />
                <span className="absolute bottom-3 right-3 text-xs text-text-muted">
                    {charCount} karakter
                </span>
            </div>

            {/* Actions */}
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
                    disabled={!prompt.trim() || isGenerating || disabled || !canGenerate}
                >
                    {isGenerating ? (
                        <Loader2 size={16} className="animate-spin-slow" />
                    ) : (
                        <Play size={16} />
                    )}
                    {isGenerating ? 'Video Üretiliyor...' : 'Video Üret'}
                </button>
            </div>
        </div>
    );
}
