
import React from 'react';
import { WidgetProps } from './WidgetRegistry';
import { BookOpen, Edit3, Globe, ExternalLink } from 'lucide-react';
import { noteContentToPlainText } from '../../services/vaultService';
import { Button } from '../ui/Primitives';

interface DefinitionWidgetState {
    selectedTermId: string | null;
}

const DefinitionWidget: React.FC<WidgetProps> = ({ workspace, activeNoteId, activeTab, onOpenTerm, state, onStateChange }) => {
    const { selectedTermId } = (state || {}) as DefinitionWidgetState;
    
    // Try to get full term
    const term = selectedTermId ? workspace.glossary.terms[selectedTermId] : null;
    
    // Fallback to index if full term not loaded (though in current architecture it usually is)
    // or if we want to show at least the name while loading (if we had async loading)
    const indexTerm = selectedTermId ? workspace.glossary.index.terms[selectedTermId] : null;

    if (!term && !indexTerm) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted p-4 text-center space-y-2">
                <BookOpen size={24} className="opacity-30" />
                <p className="text-xs italic">Select a term to view its definition.</p>
            </div>
        );
    }

    const primaryName = term?.primaryName || indexTerm?.primaryName || "Unknown Term";
    const aliases = term?.aliases || indexTerm?.aliases || [];
    const scopes = term?.universeScopes || indexTerm?.universeScopes || [];
    const plainDef = term ? noteContentToPlainText({ content: term.definitionRichText }) : "Loading definition...";

    return (
        <div className="flex flex-col h-full bg-panel text-text overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-panel2/50 flex-shrink-0">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-lg font-bold leading-tight break-words">{primaryName}</h2>
                    {onOpenTerm && selectedTermId && (
                        <button 
                            onClick={() => onOpenTerm(selectedTermId)}
                            className="text-text2 hover:text-accent p-1 transition-colors"
                            title="Open Term Editor"
                        >
                            <Edit3 size={14} />
                        </button>
                    )}
                </div>
                
                {aliases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {aliases.map(a => (
                            <span key={a} className="text-[10px] text-text2 bg-panel border border-border px-1.5 py-0.5 rounded">
                                {a}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-1">
                    {scopes.map(scope => (
                        <span key={scope} className="flex items-center gap-1 text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                            <Globe size={10} /> {scope}
                        </span>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed text-text2">
                    {plainDef ? (
                        <div className="whitespace-pre-wrap">{plainDef}</div>
                    ) : (
                        <em className="text-muted opacity-50">No definition content.</em>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            {selectedTermId && (
                <div className="p-3 border-t border-border bg-panel flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => onOpenTerm(selectedTermId)} className="w-full flex items-center justify-center gap-2">
                        <ExternalLink size={12} /> Open Full Entry
                    </Button>
                </div>
            )}
        </div>
    );
};

export default DefinitionWidget;
