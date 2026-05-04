import { useState } from 'react';
import { Settings, X, Plus, Tag, Type, FileText } from 'lucide-react';

export default function ControlPanel({ metadata, onMetadataChange, disabled }) {
    const [tagInput, setTagInput] = useState('');

    const updateField = (field, value) => {
        onMetadataChange({ ...metadata, [field]: value });
    };

    const addTag = () => {
        const tag = tagInput.trim();
        if (tag && !metadata.tags.includes(tag)) {
            updateField('tags', [...metadata.tags, tag]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        updateField('tags', metadata.tags.filter((t) => t !== tagToRemove));
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    return (
        <div className="glass-card p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
                    <Settings size={20} className="text-neon-green" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-text-primary">Kontrol & Onay Paneli</h2>
                    <p className="text-xs text-text-muted">YouTube meta verilerini düzenleyin</p>
                </div>
            </div>

            {/* Title */}
            <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2">
                    <Type size={14} className="text-neon-blue" />
                    YouTube Başlığı
                    <span className="ml-auto text-xs text-text-muted font-normal">
                        {metadata.title.length}/100
                    </span>
                </label>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Video başlığını girin..."
                    value={metadata.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    maxLength={100}
                    disabled={disabled}
                />
            </div>

            {/* Description */}
            <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2">
                    <FileText size={14} className="text-neon-blue" />
                    Açıklama
                    <span className="ml-auto text-xs text-text-muted font-normal">
                        {metadata.description.length}/5000
                    </span>
                </label>
                <textarea
                    className="input-field resize-none min-h-[100px]"
                    placeholder="Video açıklamasını yazın..."
                    value={metadata.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    maxLength={5000}
                    disabled={disabled}
                />
            </div>

            {/* Tags */}
            <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary mb-2">
                    <Tag size={14} className="text-neon-blue" />
                    Etiketler
                </label>

                {/* Tag chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {metadata.tags.map((tag, idx) => (
                        <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                         bg-neon-blue/10 text-neon-blue border border-neon-blue/20
                         transition-all hover:bg-neon-blue/20"
                        >
                            #{tag}
                            {!disabled && (
                                <button
                                    onClick={() => removeTag(tag)}
                                    className="hover:text-neon-red transition-colors ml-0.5"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </span>
                    ))}
                    {metadata.tags.length === 0 && (
                        <span className="text-xs text-text-muted italic">Henüz etiket yok</span>
                    )}
                </div>

                {/* Tag input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Etiket ekleyin ve Enter'a basın..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        disabled={disabled}
                    />
                    <button
                        className="btn-secondary flex items-center gap-1 px-4"
                        onClick={addTag}
                        disabled={!tagInput.trim() || disabled}
                    >
                        <Plus size={14} />
                        Ekle
                    </button>
                </div>
            </div>
        </div>
    );
}
