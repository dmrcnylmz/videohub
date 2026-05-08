import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Cliphie error boundary caught:', error, info);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
                <div className="glass-card max-w-lg p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-neon-red/15 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-neon-red" />
                    </div>
                    <h2 className="text-xl font-bold text-text-primary mb-2">Bir şeyler ters gitti</h2>
                    <p className="text-sm text-text-muted mb-1">
                        Cliphie beklenmedik bir hatayla durdu. Sayfayı yenilemek genelde yeterli olur.
                    </p>
                    <pre className="text-[11px] text-text-muted/60 bg-dark-bg/40 border border-white/5 rounded-lg p-3 my-4 text-left overflow-auto max-h-40">
                        {error.message || String(error)}
                    </pre>
                    <div className="flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> Tekrar dene
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="btn-primary flex items-center gap-2"
                        >
                            Sayfayı yenile
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
