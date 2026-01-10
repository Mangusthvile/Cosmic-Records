
import React, { useState } from 'react';
import { WidgetProps } from './WidgetRegistry';
import { Clock, Check, X, Merge, AlertTriangle, ChevronRight } from 'lucide-react';
import { approvePendingTerm, mergePendingAsAlias, ignorePendingTerm, logNotification } from '../../services/storageService';
import { Button } from '../ui/Primitives';
import { Workspace, PendingTerm } from '../../types';

interface PendingReviewWidgetState {
    selectedPendingId: string | null;
}

const PendingReviewWidget: React.FC<WidgetProps> = ({ workspace, onUpdateWorkspace, state, onStateChange }) => {
    const { selectedPendingId } = (state || {}) as PendingReviewWidgetState;
    const pendingTerms = (Object.values(workspace.glossary.pending) as PendingTerm[]).sort((a, b) => b.createdAt - a.createdAt);
    
    const updateState = (partial: any) => onStateChange({ ...state, ...partial });

    const handleApprove = (id: string) => {
        const pending = workspace.glossary.pending[id];
        if (!pending) return;

        // Simplified guardrails for widget (full modal has more details)
        const sourceNotes = pending.detectedInNoteIds.map(nid => workspace.notes[nid]).filter(Boolean);
        const hasRiskySource = sourceNotes.some(n => n.status === 'Experimental' || n.status === 'Outdated');
        
        if (hasRiskySource && !confirm(`This term comes from experimental/outdated notes. Create as CANON?`)) {
            return;
        }

        approvePendingTerm(workspace, id);
        onUpdateWorkspace({ ...workspace });
        if (selectedPendingId === id) updateState({ selectedPendingId: null });
    };

    const handleDismiss = (id: string) => {
        ignorePendingTerm(workspace, id);
        onUpdateWorkspace({ ...workspace });
        if (selectedPendingId === id) updateState({ selectedPendingId: null });
    };

    const renderDetail = (id: string) => {
        const item = workspace.glossary.pending[id];
        if (!item) return <div className="p-4 text-xs italic text-muted">Item not found.</div>;

        return (
            <div className="flex flex-col h-full p-3 overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-text break-words">{item.proposedName}</h3>
                    <button onClick={() => handleDismiss(id)} className="text-muted hover:text-danger p-1"><X size={14}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    <div className="text-[10px] text-text2 flex gap-2">
                        <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded border border-warning/20 uppercase font-bold">{item.reason}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text2 uppercase">Context</label>
                        {item.detectedSnippets.length > 0 ? (
                            item.detectedSnippets.map((s, i) => (
                                <div key={i} className="text-xs text-text2 italic border-l-2 border-border pl-2 py-1">"{s}"</div>
                            ))
                        ) : (
                            <div className="text-xs text-muted italic">No context available.</div>
                        )}
                    </div>
                </div>

                <div className="pt-3 mt-2 border-t border-border flex gap-2">
                    <Button size="sm" onClick={() => updateState({ selectedPendingId: null })} variant="ghost">Back</Button>
                    <Button size="sm" onClick={() => handleApprove(id)} className="flex-1 gap-1">
                        <Check size={14} /> Approve
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-panel text-text overflow-hidden">
            {selectedPendingId ? renderDetail(selectedPendingId) : (
                <div className="flex flex-col h-full">
                    <div className="p-2 border-b border-border bg-panel2/50 text-[10px] font-bold uppercase text-text2 tracking-widest flex justify-between">
                        <span>Pending ({pendingTerms.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {pendingTerms.length === 0 ? (
                            <div className="text-center text-xs text-text2 italic mt-4 opacity-50">No pending terms.</div>
                        ) : (
                            pendingTerms.map(item => (
                                <div 
                                    key={item.pendingId}
                                    onClick={() => updateState({ selectedPendingId: item.pendingId })}
                                    className="p-2 bg-surface border border-border rounded hover:border-accent/50 cursor-pointer group flex justify-between items-center"
                                >
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold truncate group-hover:text-accent">{item.proposedName}</div>
                                        <div className="text-[10px] text-muted truncate">{item.reason}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-text2 opacity-0 group-hover:opacity-100" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingReviewWidget;
