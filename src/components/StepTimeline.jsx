import { Pencil, Cog, Eye, Upload, Check } from 'lucide-react';

const steps = [
    { id: 0, label: 'Prompt', icon: Pencil, description: 'Video konusunu yaz' },
    { id: 1, label: 'Üretim', icon: Cog, description: 'Seedance ile oluştur' },
    { id: 2, label: 'İnceleme', icon: Eye, description: 'Ön izle ve düzenle' },
    { id: 3, label: 'Yayınla', icon: Upload, description: 'YouTube\'a yükle' },
];

export default function StepTimeline({ currentStep }) {
    return (
        <div className="glass-card p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-between relative">
                {/* Background connector line */}
                <div className="absolute top-6 left-[10%] right-[10%] h-[2px] bg-dark-border z-0" />

                {/* Active progress line */}
                <div
                    className="absolute top-6 left-[10%] h-[2px] z-[1] transition-all duration-700 ease-out"
                    style={{
                        width: `${Math.min(currentStep / (steps.length - 1), 1) * 80}%`,
                        background: 'linear-gradient(90deg, #00d4ff, #7b61ff)',
                        boxShadow: '0 0 10px rgba(0,212,255,0.4)',
                    }}
                />

                {steps.map((step) => {
                    const Icon = step.icon;
                    const isComplete = currentStep > step.id;
                    const isActive = currentStep === step.id;
                    const isPending = currentStep < step.id;

                    return (
                        <div
                            key={step.id}
                            className="flex flex-col items-center z-[2] relative"
                            style={{ flex: 1 }}
                        >
                            {/* Step circle */}
                            <div
                                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  transition-all duration-500 ease-out
                  ${isComplete
                                        ? 'bg-neon-blue text-dark-bg shadow-[0_0_20px_rgba(0,212,255,0.4)]'
                                        : isActive
                                            ? 'bg-dark-card border-2 border-neon-blue text-neon-blue animate-pulse-glow'
                                            : 'bg-dark-card border border-dark-border text-text-muted'
                                    }
                `}
                            >
                                {isComplete ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}
                            </div>

                            {/* Label */}
                            <span
                                className={`
                  mt-3 text-sm font-semibold tracking-wide transition-colors duration-300
                  ${isComplete ? 'text-neon-blue' : isActive ? 'neon-text' : 'text-text-muted'}
                `}
                            >
                                {step.label}
                            </span>

                            {/* Description */}
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
