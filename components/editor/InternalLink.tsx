
import React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { useEditorContext } from './EditorContext';
import { Link2, AlertTriangle, AlertCircle } from 'lucide-react';

export const InternalLink = Node.create({
    name: 'internalLink',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true, // Treated as a single unit

    addAttributes() {
        return {
            targetId: {
                default: null,
            },
            display: {
                default: null,
            },
            fallbackTitle: {
                default: null, // For offline/broken index scenarios
            }
        };
    },

    parseHTML() {
        return [{
            tag: 'span[data-type="internal-link"]',
        }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'internal-link' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(InternalLinkComponent);
    },

    addProseMirrorPlugins() {
        // If suggestion options passed via configure, use them
        if (this.options.suggestion) {
            return [
                Suggestion({
                    editor: this.editor,
                    ...this.options.suggestion,
                }),
            ];
        }
        return [];
    },

    addInputRules() {
        return [
            // Matches [[Title]] or [[Title]](Display)
            // Group 1: Title
            // Group 2: (Display) optional group
            // Group 3: Display text
            new InputRule({
                find: /\[\[([^\]]+)\]\](\(([^)]+)\))?$/,
                handler: (props) => {
                    const { state, range, match } = props;
                    const title = match[1];
                    const display = match[3]; // Group 3 contains the text inside parens
                    const tr = state.tr;
                    
                    const resolver = this.options.resolver;
                    let id = resolver ? resolver(title) : null;

                    if (!id && this.options.onUnknownTitle) {
                        // Auto-create if missing
                        id = this.options.onUnknownTitle(title);
                    }

                    if (id) {
                        tr.replaceWith(range.from, range.to, this.type.create({ 
                            targetId: id,
                            display: display || null,
                            fallbackTitle: title
                        }));
                    }
                },
            }),
        ];
    },
});

const InternalLinkComponent: React.FC<any> = ({ node }) => {
    const context = useEditorContext();
    const { workspace, onOpenNote } = context;
    
    const attrs = node.attrs || {};
    const targetId = attrs.targetId;
    const display = attrs.display;
    const fallbackTitle = attrs.fallbackTitle;

    const note = workspace.notes[targetId];
    
    // Canonical title comes from the live workspace index (reacts to renames)
    const canonicalTitle = note ? note.title : fallbackTitle || "Missing Note";
    const isMissing = !note && targetId;
    const isUnresolved = note?.unresolved;

    // Display preference: Custom Display Text > Canonical Title
    const label = display || canonicalTitle;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent editor selection from messing up
        if (targetId) onOpenNote(targetId);
    };

    let tooltip = "";
    if (isMissing) {
        tooltip = "Missing: note file not found in index";
    } else if (isUnresolved) {
        tooltip = "Unresolved: this note was auto-created from a missing link";
    } else {
        tooltip = `Open: ${canonicalTitle}`;
        if (display && display !== canonicalTitle) {
             tooltip = `Links to: ${canonicalTitle}`;
        }
    }

    return (
        <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5 select-none">
            <span 
                onClick={handleClick}
                className={`
                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.9em] font-medium transition-colors cursor-pointer border
                    ${isMissing 
                        ? 'bg-zinc-800 text-muted border-zinc-700 hover:bg-zinc-700' 
                        : isUnresolved
                            ? 'bg-danger/10 text-danger border-danger/30 hover:bg-danger/20'
                            : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                    }
                `}
                title={tooltip}
            >
                {isMissing && <AlertCircle size={10} />}
                {isUnresolved && <AlertTriangle size={10} className="animate-pulse" />}
                {!isMissing && !isUnresolved && <Link2 size={10} className="opacity-50" />}
                <span className="truncate max-w-[200px]">{label}</span>
            </span>
        </NodeViewWrapper>
    );
};
