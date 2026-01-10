
import React, { useState, useEffect, useRef } from 'react';
import { GlossaryTerm, Workspace, GlossaryEntryTab } from '../../types';
import { Book, X, Save, Trash2, Plus, RefreshCw } from 'lucide-react';
import { Button, Input, IconButton, Badge } from '../ui/Primitives';
import HybridEditor, { HybridEditorHandle } from '../editor/HybridEditor';
import { glossaryService } from '../../services/glossaryService';

interface GlossaryEntryViewProps {
    tab: GlossaryEntryTab;
    workspace: Workspace;
    onUpdateWorkspace: (ws: Workspace) => void;
    onCloseSelf: () => void;
    onOpenNote: (id: string) => void;
}

const GlossaryEntryView: React.FC<GlossaryEntryViewProps> = (props) => {
    const { tab, workspace, onUpdateWorkspace, onCloseSelf, onOpenNote } = props;
    const payload = tab.payload;
    const termId = payload.termId;
    
    const term = workspace.glossary.terms[termId];
    
    // If deleted remotely or missing
    if (!term) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text2">
                <Book size={48} className="opacity-20 mb-4" />
                <p>Term not found.</p>
                <Button onClick={onCloseSelf} className="mt-4">Close Tab</Button>
            </div>
        );
    }

    const [localTerm, setLocalTerm] = useState<GlossaryTerm>(term);
    const [newAlias, setNewAlias] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const editorRef = useRef<HybridEditorHandle>(null);

    // Sync from prop
    useEffect(() => {
        if (workspace.glossary.terms[termId]) {
            setLocalTerm(workspace.glossary.terms[termId]);
        }
    }, [workspace, termId]);

    const handleSave = () => {
        setIsSaving(true);
        glossaryService.updateTerm(workspace, localTerm);
        onUpdateWorkspace({ ...workspace });
        setIsSaving(false);
    };

    const handleDelete = () => {
        if (confirm(`Delete term "${term.term}"?`)) {
            glossaryService.deleteTerm(workspace, termId);
            onUpdateWorkspace({ ...workspace });
            onCloseSelf();
        }
    };

    const updateTerm = (partial: Partial<GlossaryTerm>) => {
        setLocalTerm(prev => ({ ...prev, ...partial }));
    };

    const addAlias = () => {
        if (newAlias.trim() && !localTerm.aliases.includes(newAlias.trim())) {
            updateTerm({ aliases: [...localTerm.aliases, newAlias.trim()] });
            setNewAlias('');
        }
    };

    const removeAlias = (alias: string) => {
        updateTerm({ aliases: localTerm.aliases.filter(a => a !== alias) });
    };

    const toggleUniverseTag = (tag: string) => {
        const current = localTerm.universeTags || [];
        if (current.includes(tag)) {
            updateTerm({ universeTags: current.filter(t => t !== tag) });
        } else {
            updateTerm({ universeTags: [...current, tag] });
        }
    };

    const handleContentChange = (doc: any) => {
        updateTerm({ definitionDoc: doc });
    };

    return (
        <div className="flex flex-col h-full bg-deep-space text-text overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-border bg-panel relative">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 mr-4">
                        <label className="text-[10px] font-bold text-text2 uppercase mb-1 block">Term Name</label>
                        <input 
                            className="w-full bg-transparent text-2xl font-bold text-accent focus:outline-none border-b border-transparent focus:border-accent placeholder:text-accent/30"
                            value={localTerm.term}
                            onChange={(e) => updateTerm({ term: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <RefreshCw size={14} className="animate-spin mr-1"/> : <Save size={14} className="mr-1"/>}
                            Save
                        </Button>
                        <IconButton size="sm" variant="danger" onClick={handleDelete}><Trash2 size={14}/></IconButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Aliases */}
                    <div>
                        <label className="text-[10px] font-bold text-text2 uppercase mb-1 block">Aliases</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {localTerm.aliases.map(alias => (
                                <span key={alias} className="inline-flex items-center px-2 py-1 rounded bg-panel2 border border-border text-xs text-text">
                                    {alias}
                                    <button onClick={() => removeAlias(alias)} className="ml-1 hover:text-danger"><X size={10}/></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add alias..." 
                                value={newAlias} 
                                onChange={(e) => setNewAlias(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && addAlias()}
                                className="h-7 text-xs"
                            />
                            <Button size="sm" onClick={addAlias}><Plus size={14}/></Button>
                        </div>
                    </div>

                    {/* Universe Tags */}
                    <div>
                        <label className="text-[10px] font-bold text-text2 uppercase mb-1 block">Universe Context</label>
                        <div className="flex flex-wrap gap-1">
                            {workspace.settings.universeTags.tags.map(tag => {
                                const active = localTerm.universeTags?.includes(tag);
                                return (
                                    <button 
                                        key={tag}
                                        onClick={() => toggleUniverseTag(tag)}
                                        className={`px-2 py-1 rounded text-[10px] border transition-colors ${active ? 'bg-accent/20 border-accent text-accent' : 'bg-panel border-border text-text2 hover:bg-panel2'}`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                <div className="absolute top-2 right-2">
                    <Badge variant="success">CANON</Badge>
                </div>
            </div>

            {/* Definition Editor */}
            <div className="flex-1 overflow-hidden relative bg-bg">
                <HybridEditor 
                    ref={editorRef}
                    doc={localTerm.definitionDoc}
                    noteId={`glossary-${termId}`} // Virtual ID for editor keying
                    onDocChange={handleContentChange}
                    workspace={workspace}
                    onOpenNote={onOpenNote}
                    readOnly={false}
                />
            </div>
        </div>
    );
};

export default GlossaryEntryView;
