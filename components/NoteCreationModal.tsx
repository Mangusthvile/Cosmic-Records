
import React, { useState, useEffect } from 'react';
import { Workspace, NoteTypeDefinition } from '../types';
import { FileText, User, Map, Box, Calendar, Scroll, Sparkles, PenTool, X } from 'lucide-react';
import { vaultService } from '../services/vaultService';

interface NoteCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (type: string, method: 'blank' | 'ai') => void;
    workspace?: Workspace; // Optional for backward compat but highly recommended
}

const getIcon = (iconName: string | undefined) => {
    switch(iconName) {
        case 'User': return User;
        case 'Map': return Map;
        case 'Box': return Box;
        case 'Calendar': return Calendar;
        case 'Scroll': return Scroll;
        case 'FileText': default: return FileText;
    }
};

const NoteCreationModal: React.FC<NoteCreationModalProps> = ({ isOpen, onClose, onCreate, workspace }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedType, setSelectedType] = useState<string>('General');

    // Load templates from workspace or fallback
    const noteTypes: NoteTypeDefinition[] = workspace?.templates.noteTypes || [];
    
    // Reset or load last used
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            if (workspace?.templates.lastUsed?.typeId) {
                setSelectedType(workspace.templates.lastUsed.typeId);
            }
        }
    }, [isOpen, workspace]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && step === 1) handleConfirm('blank');
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, step, selectedType]);

    if (!isOpen) return null;

    const handleConfirm = (method: 'blank' | 'ai') => {
        if (workspace) {
            // Persist Last Used
            const newTemplates = { 
                ...workspace.templates, 
                lastUsed: { typeId: selectedType },
                updatedAt: Date.now() 
            };
            // Optimistic update for UI, service saves to disk
            workspace.templates = newTemplates; 
            vaultService.debouncedSaveTemplates(newTemplates);
        }
        onCreate(selectedType, method);
    };

    const handleNext = () => setStep(2);
    const handleBack = () => setStep(1);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[600px] bg-panel border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
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
                <div className="p-6 overflow-y-auto no-scrollbar">
                    {step === 1 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {noteTypes.map((t) => {
                                const Icon = getIcon(t.icon);
                                return (
                                    <button
                                        key={t.typeId}
                                        onClick={() => setSelectedType(t.typeId)}
                                        className={`flex flex-col gap-2 p-4 rounded-lg border text-left transition-all ${
                                            selectedType === t.typeId 
                                            ? 'bg-accent/10 border-accent shadow-glow' 
                                            : 'bg-surface border-border hover:border-accent/50 hover:bg-[var(--c-hover)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon size={18} className={selectedType === t.typeId ? 'text-accent' : 'text-muted'} />
                                            <span className={`font-bold ${selectedType === t.typeId ? 'text-foreground' : 'text-muted'}`}>{t.name}</span>
                                        </div>
                                        <p className="text-[10px] text-muted line-clamp-2">{t.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleConfirm('blank')}
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
                                onClick={() => handleConfirm('ai')}
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
                            onClick={() => handleConfirm('blank')}
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
