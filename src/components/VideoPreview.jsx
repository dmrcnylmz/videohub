import { useState } from 'react';
import ReactPlayer from 'react-player';
import { Monitor, Loader2, AlertCircle, CheckCircle2, Download } from 'lucide-react';

const statusConfig = {
    idle: { label: 'Hazır', color: 'text-text-muted', bg: 'bg-dark-border/50' },
    optimizing: { label: 'Prompt Optimize Ediliyor', color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
    generating: { label: 'Video Üretiliyor', color: 'text-neon-yellow', bg: 'bg-neon-yellow/10' },
    ready: { label: 'Video Hazır', color: 'text-neon-green', bg: 'bg-neon-green/10' },
    uploading: { label: 'YouTube\'a Yükleniyor', color: 'text-yt-red', bg: 'bg-yt-red/10' },
    published: { label: 'Yayınlandı', color: 'text-neon-green', bg: 'bg-neon-green/10' },
    error: { label: 'Hata', color: 'text-neon-red', bg: 'bg-neon-red/10' },
};

function inferFilename(url) {
    try {
        const u = new URL(url);
        const last = u.pathname.split('/').filter(Boolean).pop() || 'video.mp4';
        return last.includes('.') ? last : `${last}.mp4`;
    } catch {
        return 'seedance-video.mp4';
    }
}

async function downloadVideo(videoUrl) {
    const filename = `cliphie-${Date.now()}-${inferFilename(videoUrl)}`;
    try {
        const res = await fetch(videoUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
        window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
}

export default function VideoPreview({ videoUrl, videoStatus, error }) {
    const status = statusConfig[videoStatus] || statusConfig.idle;
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!videoUrl) return;
        setDownloading(true);
        try {
            await downloadVideo(videoUrl);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="glass-card p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center">
                        <Monitor size={20} className="text-neon-purple" />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">Video Ön İzleme</h2>
                </div>

                {/* Status badge */}
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status.bg} ${status.color}`}>
                    {videoStatus === 'generating' && <Loader2 size={12} className="animate-spin-slow" />}
                    {videoStatus === 'ready' && <CheckCircle2 size={12} />}
                    {videoStatus === 'published' && <CheckCircle2 size={12} />}
                    {videoStatus === 'error' && <AlertCircle size={12} />}
                    {status.label}
                </div>
            </div>

            {/* Video area */}
            <div className="relative w-full rounded-xl overflow-hidden bg-dark-bg border border-dark-border"
                style={{ aspectRatio: '16/9' }}>
                {videoUrl ? (
                    <ReactPlayer
                        url={videoUrl}
                        controls
                        width="100%"
                        height="100%"
                        style={{ position: 'absolute', top: 0, left: 0 }}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {videoStatus === 'generating' ? (
                            <>
                                {/* Processing animation */}
                                <div className="relative mb-6">
                                    <div className="w-20 h-20 rounded-full border-2 border-neon-blue/20 flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full border-2 border-t-neon-blue border-r-transparent border-b-transparent border-l-transparent animate-spin-slow" />
                                    </div>
                                    <div className="absolute inset-0 rounded-full animate-pulse-glow" />
                                </div>
                                <p className="text-text-secondary text-sm font-medium mb-1">Video Oluşturuluyor</p>
                                <p className="text-text-muted text-xs">Seedance 2.0 ile işleniyor...</p>

                                {/* Shimmer bars */}
                                <div className="mt-6 w-3/5 space-y-2">
                                    <div className="h-2 rounded-full animate-shimmer" />
                                    <div className="h-2 rounded-full animate-shimmer w-4/5 mx-auto" style={{ animationDelay: '0.3s' }} />
                                    <div className="h-2 rounded-full animate-shimmer w-3/5 mx-auto" style={{ animationDelay: '0.6s' }} />
                                </div>
                            </>
                        ) : videoStatus === 'error' ? (
                            <>
                                <AlertCircle size={40} className="text-neon-red mb-3" />
                                <p className="text-neon-red text-sm font-medium">Hata Oluştu</p>
                                <p className="text-text-muted text-xs mt-1 max-w-[300px] text-center">{error || 'Video üretimi sırasında bir sorun oluştu.'}</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-dark-card border border-dark-border flex items-center justify-center mb-4 animate-float">
                                    <Monitor size={28} className="text-text-muted" />
                                </div>
                                <p className="text-text-muted text-sm">Video burada görüntülenecek</p>
                                <p className="text-text-muted/60 text-xs mt-1">Prompt girin ve "Video Üret" butonuna basın</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {videoUrl && (
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {downloading ? (
                            <Loader2 size={16} className="animate-spin-slow" />
                        ) : (
                            <Download size={16} />
                        )}
                        {downloading ? 'İndiriliyor...' : 'Videoyu İndir'}
                    </button>
                </div>
            )}
        </div>
    );
}
