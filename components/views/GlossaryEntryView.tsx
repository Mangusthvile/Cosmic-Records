
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GlossaryEntryTab, Workspace, GlossaryTerm } from '../../types';
import { Book, RefreshCw, Trash2, Globe, AlertTriangle, MessageSquare, CheckCircle } from 'lucide-react';
import { updateGlossaryTerm, deleteGlossaryTerm, validateGlossaryTerm } from '../../services/storageService';
import HybridEditor, { HybridEditorHandle } from '../editor/HybridEditor';
import { Button, Input, IconButton } from '../ui/Primitives';

interface GlossaryEntryViewProps {
    tab: GlossaryEntryTab;
    workspace: Workspace;
    onUpdateState: (partial: Partial<GlossaryEntryTab['state']>) => void;
    onCloseSelf: () => void;
    onOpenNote: (id: string) => void;
    onOpenTerm: (id: string) => void;
    isFocusedPane: boolean;
}

const GlossaryEntryView: React.FC<GlossaryEntryViewProps> = ({ 
    tab, workspace, onUpdateState, onCloseSelf, onOpenNote, onOpenTerm, isFocusedPane 
}) => {
    const termId = tab.payload.termId;
    const term = workspace.glossary.terms[termId];

    if (!term) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
                <Book size={48} className="opacity-20"/>
                <div className="text-center">
                    <h3 className="text-lg font-bold">Term Not Found</h3>
                    <p className="text-xs text-text2">This glossary entry may have been deleted.</p>
                </div>
                <Button onClick={onCloseSelf} size="sm">Close Tab</Button>
            </div>
        );
    }

    // Local State
    const [localTerm, setLocalTerm] = useState<GlossaryTerm>(term);
    const [localContent, setLocalContent] = useState<any>(term.definitionRichText);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [newAlias, setNewAlias] = useState('');
    
    const editorRef = useRef<HybridEditorHandle>(null);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstLoad = useRef(true);

    // Sync from workspace updates (external changes)
    useEffect(() => {
        if (workspace.glossary.terms[termId]) {
            const remote = workspace.glossary.terms[termId];
            if (remote.updatedAt > localTerm.updatedAt || isFirstLoad.current) {
                setLocalTerm(remote);
                if (isFirstLoad.current) {
                    setLocalContent(remote.definitionRichText);
                    isFirstLoad.current = false;
                }
            }
        }
    }, [workspace.glossary.terms, termId]);

    // Save Logic
    const performSave = useCallback(async (currentTerm: GlossaryTerm, content: any) => {
        const toSave = { ...currentTerm, definitionRichText: content };
        const validationError = validateGlossaryTerm(workspace, toSave);
        if (validationError) {
            setSaveStatus('error');
            setErrorMsg(validationError);
            return;
        }

        setSaveStatus('saving');
        setErrorMsg(null);
        updateGlossaryTerm(workspace, toSave);
        setTimeout(() => setSaveStatus('saved'), 500);
    }, [workspace]);

    const scheduleSave = (updatedTerm: GlossaryTerm, updatedContent: any) => {
        setSaveStatus('unsaved');
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => performSave(updatedTerm, updatedContent), 1000);
    };

    // Handlers
    const handleFieldChange = (partial: Partial<GlossaryTerm>) => {
        const updated = { ...localTerm, ...partial };
        setLocalTerm(updated);
        scheduleSave(updated, localContent);
    };

    const handleContentChange = (doc: any) => {
        setLocalContent(doc);
        scheduleSave(localTerm, doc);
    };

    const handleManualSave = () => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        performSave(localTerm, localContent);
    };

    const addAlias = () => {
        const alias = newAlias.trim();
        if (!alias) return;
        if (localTerm.aliases.includes(alias)) {
            setNewAlias(''); 
            return;
        }
        const updatedAliases = [...localTerm.aliases, alias];
        handleFieldChange({ aliases: updatedAliases });
        setNewAlias('');
    };

    const removeAlias = (alias: string) => {
        handleFieldChange({ aliases: localTerm.aliases.filter(a => a !== alias) });
    };

    const toggleUniverse = (tag: string) => {
        const current = localTerm.universeScopes;
        const updated = current.includes(tag) 
            ? current.filter(t => t !== tag) 
            : [...current, tag];
        handleFieldChange({ universeScopes: updated });
    };

    const handleDelete = () => {
        if (confirm(`Delete glossary term "${localTerm.primaryName}"? This cannot be undone.`)) {
            deleteGlossaryTerm(workspace, termId);
            onCloseSelf();
        }
    };

    // New: Dispatch event to open widget instead of inline view
    const handleOpenMentionsWidget = () => {
        window.dispatchEvent(new CustomEvent('open-widget-occurrences', { detail: { termId } }));
    };

    // Occurrences Count
    const occurrences = workspace.glossary.occurrences.terms[termId];
    const mentionCount = occurrences ? occurrences.noteIds.length : 0;

    return (
        <div className="flex flex-col h-full bg-deep-space text-text relative">
            
            {/* Header / Properties */}
            <div className="border-b border-border bg-panel p-4 space-y-4 flex-shrink-0 z-10">
                
                {/* Top Row: Type & Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest">
                            <Book size={14} /> Glossary Entry
                        </div>
                        <div className="flex items-center gap-1 text-[10px] bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            <CheckCircle size={10} /> Canon
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saveStatus === 'error' ? (
                            <div className="flex items-center gap-1 text-[10px] text-danger font-bold" title={errorMsg || "Error"}>
                                <AlertTriangle size={12} /> Save Failed
                            </div>
                        ) : (
                            <div className={`flex items-center gap-1 text-[10px] font-mono transition-colors ${saveStatus === 'unsaved' ? 'text-warning' : 'text-text2'}`}>
                                {saveStatus === 'saving' && <RefreshCw size={10} className="animate-spin" />}
                                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved'}
                            </div>
                        )}
                        
                        <Button size="sm" onClick={handleManualSave} disabled={saveStatus === 'saved' || saveStatus === 'saving'} variant="outline" className="h-6 text-[10px]">
                            Save
                        </Button>
                        <IconButton size="sm" onClick={handleDelete} className="hover:text-danger"><Trash2 size={14} /></IconButton>
                    </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="bg-danger/10 border border-danger/20 text-danger text-xs p-2 rounded flex items-center gap-2">
                        <AlertTriangle size={14} /> {errorMsg}
                    </div>
                )}

                {/* Primary Name */}
                <div>
                    <label className="text-[10px] uppercase text-text2 font-bold mb-1 block">Primary Name</label>
                    <Input 
                        className="text-lg font-bold bg-panel2 w-full"
                        value={localTerm.primaryName} 
                        onChange={(e) => handleFieldChange({ primaryName: e.target.value })}
                        placeholder="Term Name"
                        autoFocus={localTerm.primaryName.startsWith('Untitled Term')}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Aliases */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-text2 uppercase font-bold">Aliases</label>
                        <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                            {localTerm.aliases.map(a => (
                                <div key={a} className="flex items-center gap-1 bg-panel2 border border-border px-2 py-0.5 rounded text-xs group">
                                    <span>{a}</span>
                                    <button onClick={() => removeAlias(a)} className="hover:text-danger text-text2"><X size={10} /></button>
                                </div>
                            ))}
                            <div className="flex items-center gap-1">
                                <input 
                                    className="bg-transparent border-b border-border text-xs w-[100px] focus:outline-none focus:border-accent placeholder:text-text2/50 py-0.5"
                                    placeholder="+ Add alias"
                                    value={newAlias}
                                    onChange={(e) => setNewAlias(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addAlias()}
                                    onBlur={addAlias}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Universes */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-text2 uppercase font-bold flex items-center gap-1">
                            <Globe size={10} /> Scopes
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {workspace.settings.universeTags.tags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleUniverse(tag)}
                                    className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${
                                        localTerm.universeScopes.includes(tag) 
                                        ? 'bg-accent/20 border-accent text-accent' 
                                        : 'bg-panel border-transparent text-text2 hover:bg-surface hover:text-text'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Definition Editor */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="flex-1 overflow-hidden relative">
                    <HybridEditor 
                        ref={editorRef}
                        doc={localContent}
                        noteId={termId} 
                        onDocChange={handleContentChange}
                        workspace={workspace}
                        onOpenNote={onOpenNote}
                        onOpenTerm={onOpenTerm}
                        linkMode="glossary" 
                    />
                </div>

                {/* Mentions Footer */}
                <div className="flex-shrink-0 border-t border-border bg-panel">
                    <button 
                        onClick={handleOpenMentionsWidget}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-panel2 transition-colors group"
                        title="Open Occurrences Widget"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text2 group-hover:text-text">
                            <MessageSquare size={14} className={mentionCount > 0 ? "text-accent" : ""} />
                            Mentions
                            <span className="bg-surface px-1.5 rounded text-[10px] opacity-70">{mentionCount}</span>
                        </div>
                        <div className="text-[10px] text-accent font-bold opacity-0 group-hover:opacity-100">OPEN WIDGET</div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlossaryEntryView;
import { X } from 'lucide-react';
