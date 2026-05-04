import { Youtube, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PublishButton({ onPublish, videoStatus, disabled }) {
    const isUploading = videoStatus === 'uploading';
    const isPublished = videoStatus === 'published';
    const isError = videoStatus === 'error';

    if (isPublished) {
        return (
            <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center justify-center gap-3 py-2">
                    <div className="w-12 h-12 rounded-full bg-neon-green/10 flex items-center justify-center">
                        <CheckCircle2 size={24} className="text-neon-green" />
                    </div>
                    <div>
                        <p className="text-neon-green font-bold text-lg">Başarıyla Yayınlandı!</p>
                        <p className="text-text-muted text-sm">Video YouTube'a yüklendi</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 animate-fade-in">
            <button
                className="btn-youtube w-full flex items-center justify-center gap-3 py-4 text-lg"
                onClick={onPublish}
                disabled={disabled || isUploading}
            >
                {isUploading ? (
                    <>
                        <Loader2 size={22} className="animate-spin-slow" />
                        YouTube'a Yükleniyor...
                    </>
                ) : (
                    <>
                        <Youtube size={22} />
                        YouTube'da Yayınla
                    </>
                )}
            </button>

            {isError && (
                <div className="mt-3 flex items-center gap-2 text-neon-red text-sm">
                    <AlertCircle size={16} />
                    <span>Yükleme sırasında bir hata oluştu. Lütfen tekrar deneyin.</span>
                </div>
            )}

            {!disabled && !isUploading && (
                <p className="text-center text-text-muted text-xs mt-3">
                    Bu işlem videoyu doğrudan YouTube kanalınıza yükler
                </p>
            )}
        </div>
    );
}
