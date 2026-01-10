
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import MenuBar from './MenuBar';
import { MathBlock, CollapsibleBlock, CollapsibleSummary, CollapsibleContent, HeadingId, GlossaryLink } from './Extensions';
import { SearchExtension, SearchPluginKey } from './SearchExtension';
import { InternalLink } from './InternalLink';
import { getSuggestionOptions } from './LinkSuggestion';
import { EditorContextProvider } from './EditorContext';
import { vaultService } from '../../services/vaultService';
import { migrateContent } from '../../services/dataMigration';
import { Workspace } from '../../types';
import { ensureUnresolvedNote } from '../../services/storageService';

export interface HybridEditorHandle {
    setSearchTerm: (term: string) => void;
    findNext: () => void;
    findPrevious: () => void;
    clearSearch: () => void;
    getSearchState: () => { index: number, count: number };
}

interface HybridEditorProps {
    doc: any; // TipTap JSON or legacy
    noteId: string;
    onDocChange: (doc: any) => void;
    readOnly?: boolean;
    workspace: Workspace; // Needed for migration and linking
    onOpenNote: (id: string) => void;
    onSearchStateChange?: (state: { index: number, count: number }) => void;
}

const HybridEditor = forwardRef<HybridEditorHandle, HybridEditorProps>(({ doc, noteId, onDocChange, readOnly = false, workspace, onOpenNote, onSearchStateChange }, ref) => {
    
    // 1. Prepare Content (Resolve Paths + Migrate Legacy)
    const prepareContent = async (rawContent: any) => {
        // Migration Pass (v1/string -> v2)
        // If it's a glossary term, we might need dummy note? Or check type.
        // For glossary terms, noteId starts with 'glossary-'
        if (noteId.startsWith('glossary-')) {
             return rawContent || { type: 'doc', content: [] };
        }

        const note = workspace.notes[noteId];
        // Ensure we pass the note object with correct content to migration
        const noteWithCurrentContent = { ...note, content: rawContent };
        const { doc: migratedDoc, changed } = migrateContent(noteWithCurrentContent, workspace);
        
        if (changed) {
            setTimeout(() => onDocChange(migratedDoc), 0);
        }

        // Image Path Resolution Pass (Deep Clone)
        const processed = JSON.parse(JSON.stringify(migratedDoc));
        const traverse = async (node: any) => {
            if (node.type === 'image' && node.attrs && node.attrs.title) {
                const path = node.attrs.title;
                if (path.startsWith('Attachments/')) {
                    const blob = await vaultService.getAttachmentUrl(path);
                    if (blob) node.attrs.src = blob;
                }
            }
            if (node.content) {
                await Promise.all(node.content.map(traverse));
            }
        };
        await traverse(processed);
        
        return processed;
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Link.configure({ openOnClick: false }),
            Image.configure({ inline: true }),
            (Table as any).configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            TaskList,
            TaskItem.configure({ nested: true }),
            Subscript,
            Superscript,
            Placeholder.configure({ placeholder: 'Start writing...' }),
            MathBlock,
            CollapsibleBlock,
            CollapsibleSummary,
            CollapsibleContent,
            HeadingId,
            SearchExtension,
            GlossaryLink,
            InternalLink.configure({
                resolver: (title: string) => workspace.indexes.title_to_note_id[title],
                onUnknownTitle: (title: string) => {
                    // Only auto-create if not in Glossary Mode
                    if (noteId.startsWith('glossary-')) return null;
                    return ensureUnresolvedNote(workspace, title, noteId);
                },
                suggestion: getSuggestionOptions(workspace, noteId),
            }),
        ],
        editable: !readOnly,
        content: { type: 'doc', content: [] }, 
        onUpdate: ({ editor }) => {
            onDocChange(editor.getJSON());
        },
        onTransaction: ({ editor, transaction }) => {
            // Report search state changes
            if (transaction.getMeta('search') || transaction.docChanged) {
                const pluginState = SearchPluginKey.getState(editor.state);
                if (pluginState && onSearchStateChange) {
                    onSearchStateChange({ 
                        index: pluginState.index, 
                        count: pluginState.results.length 
                    });
                }
            }
        }
    });

    useImperativeHandle(ref, () => ({
        setSearchTerm: (term: string) => editor?.commands.setSearchTerm(term),
        findNext: () => editor?.commands.findNext(),
        findPrevious: () => editor?.commands.findPrevious(),
        clearSearch: () => editor?.commands.clearSearch(),
        getSearchState: () => {
            const state = editor ? SearchPluginKey.getState(editor.state) : null;
            return state ? { index: state.index, count: state.results.length } : { index: 0, count: 0 };
        }
    }), [editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly);
        }
    }, [editor, readOnly]);

    const lastNoteId = useRef(noteId);
    useEffect(() => {
        if (editor && noteId !== lastNoteId.current) {
            lastNoteId.current = noteId;
            prepareContent(doc).then(processed => {
                // @ts-ignore
                editor.commands.setContent(processed, { emitUpdate: false });
            });
        }
    }, [doc, editor, noteId]);

    // Initial Load
    useEffect(() => {
        if (editor && editor.isEmpty && doc) {
             prepareContent(doc).then(processed => {
                // @ts-ignore
                editor.commands.setContent(processed, { emitUpdate: false });
            });
        }
    }, [editor]);

    // Scroll to Heading Listener
    useEffect(() => {
        const handleScroll = (e: CustomEvent) => {
            if (!editor) return;
            if (e.detail.noteId !== noteId) return;
            
            const headingId = e.detail.headingId;
            let targetPos = null;
            
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'heading' && node.attrs.id === headingId) {
                    targetPos = pos;
                    return false; 
                }
                return true;
            });

            if (targetPos !== null) {
                editor.commands.setTextSelection(targetPos);
                editor.commands.scrollIntoView();
                editor.commands.focus();
            }
        };

        window.addEventListener('scroll-to-heading', handleScroll as any);
        return () => window.removeEventListener('scroll-to-heading', handleScroll as any);
    }, [editor, noteId]);

    return (
        <EditorContextProvider value={{ workspace, onOpenNote }}>
            <div className="flex flex-col h-full bg-deep-space">
                {!readOnly && <MenuBar editor={editor} noteId={noteId} />}
                <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:px-16 max-w-4xl mx-auto w-full">
                    <EditorContent editor={editor} className="prose prose-invert max-w-none focus:outline-none" />
                </div>
            </div>
        </EditorContextProvider>
    );
});

export default HybridEditor;
