
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import LinkList from './LinkList';
import { Workspace } from '../../types';
import { ensureUnresolvedNote } from '../../services/storageService';

export const getSuggestionOptions = (workspace: Workspace, currentNoteId: string) => ({
    char: '[[',
    allowSpaces: true,
    items: ({ query }: { query: string }) => {
        const normalizedQuery = query.toLowerCase().trim();
        const results = [];
        const exactMatchExists = !!workspace.indexes.title_to_note_id[query.trim()];

        // Filter existing notes
        // Limit to 10 results for performance
        const matchedNotes = Object.values(workspace.notes)
            .filter(note => note.title.toLowerCase().includes(normalizedQuery))
            .slice(0, 10)
            .map(note => ({
                title: note.title,
                id: note.id,
                status: note.status,
                unresolved: note.unresolved,
                isCreate: false
            }));
        
        results.push(...matchedNotes);

        // Add "Create" option if query is not empty and no exact match (or always to allow duplicates/variants?)
        // Better UX: Always offer create if it doesn't exactly match an existing title, 
        // OR if the user explicitly wants to create a new note with similar name.
        // For simplicity: If no EXACT match found, offer create.
        if (query.trim().length > 0 && !exactMatchExists) {
            results.push({
                title: query.trim(),
                id: null,
                isCreate: true
            });
        }

        return results;
    },

    render: () => {
        let component: ReactRenderer<any> | null = null;
        let popup: any | null = null;

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(LinkList, {
                    props: props,
                    editor: props.editor,
                });

                if (!props.clientRect) {
                    return;
                }

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                });
            },

            onUpdate(props: any) {
                component?.updateProps(props);

                if (!props.clientRect) {
                    return;
                }

                popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                });
            },

            onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                    popup[0].hide();
                    return true;
                }
                // Pass key events to React component for navigation
                return component?.ref?.onKeyDown(props);
            },

            onExit() {
                popup[0].destroy();
                component?.destroy();
            },
        };
    },
    
    // Command executed when item selected
    command: ({ editor, range, props }: any) => {
        let targetId = props.id;
        
        // Handle "Create New"
        if (props.isCreate) {
            // Create unresolved note
            targetId = ensureUnresolvedNote(workspace, props.title, currentNoteId);
        }

        // Insert the InternalLink node
        editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
                type: 'internalLink',
                attrs: {
                    targetId: targetId,
                    display: null, // Display matches title by default unless overridden later
                    fallbackTitle: props.title
                }
            })
            .run();
    }
});
