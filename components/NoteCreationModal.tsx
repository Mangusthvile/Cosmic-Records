import React, { useState, useEffect } from 'react';
import { NoteType } from '../types';
import { FileText, User, Map, Box, Calendar, Scroll, Sparkles, PenTool, X } from 'lucide-react';

interface NoteCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (type: string, method: 'blank' | 'ai') => void;
}

const TYPES: { id: NoteType; label: string; icon: React.ElementType, desc: string }[] = [
    { id: 'General', label: 'General Note', icon: FileText, desc: 'A blank canvas for any content.' },
    { id: 'Character', label: 'Character', icon: User, desc: 'A person, creature, or entity.' },
    { id: 'Place', label: 'Place', icon: Map, desc: 'A location, planet, or region.' },
    { id: 'Item', label: 'Item', icon: Box, desc: 'An object, artifact, or technology.' },
    { id: 'Event', label: 'Event', icon: Calendar, desc: 'A historical or timeline event.' },
    { id: 'Lore', label: 'Lore', icon: Scroll, desc: 'History, religion, or culture.' },
];

const NoteCreationModal: React.FC<NoteCreationModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedType, setSelectedType] = useState<string>('General');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedType('General');
        }
    }, [isOpen]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && step === 1) onCreate(selectedType, 'blank');
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, step, selectedType]);

    if (!isOpen) return null;

    const handleNext = () => setStep(2);
    const handleBack = () => setStep(1);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[500px] bg-panel border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
                    <h2 className="text-lg font-bold text-foreground">
                        {step === 1 ? 'New Record: Select Type' : `New ${selectedType}`}
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 1 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {TYPES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedType(t.id)}
                                    className={`flex flex-col gap-2 p-4 rounded-lg border text-left transition-all ${
                                        selectedType === t.id 
                                        ? 'bg-accent/10 border-accent shadow-glow' 
                                        : 'bg-surface border-border hover:border-accent/50 hover:bg-[var(--c-hover)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <t.icon size={18} className={selectedType === t.id ? 'text-accent' : 'text-muted'} />
                                        <span className={`font-bold ${selectedType === t.id ? 'text-foreground' : 'text-muted'}`}>{t.label}</span>
                                    </div>
                                    <p className="text-[10px] text-muted line-clamp-2">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => onCreate(selectedType, 'blank')}
                                className="flex flex-col items-center justify-center gap-4 p-8 rounded-xl border border-border bg-surface hover:bg-[var(--c-hover)] hover:border-accent/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center group-hover:border-accent group-hover:text-accent transition-colors">
                                    <PenTool size={24} />
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-foreground mb-1">Blank Record</div>
                                    <div className="text-xs text-muted">Start from scratch.</div>
                                </div>
                            </button>

                            <button
                                onClick={() => onCreate(selectedType, 'ai')}
                                className="flex flex-col items-center justify-center gap-4 p-8 rounded-xl border border-border bg-surface hover:bg-[var(--c-hover)] hover:border-purple-400/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center group-hover:border-purple-400 group-hover:text-purple-400 transition-colors">
                                    <Sparkles size={24} />
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-foreground mb-1">AI Interview</div>
                                    <div className="text-xs text-muted">Guided creation flow.</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-surface/30 flex justify-between items-center">
                    {step === 2 ? (
                        <button onClick={handleBack} className="text-xs font-bold text-muted hover:text-foreground uppercase tracking-wide">
                            Back
                        </button>
                    ) : (
                         <button 
                            onClick={() => onCreate(selectedType, 'blank')}
                            className="text-xs text-muted hover:text-accent transition-colors"
                        >
                            Quick Create (Enter)
                        </button>
                    )}
                    
                    {step === 1 && (
                        <button 
                            onClick={handleNext} 
                            className="bg-accent text-white px-4 py-2 rounded-md text-sm font-bold shadow-lg shadow-accent/20 hover:opacity-90 transition-opacity"
                        >
                            Next Step
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NoteCreationModal;