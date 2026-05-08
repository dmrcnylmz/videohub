import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import StepTimeline from '../components/StepTimeline';
import PromptPanel from '../components/PromptPanel';
import VideoPreview from '../components/VideoPreview';
import ModelPicker from '../components/ModelPicker';
import ShotListPanel from '../components/ShotListPanel';
import {
    listModels,
    optimizePrompt,
    generateVideo,
    pollVideoStatus,
    planShots,
    generateAdSequence,
    stitchClips,
} from '../services/apiService';
import { Video, Zap, Youtube, Wand2, Film, Combine, Loader2, HardDrive, DollarSign } from 'lucide-react';

const MODE_SINGLE = 'single';
const MODE_AD = 'ad';

export default function Dashboard() {
    const [mode, setMode] = useState(MODE_SINGLE);

    const [prompt, setPrompt] = useState('');
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState(null);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [videoStatus, setVideoStatus] = useState('idle');
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    // Single-clip advanced controls
    const [imageUrl, setImageUrl] = useState(null);
    const [duration, setDuration] = useState(null);
    const [resolution, setResolution] = useState(null);
    const [seed, setSeed] = useState(null);

    // Multi-shot ad mode state
    const [brief, setBrief] = useState('');
    const [totalDuration, setTotalDuration] = useState(30);
    const [shotCount, setShotCount] = useState(6);
    const [shots, setShots] = useState([]);
    const [adClips, setAdClips] = useState([]);
    const [adProgress, setAdProgress] = useState(null);
    const [isPlanning, setIsPlanning] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isStitching, setIsStitching] = useState(false);
    const [stitchedUrl, setStitchedUrl] = useState(null);

    const pollCleanupRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        listModels()
            .then((list) => {
                if (cancelled) return;
                setModels(list);
                if (list.length && !selectedModelId) setSelectedModelId(list[0].id);
            })
            .catch((err) => !cancelled && setModelsError(err.message))
            .finally(() => !cancelled && setModelsLoading(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (pollCleanupRef.current) pollCleanupRef.current();
        };
    }, []);

    const selectedModel = models.find((m) => m.id === selectedModelId) || null;

    // Auto-pick best T2V + I2V models from the catalog for ad mode.
    // Preference: local (free) > apache > anything.
    const adModels = useMemo(() => {
        const t2v = models.find((m) => !m.supportsImage && m.provider === 'local-comfy')
            || models.find((m) => !m.supportsImage && m.license === 'apache-2.0')
            || models.find((m) => !m.supportsImage);
        const i2v = models.find((m) => m.supportsImage && m.provider === 'local-comfy')
            || models.find((m) => m.supportsImage);
        return { t2v, i2v };
    }, [models]);

    // Cost estimate for ad mode (sum of pricePerSec * duration across shots).
    const adCost = useMemo(() => {
        if (!shots.length) return null;
        const t2vCost = adModels.t2v?.pricePerSec ?? 0;
        const i2vCost = adModels.i2v?.pricePerSec ?? 0;
        let total = 0;
        shots.forEach((s, idx) => {
            const perSec = idx === 0 ? t2vCost : i2vCost;
            total += (perSec || 0) * (s.duration || 5);
        });
        const totalSec = shots.reduce((sum, s) => sum + (s.duration || 5), 0);
        return { total, totalSec, isFree: total === 0 };
    }, [shots, adModels]);

    // Reset image when model changes — avoid stale image state across model switches
    useEffect(() => {
        if (!selectedModel?.supportsImage) setImageUrl(null);
    }, [selectedModelId, selectedModel?.supportsImage]);

    const handleOptimize = useCallback(async () => {
        try {
            setError(null);
            setVideoStatus('optimizing');
            const result = await optimizePrompt(prompt);
            setPrompt(result);
            setVideoStatus('idle');
        } catch (err) {
            console.error('Optimization error:', err);
            setError(err.message);
            setVideoStatus('idle');
        }
    }, [prompt]);

    const handleGenerate = useCallback(async () => {
        if (!selectedModelId) {
            setError('Önce bir model seç.');
            return;
        }
        if (selectedModel?.supportsImage && !imageUrl) {
            setError('Bu model image-to-video — bir başlangıç görseli yükle.');
            return;
        }
        try {
            setError(null);
            setVideoStatus('generating');
            setVideoUrl(null);

            const result = await generateVideo(prompt, {
                modelId: selectedModelId,
                duration: duration ?? undefined,
                resolution: resolution ?? undefined,
                image_url: imageUrl ?? undefined,
                seed: typeof seed === 'number' ? seed : undefined,
            });

            pollCleanupRef.current = pollVideoStatus(
                result.taskId,
                result.provider,
                result.modelId,
                (update) => {
                    if (update.status === 'complete') {
                        setVideoUrl(update.videoUrl);
                        setVideoStatus('ready');
                    } else if (update.status === 'error') {
                        setError(update.error || 'Video üretimi başarısız oldu.');
                        setVideoStatus('error');
                    }
                },
            );
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message);
            setVideoStatus('error');
        }
    }, [prompt, selectedModelId, selectedModel, imageUrl, duration, resolution, seed]);

    const handlePlanShots = useCallback(async () => {
        if (!brief.trim()) return;
        setIsPlanning(true);
        setError(null);
        try {
            const { shots: planned } = await planShots({
                brief: brief.trim(),
                totalDuration,
                shotCount,
            });
            setShots(planned);
            setAdClips([]);
            setStitchedUrl(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsPlanning(false);
        }
    }, [brief, totalDuration, shotCount]);

    const handleGenerateAd = useCallback(async () => {
        if (!shots.length || !adModels.t2v || !adModels.i2v) {
            setError('Model setiyle eşleşme yok — local-comfy backend\'i tunnel\'la bağla veya I2V destekli model ekle.');
            return;
        }
        setIsRunning(true);
        setError(null);
        setAdClips([]);
        setStitchedUrl(null);
        setAdProgress(null);
        setVideoUrl(null);
        try {
            const { clips } = await generateAdSequence({
                shots,
                t2vModelId: adModels.t2v.id,
                i2vModelId: adModels.i2v.id,
                onProgress: (state) => {
                    setAdProgress(state);
                    if (state.status === 'complete' && state.videoUrl) {
                        setAdClips((prev) => [...prev, state.videoUrl]);
                        setVideoUrl(state.videoUrl);
                    }
                },
            });
            if (clips.length) setVideoUrl(clips[clips.length - 1]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsRunning(false);
            setAdProgress(null);
        }
    }, [shots, adModels]);

    const handleStitch = useCallback(async () => {
        if (adClips.length < 2) return;
        setIsStitching(true);
        setError(null);
        try {
            const submission = await stitchClips({ clip_urls: adClips, transition_seconds: 0.4 });
            await new Promise((resolve, reject) => {
                pollVideoStatus(submission.taskId, submission.provider, null, (update) => {
                    if (update.status === 'complete') {
                        setStitchedUrl(update.videoUrl);
                        setVideoUrl(update.videoUrl);
                        resolve();
                    } else if (update.status === 'error') {
                        reject(new Error(update.error || 'stitching failed'));
                    }
                });
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsStitching(false);
        }
    }, [adClips]);

    const isGenerating = videoStatus === 'generating' || isRunning || isStitching;
    const isOptimizing = videoStatus === 'optimizing';

    let currentStep = 0;
    if (mode === MODE_SINGLE) {
        if (videoStatus === 'ready' && videoUrl) currentStep = 3;
        else if (videoStatus === 'generating') currentStep = 2;
        else if (selectedModel && prompt.trim()) currentStep = 1;
        else if (selectedModel) currentStep = 1;
    } else {
        if (stitchedUrl) currentStep = 3;
        else if (adClips.length === shots.length && shots.length > 0) currentStep = 3;
        else if (isRunning) currentStep = 2;
        else if (shots.length) currentStep = 1;
        else if (brief.trim()) currentStep = 1;
    }

    const isLocalSelected = selectedModel?.provider === 'local-comfy';

    return (
        <div className="min-h-screen bg-dark-bg">
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div
                    className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #00d4ff, transparent)' }}
                />
                <div
                    className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #7b61ff, transparent)' }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
                <header className="mb-8 animate-fade-in flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
                            <Video size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
                                Cliphie
                            </h1>
                            <p className="text-sm text-text-muted flex items-center gap-1">
                                <Zap size={12} className="text-neon-yellow" />
                                Multi-model AI video studio
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-dark-card/60 border border-dark-border rounded-full p-1">
                        <button
                            type="button"
                            onClick={() => setMode(MODE_SINGLE)}
                            disabled={isGenerating || isPlanning}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all
                                ${mode === MODE_SINGLE
                                    ? 'bg-neon-blue/20 text-neon-blue shadow-inner'
                                    : 'text-text-muted hover:text-text-secondary'}`}
                        >
                            <Wand2 size={14} /> Tek klip
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode(MODE_AD)}
                            disabled={isGenerating || isPlanning}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all
                                ${mode === MODE_AD
                                    ? 'bg-neon-purple/20 text-neon-purple shadow-inner'
                                    : 'text-text-muted hover:text-text-secondary'}`}
                        >
                            <Film size={14} /> Reklam (multi-shot)
                        </button>
                    </div>

                    {selectedModel && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border
                            ${isLocalSelected
                                ? 'bg-neon-green/10 border-neon-green/30'
                                : 'bg-neon-blue/10 border-neon-blue/20'}`}>
                            {isLocalSelected && <HardDrive size={12} className="text-neon-green" />}
                            <span className="text-xs text-text-muted">Aktif</span>
                            <span className={`text-sm font-semibold ${isLocalSelected ? 'text-neon-green' : 'text-neon-blue'}`}>
                                {selectedModel.displayName}
                            </span>
                            <span className="text-xs text-text-muted/80">
                                · {selectedModel.priceLabel}
                            </span>
                        </div>
                    )}
                </header>

                <StepTimeline currentStep={currentStep} mode={mode} />

                <section className="mb-6">
                    <ModelPicker
                        models={models}
                        loading={modelsLoading}
                        error={modelsError}
                        selectedModelId={selectedModelId}
                        onSelect={setSelectedModelId}
                        disabled={isGenerating || isOptimizing || isPlanning}
                    />
                </section>

                {mode === MODE_SINGLE ? (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <PromptPanel
                            prompt={prompt}
                            onPromptChange={setPrompt}
                            onOptimize={handleOptimize}
                            onGenerate={handleGenerate}
                            isOptimizing={isOptimizing}
                            isGenerating={videoStatus === 'generating'}
                            disabled={false}
                            canGenerate={!!selectedModelId}
                            selectedModel={selectedModel}
                            imageUrl={imageUrl}
                            onImageChange={setImageUrl}
                            duration={duration}
                            onDurationChange={setDuration}
                            resolution={resolution}
                            onResolutionChange={setResolution}
                            seed={seed}
                            onSeedChange={setSeed}
                        />
                        <VideoPreview
                            videoUrl={videoUrl}
                            videoStatus={videoStatus}
                            error={error}
                        />
                    </section>
                ) : (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <ShotListPanel
                                brief={brief}
                                onBriefChange={setBrief}
                                totalDuration={totalDuration}
                                onTotalDurationChange={setTotalDuration}
                                shotCount={shotCount}
                                onShotCountChange={setShotCount}
                                shots={shots}
                                onShotsChange={setShots}
                                onPlan={handlePlanShots}
                                onGenerateAd={handleGenerateAd}
                                isPlanning={isPlanning}
                                isRunning={isRunning}
                                runProgress={adProgress}
                                disabled={isStitching}
                                canRun={!!(adModels.t2v && adModels.i2v)}
                            />

                            {(adCost || adModels.t2v) && (
                                <div className="glass-card p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <DollarSign size={14} className="text-neon-green" />
                                            <span className="uppercase tracking-wider font-semibold">Tahmini maliyet</span>
                                        </div>
                                        {adCost && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-[11px] text-text-muted">{adCost.totalSec} sn toplam</span>
                                                {adCost.isFree ? (
                                                    <span className="text-base font-bold text-neon-green">FREE</span>
                                                ) : (
                                                    <span className="text-base font-bold text-text-primary">~${adCost.total.toFixed(2)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] border border-white/5">
                                            <span className="text-text-muted">T2V (klip 1)</span>
                                            <span className="ml-auto text-text-secondary font-medium">
                                                {adModels.t2v?.displayName || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] border border-white/5">
                                            <span className="text-text-muted">I2V (klip 2..N)</span>
                                            <span className="ml-auto text-text-secondary font-medium">
                                                {adModels.i2v?.displayName || '—'}
                                            </span>
                                        </div>
                                    </div>
                                    {!adModels.i2v && (
                                        <p className="mt-2 text-[11px] text-neon-yellow/80">
                                            I2V modeli yok — multi-shot continuity'yi açmak için <code>LOCAL_COMFY_URL</code>'i set et veya I2V destekli bir endpoint ekle.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <VideoPreview
                                videoUrl={videoUrl}
                                videoStatus={
                                    isStitching ? 'generating' :
                                        isRunning ? 'generating' :
                                            (videoUrl ? 'ready' : 'idle')
                                }
                                error={error}
                            />
                            {adClips.length > 0 && (
                                <div className="glass-card p-4">
                                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                        <p className="text-xs text-text-muted uppercase tracking-wider">
                                            Üretilen klipler ({adClips.length}/{shots.length})
                                        </p>
                                        {adClips.length === shots.length && shots.length >= 2 && (
                                            <button
                                                type="button"
                                                onClick={handleStitch}
                                                disabled={isStitching || isRunning}
                                                className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3"
                                            >
                                                {isStitching ? (
                                                    <Loader2 size={14} className="animate-spin-slow" />
                                                ) : (
                                                    <Combine size={14} />
                                                )}
                                                {isStitching ? 'Birleştiriliyor...' : stitchedUrl ? 'Tekrar birleştir' : 'Reklamı birleştir'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {adClips.map((url, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setVideoUrl(url)}
                                                className={`relative rounded-lg overflow-hidden border transition-colors aspect-video bg-dark-bg
                                                    ${videoUrl === url
                                                        ? 'border-neon-blue ring-1 ring-neon-blue/40'
                                                        : 'border-white/10 hover:border-neon-blue/40'}`}
                                            >
                                                <video
                                                    src={url}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    preload="metadata"
                                                />
                                                <span className="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                                                    #{idx + 1}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    {stitchedUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setVideoUrl(stitchedUrl)}
                                            className={`mt-2 w-full p-2 rounded-lg border text-xs flex items-center justify-center gap-2
                                                ${videoUrl === stitchedUrl
                                                    ? 'border-neon-green bg-neon-green/10 text-neon-green'
                                                    : 'border-neon-green/40 text-neon-green/80 hover:bg-neon-green/5'}`}
                                        >
                                            <Combine size={12} /> Birleştirilmiş final
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* YouTube panel */}
                <section className="mt-6">
                    <div className="glass-card p-4 flex items-center gap-3 opacity-60">
                        <div className="w-10 h-10 rounded-xl bg-yt-red/10 flex items-center justify-center">
                            <Youtube size={20} className="text-yt-red" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-text-secondary">
                                YouTube'a doğrudan yayınlama
                            </p>
                            <p className="text-xs text-text-muted">
                                Üretilen videoyu tek tıkla kanalına yükle — yakında
                            </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-2 py-1 rounded-full border border-dark-border">
                            Soon
                        </span>
                    </div>
                </section>

                <footer className="mt-12 text-center text-text-muted text-xs">
                    <p>
                        Cliphie · {models.length} model · {selectedModel?.displayName || '—'}
                    </p>
                </footer>
            </div>
        </div>
    );
}
