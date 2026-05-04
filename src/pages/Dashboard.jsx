import { useState, useEffect, useCallback, useRef } from 'react';
import StepTimeline from '../components/StepTimeline';
import PromptPanel from '../components/PromptPanel';
import VideoPreview from '../components/VideoPreview';
import ControlPanel from '../components/ControlPanel';
import PublishButton from '../components/PublishButton';
import ModelPicker from '../components/ModelPicker';
import {
    listModels,
    optimizePrompt,
    generateVideo,
    pollVideoStatus,
    publishToYouTube,
} from '../services/apiService';
import { Video, Zap } from 'lucide-react';

export default function Dashboard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [prompt, setPrompt] = useState('');
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState(null);
    const [selectedModelId, setSelectedModelId] = useState(null);
    const [videoStatus, setVideoStatus] = useState('idle');
    const [videoUrl, setVideoUrl] = useState(null);
    const [taskId, setTaskId] = useState(null);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState({
        title: '',
        description: '',
        tags: [],
    });

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

    const handleOptimize = useCallback(async () => {
        try {
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
            setCurrentStep(1);
            setVideoUrl(null);

            const result = await generateVideo(prompt, { modelId: selectedModelId });
            setTaskId(result.taskId);

            pollCleanupRef.current = pollVideoStatus(
                result.taskId,
                result.provider,
                result.modelId,
                (update) => {
                    if (update.status === 'complete') {
                        setVideoUrl(update.videoUrl);
                        setVideoStatus('ready');
                        setCurrentStep(2);
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

    const handlePublish = useCallback(async () => {
        try {
            setError(null);
            setVideoStatus('uploading');
            setCurrentStep(3);
            await publishToYouTube({
                videoUrl,
                title: metadata.title,
                description: metadata.description,
                tags: metadata.tags,
                taskId,
            });
            setVideoStatus('published');
        } catch (err) {
            console.error('Publish error:', err);
            setError(err.message);
            setVideoStatus('error');
        }
    }, [videoUrl, metadata, taskId]);

    const isGenerating = videoStatus === 'generating';
    const isOptimizing = videoStatus === 'optimizing';
    const canPublish = videoStatus === 'ready' && videoUrl && metadata.title.trim();
    const selectedModel = models.find((m) => m.id === selectedModelId) || null;

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

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
                <header className="mb-8 animate-fade-in">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
                            <Video size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary flex items-center gap-2">
                                Cliphie
                                {selectedModel && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
                                        {selectedModel.displayName}
                                    </span>
                                )}
                            </h1>
                            <p className="text-sm text-text-muted flex items-center gap-1">
                                <Zap size={12} className="text-neon-yellow" />
                                AI Video Oluşturucu & YouTube Yayıncı
                            </p>
                        </div>
                    </div>
                </header>

                <StepTimeline currentStep={currentStep} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-6">
                        <ModelPicker
                            models={models}
                            loading={modelsLoading}
                            error={modelsError}
                            selectedModelId={selectedModelId}
                            onSelect={setSelectedModelId}
                            disabled={isGenerating || videoStatus === 'uploading' || videoStatus === 'published'}
                        />

                        <PromptPanel
                            prompt={prompt}
                            onPromptChange={setPrompt}
                            onOptimize={handleOptimize}
                            onGenerate={handleGenerate}
                            isOptimizing={isOptimizing}
                            isGenerating={isGenerating}
                            disabled={videoStatus === 'uploading' || videoStatus === 'published'}
                            canGenerate={!!selectedModelId}
                        />

                        <ControlPanel
                            metadata={metadata}
                            onMetadataChange={setMetadata}
                            disabled={videoStatus === 'uploading' || videoStatus === 'published'}
                        />
                    </div>

                    <div className="space-y-6">
                        <VideoPreview
                            videoUrl={videoUrl}
                            videoStatus={videoStatus}
                            error={error}
                        />

                        <PublishButton
                            onPublish={handlePublish}
                            videoStatus={videoStatus}
                            disabled={!canPublish}
                        />
                    </div>
                </div>

                <footer className="mt-12 text-center text-text-muted text-xs">
                    <p>Cliphie — Multi-model · {selectedModel?.displayName || 'no model'} · YouTube (yakında)</p>
                </footer>
            </div>
        </div>
    );
}
