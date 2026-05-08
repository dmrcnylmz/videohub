import { Sparkles, Pencil, Cog, Download, Check, Film, ListChecks, Combine } from 'lucide-react';

const SINGLE_STEPS = [
    { id: 0, label: 'Model', icon: Sparkles, description: 'AI model seç' },
    { id: 1, label: 'Prompt', icon: Pencil, description: 'Konuyu yaz' },
    { id: 2, label: 'Üretim', icon: Cog, description: 'Video oluştur' },
    { id: 3, label: 'İndir', icon: Download, description: 'Önizle ve kaydet' },
];

const AD_STEPS = [
    { id: 0, label: 'Brief', icon: Pencil, description: 'Konsepti tarif et' },
    { id: 1, label: 'Storyboard', icon: ListChecks, description: 'Sahneleri planla' },
    { id: 2, label: 'Üretim', icon: Film, description: 'Klipleri üret' },
    { id: 3, label: 'Birleştir', icon: Combine, description: 'Final mp4' },
];

const PALETTE = {
    single: {
        gradient: 'linear-gradient(90deg, #00d4ff, #7b61ff)',
        completeBg: 'bg-neon-blue',
        completeText: 'text-neon-blue',
        activeBorder: 'border-neon-blue',
        activeText: 'text-neon-blue',
    },
    ad: {
        gradient: 'linear-gradient(90deg, #7b61ff, #00d4ff)',
        completeBg: 'bg-neon-purple',
        completeText: 'text-neon-purple',
        activeBorder: 'border-neon-purple',
        activeText: 'text-neon-purple',
    },
};

export default function StepTimeline({ currentStep, mode = 'single' }) {
    const steps = mode === 'ad' ? AD_STEPS : SINGLE_STEPS;
    const c = PALETTE[mode] || PALETTE.single;
    return (
        <div className="glass-card p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-between relative">
                <div className="absolute top-6 left-[10%] right-[10%] h-[2px] bg-dark-border z-0" />

                <div
                    className="absolute top-6 left-[10%] h-[2px] z-[1] transition-all duration-700 ease-out"
                    style={{
                        width: `${Math.min(currentStep / (steps.length - 1), 1) * 80}%`,
                        background: c.gradient,
                        boxShadow: '0 0 10px rgba(0,212,255,0.4)',
                    }}
                />

                {steps.map((step) => {
                    const Icon = step.icon;
                    const isComplete = currentStep > step.id;
                    const isActive = currentStep === step.id;

                    return (
                        <div
                            key={step.id}
                            className="flex flex-col items-center z-[2] relative"
                            style={{ flex: 1 }}
                        >
                            <div
                                className={`
                                    w-12 h-12 rounded-full flex items-center justify-center
                                    transition-all duration-500 ease-out
                                    ${isComplete
                                        ? `${c.completeBg} text-dark-bg shadow-[0_0_20px_rgba(0,212,255,0.4)]`
                                        : isActive
                                            ? `bg-dark-card border-2 ${c.activeBorder} ${c.activeText} animate-pulse-glow`
                                            : 'bg-dark-card border border-dark-border text-text-muted'
                                    }
                                `}
                            >
                                {isComplete ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}
                            </div>

                            <span
                                className={`
                                    mt-3 text-sm font-semibold tracking-wide transition-colors duration-300
                                    ${isComplete ? c.completeText : isActive ? 'neon-text' : 'text-text-muted'}
                                `}
                            >
                                {step.label}
                            </span>

                            <span
                                className={`
                                    mt-1 text-xs transition-colors duration-300
                                    ${isActive ? 'text-text-secondary' : 'text-text-muted'}
                                `}
                            >
                                {step.description}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
