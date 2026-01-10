
import React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEditorContext } from './EditorContext';
import { Book } from 'lucide-react';

export const GlossaryLink = Node.create({
    name: 'glossaryLink',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            termId: { default: null },
            display: { default: null },
            fallbackTerm: { default: null }
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="glossary-link"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'glossary-link' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(GlossaryLinkComponent);
    },

    addInputRules() {
        // Matches {{Term}}
        return [
            new InputRule({
                find: /\{\{([^}]+)\}\}$/,
                handler: ({ state, range, match }) => {
                    // Placeholder for future implementation
                },
            }),
        ];
    },
});

const GlossaryLinkComponent: React.FC<any> = ({ node }) => {
    const { workspace } = useEditorContext();
    const { termId, display, fallbackTerm } = node.attrs;
    const term = workspace.glossary.terms[termId];
    
    const label = display || term?.term || fallbackTerm || "Unknown Term";
    const isMissing = !term;

    const tooltip = term ? `${term.term}: ${term.definition_plain?.substring(0, 100)}...` : "Term not found";

    return (
        <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5 select-none">
            <span 
                className={`
                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.9em] font-medium transition-colors cursor-help border
                    ${isMissing 
                        ? 'bg-zinc-800 text-muted border-zinc-700' 
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                    }
                `}
                title={tooltip}
            >
                <Book size={10} className="opacity-50" />
                <span className="truncate max-w-[200px]">{label}</span>
            </span>
        </NodeViewWrapper>
    );
};
