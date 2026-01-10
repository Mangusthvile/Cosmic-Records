
import React, { useState } from 'react';
import { PendingReviewTab, Workspace, GlossaryTerm } from '../../types';
import { Check, X, Merge, Search, ArrowRight, Quote, AlertTriangle } from 'lucide-react';
import { approvePendingTerm, mergePendingAsAlias, ignorePendingTerm, logNotification } from '../../services/storageService';
import { Button, Input } from '../ui/Primitives';

interface PendingReviewViewProps {
    tab: PendingReviewTab;
    workspace: Workspace;
    onCloseSelf: () => void;
    onOpenNote: (id: string) => void;
    onOpenTerm: (id: string) => void;
}

const PendingReviewView: React.FC<PendingReviewViewProps> = ({ 
    tab, workspace, onCloseSelf, onOpenNote, onOpenTerm 
}) => {
    const pendingId = tab.payload.pendingId;
    const pending = workspace.glossary.pending[pendingId];

    const [mode, setMode] = useState<'review' | 'merge'>('review');
    const [mergeSearch, setMergeSearch] = useState('');
    const [proposedName, setProposedName] = useState(pending?.proposedName || '');
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [showElevationWarning, setShowElevationWarning] = useState(false);

    if (!pending) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted">
                <div className="text-sm">Pending item not found (processed or deleted).</div>
                <Button onClick={onCloseSelf} size="sm" className="mt-4">Close Tab</Button>
            </div>
        );
    }

    // Suggestions for Universe Scope based on sources
    const suggestedScopes = Array.from(new Set(
        pending.detectedInNoteIds
            .map(id => workspace.notes[id]?.universeTag)
            .filter(Boolean) as string[]
    ));

    const handleApprove = () => {
        // Use selected scopes if manually picked, else fallback to suggested, else empty
        const finalScopes = selectedScopes.length > 0 ? selectedScopes : suggestedScopes.length > 0 ? suggestedScopes : [];
        
        // Hack: update memory object to match form so approvePendingTerm picks it up if it uses the object directly
        // But `approvePendingTerm` creates a NEW term from name. 
        // We call approvePendingTerm which accepts pendingId. 
        // Wait, `approvePendingTerm` in storageService uses `pending.proposedName`.
        // So we MUST update the pending object in memory if we want the new name to take effect.
        pending.proposedName = proposedName; 
        
        const newId = approvePendingTerm(workspace, pendingId, { universeScopes: finalScopes });
        if (newId) onOpenTerm(newId);
        onCloseSelf();
    };

    const checkAndApprove = () => {
        const sourceNotes = pending.detectedInNoteIds.map(id => workspace.notes[id]).filter(Boolean);
        
        // Guardrail: Check for Experimental/Outdated sources
        const hasRiskySource = sourceNotes.some(n => n.status === 'Experimental' || n.status === 'Outdated');
        if (hasRiskySource) {
            setShowElevationWarning(true);
            return;
        }

        // Warning: Draft source
        if (sourceNotes.some(n => n.status === 'Draft')) {
            logNotification(workspace, 'info', "Creating canon glossary term from Draft note.");
        }

        handleApprove();
    };

    const handleMerge = (targetId: string) => {
        mergePendingAsAlias(workspace, pendingId, targetId);
        onOpenTerm(targetId);
        onCloseSelf();
    };

    const handleDismiss = () => {
        ignorePendingTerm(workspace, pendingId);
        onCloseSelf();
    };

    const toggleScope = (scope: string) => {
        setSelectedScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
    };

    // Filter terms for merge
    const mergeResults = Object.entries(workspace.glossary.index.terms)
        .filter(([id, t]) => t.primaryName.toLowerCase().includes(mergeSearch.toLowerCase()) || t.aliases.some(a => a.toLowerCase().includes(mergeSearch.toLowerCase())))
        .slice(0, 10);

    return (
        <div className="flex flex-col h-full bg-deep-space text-text p-6 max-w-3xl mx-auto w-full relative">
            
            {/* Elevation Warning Modal */}
            {showElevationWarning && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-panel border border-warning rounded-lg p-6 max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center gap-2 text-warning font-bold text-lg">
                            <AlertTriangle size={20} />
                            <h3>Canon Elevation Required</h3>
                        </div>
                        <p className="text-sm text-text2 leading-relaxed">
                            The glossary is a strict <strong>Canon</strong> system. You are attempting to create a canonical term from an <span className="text-warning font-bold">Experimental</span> or <span className="text-muted font-bold">Outdated</span> note context.
                        </p>
                        <p className="text-sm text-text2">
                            This action effectively elevates this concept to absolute truth within the universe.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setShowElevationWarning(false)}>Cancel</Button>
                            <Button variant="primary" onClick={() => { setShowElevationWarning(false); handleApprove(); }} className="bg-warning text-black hover:bg-warning/90">
                                Confirm Canon Elevation
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Card Header */}
            <div className="bg-panel border border-border rounded-xl overflow-hidden shadow-2xl mb-6">
                <div className="p-6 border-b border-border bg-panel2/50 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-text mb-1">Review Pending Term</h2>
                        <div className="text-xs text-text2 flex items-center gap-2">
                            <span className="bg-warning/10 text-warning px-2 py-0.5 rounded border border-warning/20 uppercase tracking-wider font-bold">
                                {pending.reason}
                            </span>
                            <span>Detected {new Date(pending.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="danger" size="sm" onClick={handleDismiss}>Dismiss</Button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    
                    {/* Name Edit */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-text2 tracking-widest">Proposed Name</label>
                        <Input 
                            value={proposedName} 
                            onChange={e => setProposedName(e.target.value)} 
                            className="text-lg font-bold"
                        />
                    </div>

                    {/* Context / Sources */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-text2 tracking-widest">Context Snippets</label>
                            <div className="bg-surface border border-border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                                {pending.detectedSnippets.map((s, i) => (
                                    <div key={i} className="text-xs text-text2 italic border-l-2 border-accent/30 pl-2">
                                        <Quote size={10} className="inline mr-1 opacity-50"/>
                                        "{s}"
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-text2 tracking-widest">Source Notes</label>
                            <div className="bg-surface border border-border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-1">
                                {pending.detectedInNoteIds.map(id => (
                                    <button 
                                        key={id} 
                                        onClick={() => onOpenNote(id)}
                                        className="flex items-center gap-2 text-xs text-accent hover:underline w-full text-left"
                                    >
                                        <ArrowRight size={12} />
                                        {workspace.notes[id]?.title || id}
                                        <span className={`text-[9px] uppercase px-1 rounded border ${
                                            workspace.notes[id]?.status === 'Canon' ? 'border-success text-success' : 
                                            workspace.notes[id]?.status === 'Draft' ? 'border-text2 text-text2' : 
                                            'border-warning text-warning'
                                        }`}>
                                            {workspace.notes[id]?.status || 'Unknown'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="border-t border-border pt-6">
                        {mode === 'review' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-text2 tracking-widest">Assign Universe</label>
                                    <div className="flex flex-wrap gap-2">
                                        {workspace.settings.universeTags.tags.map(tag => {
                                            const isSelected = selectedScopes.includes(tag) || (selectedScopes.length === 0 && suggestedScopes.includes(tag));
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => toggleScope(tag)}
                                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                                        isSelected 
                                                        ? 'bg-accent text-bg border-accent font-bold' 
                                                        : 'bg-panel border-border text-text2 hover:border-text2'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button onClick={checkAndApprove} className="flex-1 gap-2 py-6 text-base">
                                        <Check size={18} /> Approve & Create
                                    </Button>
                                    <Button variant="outline" onClick={() => setMode('merge')} className="flex-1 gap-2 py-6 text-base">
                                        <Merge size={18} /> Merge as Alias...
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-right-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold uppercase text-text2 tracking-widest">Merge "{proposedName}" into...</label>
                                    <button onClick={() => setMode('review')} className="text-xs text-muted hover:text-text">Cancel Merge</button>
                                </div>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <Input 
                                        autoFocus
                                        placeholder="Search existing terms..." 
                                        className="pl-9"
                                        value={mergeSearch}
                                        onChange={e => setMergeSearch(e.target.value)}
                                    />
                                </div>
                                <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto bg-surface">
                                    {mergeResults.map(([id, t]) => (
                                        <button 
                                            key={id}
                                            onClick={() => handleMerge(id)}
                                            className="w-full text-left p-3 hover:bg-accent/10 border-b border-border/50 last:border-0 transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <div className="font-bold text-sm text-text group-hover:text-accent">{t.primaryName}</div>
                                                {t.aliases.length > 0 && <div className="text-xs text-muted">Aliases: {t.aliases.join(', ')}</div>}
                                            </div>
                                            <Merge size={14} className="opacity-0 group-hover:opacity-100 text-accent" />
                                        </button>
                                    ))}
                                    {mergeResults.length === 0 && (
                                        <div className="p-4 text-center text-xs text-muted italic">No matching terms found.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PendingReviewView;
