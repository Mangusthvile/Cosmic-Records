
import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEditorContext } from './EditorContext';
import { BookOpen } from 'lucide-react';

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
            fallbackText: { default: null }
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

    addProseMirrorPlugins() {
        return [];
    }
});

const GlossaryLinkComponent: React.FC<any> = ({ node }) => {
    const { workspace, onOpenTerm } = useEditorContext();
    const { termId, display, fallbackText } = node.attrs;
    const term = workspace.glossary.terms[termId];
    
    // Dispatch event for Definer widget (secondary/hover)
    const handleMouseEnter = () => {
        if (term) {
            window.dispatchEvent(new CustomEvent('glossary-hover', { detail: { termId } }));
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Primary Action: Open Tab
        if (onOpenTerm && termId) {
            onOpenTerm(termId);
        } else {
            // Fallback: Widget event
            window.dispatchEvent(new CustomEvent('glossary-click', { detail: { termId } }));
        }
    };

    const handleRightClick = (e: React.MouseEvent) => {
        // Optional: Context menu could be handled here
    };

    const label = display || (term ? term.primaryName : fallbackText) || "Unknown Term";

    return (
        <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5 select-none">
            <span 
                onMouseEnter={handleMouseEnter}
                onClick={handleClick}
                onContextMenu={handleRightClick}
                className={`
                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.9em] font-medium transition-colors cursor-pointer border
                    bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20
                `}
                title={term ? `Open: ${term.primaryName}` : "Missing Glossary Term"}
            >
                <BookOpen size={10} className="opacity-70" />
                <span className="truncate max-w-[200px]">{label}</span>
            </span>
        </NodeViewWrapper>
    );
};
