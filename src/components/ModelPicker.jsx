import { Loader2, AlertCircle, Zap, Gem, Sparkles, CheckCircle2, ShieldQuestion } from 'lucide-react';

const TIER_ICON = {
    fast: Zap,
    pro: Gem,
};

const PROVIDER_LABEL = {
    fal: 'fal.ai',
    muapi: 'MuApi',
    replicate: 'Replicate',
};

const LICENSE_BADGE = {
    'apache-2.0': { label: 'SaaS Ready', tone: 'text-neon-green border-neon-green/30 bg-neon-green/5' },
    'ltx-owl': { label: 'SaaS <$10M', tone: 'text-neon-blue border-neon-blue/30 bg-neon-blue/5' },
    'tencent-community': { label: 'SaaS riskli', tone: 'text-neon-red border-neon-red/30 bg-neon-red/5' },
};

function ModelCard({ model, selected, onSelect, disabled }) {
    const TierIcon = TIER_ICON[model.tier] || Sparkles;
    const licenseBadge = model.license ? LICENSE_BADGE[model.license] : null;
    return (
        <button
            type="button"
            onClick={() => onSelect(model.id)}
            disabled={disabled}
            className={`group relative text-left rounded-xl border p-3 transition-all
                ${selected
                    ? 'border-neon-blue bg-neon-blue/10 shadow-lg shadow-neon-blue/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {selected && (
                <CheckCircle2
                    size={14}
                    className="absolute top-2 right-2 text-neon-blue"
                />
            )}
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                    ${selected ? 'bg-neon-blue/20 text-neon-blue' : 'bg-white/5 text-text-muted'}`}>
                    <TierIcon size={14} />
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold
                    ${model.tier === 'pro' ? 'text-neon-purple' : 'text-neon-green'}`}>
                    {model.tier}
                </span>
                <span className="ml-auto text-[10px] text-text-muted/60">
                    {PROVIDER_LABEL[model.provider] || model.provider}
                </span>
            </div>
            <div className={`text-sm font-bold mb-0.5 ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>
                {model.displayName}
                {model.verified === false && (
                    <ShieldQuestion
                        size={12}
                        className="inline-block ml-1 text-neon-yellow/70"
                    />
                )}
            </div>
            <div className="text-[11px] text-text-muted mb-1.5">{model.vendor}</div>
            <div className="text-[11px] text-text-muted/80 leading-snug mb-2 line-clamp-2">
                {model.blurb}
            </div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-text-muted">{model.priceLabel}</span>
                <span className="text-text-muted/60">~{model.defaultDuration}sn</span>
            </div>
            {licenseBadge && (
                <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${licenseBadge.tone}`}>
                    {licenseBadge.label}
                </div>
            )}
        </button>
    );
}

export default function ModelPicker({
    models,
    loading,
    error,
    selectedModelId,
    onSelect,
    disabled,
}) {
    if (loading) {
        return (
            <div className="glass-card p-6 flex items-center gap-3 text-text-muted">
                <Loader2 size={16} className="animate-spin-slow text-neon-blue" />
                Modeller yükleniyor...
            </div>
        );
    }
    if (error) {
        return (
            <div className="glass-card p-6 flex items-center gap-3 text-neon-red">
                <AlertCircle size={16} />
                {error}
            </div>
        );
    }
    if (!models?.length) {
        return (
            <div className="glass-card p-6 text-text-muted text-sm">
                Hiç model yapılandırılmamış.
            </div>
        );
    }

    return (
        <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-neon-blue/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-neon-blue" />
                </div>
                <div>
                    <h2 className="text-base font-bold text-text-primary">Video Modeli</h2>
                    <p className="text-[11px] text-text-muted">
                        {models.length} model · seçili: <span className="text-text-secondary font-medium">
                            {models.find((m) => m.id === selectedModelId)?.displayName || '—'}
                        </span>
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {models.map((m) => (
                    <ModelCard
                        key={m.id}
                        model={m}
                        selected={selectedModelId === m.id}
                        onSelect={onSelect}
                        disabled={disabled}
                    />
                ))}
            </div>
            <p className="text-[10px] text-text-muted/60 mt-3 flex items-center gap-1">
                <ShieldQuestion size={10} className="text-neon-yellow/70" />
                Sarı işaretli modeller endpoint olarak doğrulanmadı; ilk denemede 404 dönerse
                fal.ai dashboard'undaki gerçek path'i <code>api/_lib/catalog.js</code>'a yaz.
            </p>
        </div>
    );
}
