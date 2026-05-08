import { useState } from 'react';
import { Film, Loader2, Play, Plus, Trash2, ChevronDown, ChevronUp, ImageIcon, Type } from 'lucide-react';

export default function ShotListPanel({
    brief,
    onBriefChange,
    totalDuration,
    onTotalDurationChange,
    shotCount,
    onShotCountChange,
    shots,
    onShotsChange,
    onPlan,
    onGenerateAd,
    isPlanning,
    isRunning,
    runProgress,        // { shot:number, status:string }
    disabled,
    canRun,
}) {
    const [expanded, setExpanded] = useState(true);

    const updateShot = (idx, patch) => {
        const next = shots.map((s, i) => (i === idx ? { ...s, ...patch } : s));
        onShotsChange(next);
    };

    const removeShot = (idx) => {
        onShotsChange(shots.filter((_, i) => i !== idx).map((s, i) => ({ ...s, i: i + 1, use_prev_frame: i > 0 })));
    };

    const addShot = () => {
        const last = shots[shots.length - 1];
        const next = [...shots, {
            i: shots.length + 1,
            duration: last?.duration || 5,
            shot_type: 'medium',
            prompt: '',
            use_prev_frame: shots.length > 0,
            notes: '',
        }];
        onShotsChange(next);
    };

    return (
        <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center">
                    <Film size={20} className="text-neon-purple" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-text-primary">Reklam Storyboard</h2>
                    <p className="text-xs text-text-muted">Multi-clip pipeline · I2V continuity ile bağlanır</p>
                </div>
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-text-muted hover:text-text-secondary transition-colors"
                >
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            {expanded && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Brief</label>
                            <textarea
                                className="input-field min-h-[80px] text-sm resize-none"
                                placeholder="Firma + ürün + tonalite. Örn: 'Smartflow CRM, küçük işletme sahipleri için satış otomasyonu, sıcak/güven veren ton.'"
                                value={brief}
                                onChange={(e) => onBriefChange(e.target.value)}
                                disabled={disabled || isPlanning || isRunning}
                            />
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
                                    Toplam süre (sn)
                                </label>
                                <input
                                    type="number"
                                    min="5" max="120" step="5"
                                    className="input-field text-sm"
                                    value={totalDuration}
                                    onChange={(e) => onTotalDurationChange(Number(e.target.value) || 30)}
                                    disabled={disabled || isPlanning || isRunning}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
                                    Klip sayısı
                                </label>
                                <input
                                    type="number"
                                    min="2" max="12"
                                    className="input-field text-sm"
                                    value={shotCount}
                                    onChange={(e) => onShotCountChange(Number(e.target.value) || 6)}
                                    disabled={disabled || isPlanning || isRunning}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                className="btn-secondary flex items-center justify-center gap-2 mb-2"
                                onClick={onPlan}
                                disabled={!brief.trim() || isPlanning || isRunning || disabled}
                            >
                                {isPlanning ? <Loader2 size={16} className="animate-spin-slow" /> : <Type size={16} />}
                                {isPlanning ? 'Planlanıyor...' : 'Storyboard Oluştur'}
                            </button>
                            <button
                                className="btn-primary flex items-center justify-center gap-2"
                                onClick={onGenerateAd}
                                disabled={!shots.length || isRunning || disabled || !canRun}
                            >
                                {isRunning ? <Loader2 size={16} className="animate-spin-slow" /> : <Play size={16} />}
                                {isRunning ? 'Üretiliyor...' : `Reklamı Üret (${shots.length} klip)`}
                            </button>
                        </div>
                    </div>

                    {shots.length > 0 && (
                        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                            {shots.map((shot, idx) => {
                                const isCurrent = isRunning && runProgress?.shot === shot.i;
                                const isDone = isRunning && runProgress?.shot > shot.i;
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-lg border p-3 transition-colors ${
                                            isCurrent ? 'border-neon-blue bg-neon-blue/5' :
                                                isDone ? 'border-neon-green/40 bg-neon-green/5' :
                                                    'border-white/10 bg-white/[0.02]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neon-purple/20 text-neon-purple text-xs font-bold">
                                                {shot.i}
                                            </span>
                                            <select
                                                className="bg-transparent text-[11px] text-text-secondary border-0 outline-none"
                                                value={shot.shot_type}
                                                onChange={(e) => updateShot(idx, { shot_type: e.target.value })}
                                                disabled={isRunning}
                                            >
                                                <option value="wide">wide</option>
                                                <option value="medium">medium</option>
                                                <option value="close-up">close-up</option>
                                                <option value="overhead">overhead</option>
                                                <option value="tracking">tracking</option>
                                                <option value="static">static</option>
                                            </select>
                                            <input
                                                type="number"
                                                min="1" max="15" step="1"
                                                className="w-12 bg-transparent text-[11px] text-text-secondary border border-white/10 rounded px-1 py-0.5"
                                                value={shot.duration}
                                                onChange={(e) => updateShot(idx, { duration: Number(e.target.value) || 5 })}
                                                disabled={isRunning}
                                            />
                                            <span className="text-[10px] text-text-muted">sn</span>
                                            {shot.use_prev_frame && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-neon-blue/80">
                                                    <ImageIcon size={10} /> I2V
                                                </span>
                                            )}
                                            {isCurrent && (
                                                <span className="ml-auto text-[10px] text-neon-blue flex items-center gap-1">
                                                    <Loader2 size={10} className="animate-spin-slow" />
                                                    {runProgress?.status}
                                                </span>
                                            )}
                                            {!isCurrent && !isRunning && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeShot(idx)}
                                                    className="ml-auto text-text-muted/60 hover:text-neon-red transition-colors"
                                                    aria-label="sil"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <textarea
                                            className="w-full bg-transparent border border-white/5 rounded px-2 py-1.5 text-[12px] text-text-secondary leading-relaxed resize-none min-h-[56px]"
                                            value={shot.prompt}
                                            onChange={(e) => updateShot(idx, { prompt: e.target.value })}
                                            disabled={isRunning}
                                        />
                                        {shot.notes && (
                                            <p className="text-[10px] text-text-muted/60 mt-1 italic">{shot.notes}</p>
                                        )}
                                    </div>
                                );
                            })}
                            {!isRunning && (
                                <button
                                    type="button"
                                    onClick={addShot}
                                    className="w-full py-2 rounded-lg border border-dashed border-white/10 text-text-muted hover:text-text-secondary hover:border-white/20 transition-colors flex items-center justify-center gap-2 text-xs"
                                >
                                    <Plus size={12} /> Klip ekle
                                </button>
                            )}
                        </div>
                    )}

                    {!shots.length && !isPlanning && (
                        <p className="text-xs text-text-muted/60 text-center py-6">
                            Brief gir + "Storyboard Oluştur"a bas. Gemini sahne bölümünü hazırlar, ardından her sahne sırayla I2V chain ile üretilir.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
