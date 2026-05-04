import { useState, useEffect, useCallback, useRef } from 'react';
import StepTimeline from '../components/StepTimeline';
import PromptPanel from '../components/PromptPanel';
import VideoPreview from '../components/VideoPreview';
import ModelPicker from '../components/ModelPicker';
import {
    listModels,
    optimizePrompt,
    generateVideo,
    pollVideoStatus,
} from '../services/apiService';
import { Video, Zap, Youtube } from 'lucide-react';

export default function Dashboard() {
    const [prompt, setPrompt] = useState('');
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState(null);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [videoStatus, setVideoStatus] = useState('idle');
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    const pollCleanupRef = useRef(null);

    // Load models on mount
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

    // Cleanup polling
    useEffect(() => {
        return () => {
            if (pollCleanupRef.current) pollCleanupRef.current();
        };
    }, []);

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
        try {
            setError(null);
            setVideoStatus('generating');
            setVideoUrl(null);

            const result = await generateVideo(prompt, { modelId: selectedModelId });

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
    }, [prompt, selectedModelId]);

    // Derive current step from app state — no manual setCurrentStep scattering
    const isGenerating = videoStatus === 'generating';
    const isOptimizing = videoStatus === 'optimizing';
    const selectedModel = models.find((m) => m.id === selectedModelId) || null;

    let currentStep = 0;
    if (videoStatus === 'ready' && videoUrl) currentStep = 3;
    else if (isGenerating) currentStep = 2;
    else if (selectedModel && prompt.trim()) currentStep = 1;
    else if (selectedModel) currentStep = 1;

    return (
        <div className="min-h-screen bg-dark-bg">
            {/* Background glow */}
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
                {/* Header */}
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
                    {selectedModel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                            <span className="text-xs text-text-muted">Aktif</span>
                            <span className="text-sm font-semibold text-neon-blue">
                                {selectedModel.displayName}
                            </span>
                            <span className="text-xs text-text-muted/80">
                                · {selectedModel.priceLabel}
                            </span>
                        </div>
                    )}
                </header>

                <StepTimeline currentStep={currentStep} />

                {/* Step 1: Model picker (full width) */}
                <section className="mb-6">
                    <ModelPicker
                        models={models}
                        loading={modelsLoading}
                        error={modelsError}
                        selectedModelId={selectedModelId}
                        onSelect={setSelectedModelId}
                        disabled={isGenerating || isOptimizing}
                    />
                </section>

                {/* Step 2-4: Prompt (left) + Preview (right) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PromptPanel
                        prompt={prompt}
                        onPromptChange={setPrompt}
                        onOptimize={handleOptimize}
                        onGenerate={handleGenerate}
                        isOptimizing={isOptimizing}
                        isGenerating={isGenerating}
                        disabled={false}
                        canGenerate={!!selectedModelId}
                    />

                    <VideoPreview
                        videoUrl={videoUrl}
                        videoStatus={videoStatus}
                        error={error}
                    />
                </section>

                {/* YouTube panel — yer tutucu, İterasyon 3'te aktif olacak */}
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
