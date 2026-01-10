

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
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
import { MathBlock, CollapsibleBlock, CollapsibleSummary, CollapsibleContent, HeadingId } from './Extensions';
import { SearchExtension, SearchPluginKey } from './SearchExtension';
import { InternalLink } from './InternalLink';
import { GlossaryLink } from './GlossaryLink';
import { getSuggestionOptions } from './LinkSuggestion';
import { EditorContextProvider } from './EditorContext';
import { vaultService, noteContentToPlainText } from '../../services/vaultService';
import { migrateContent } from '../../services/dataMigration';
import { Workspace, Note } from '../../types';
import { ensureUnresolvedNote, normalizeKey, lookupGlossaryTermId, addPendingTerm } from '../../services/storageService';
import { Button } from '../ui/Primitives';
import DefinerTooltip from '../DefinerTooltip';

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
    onOpenTerm?: (id: string) => void;
    onSearchStateChange?: (state: { index: number, count: number }) => void;
    linkMode?: 'note' | 'glossary'; 
}

interface GlossarySuggestionState {
    visible: boolean;
    termId: string;
    termName: string;
    range: { from: number; to: number };
    position: { x: number; y: number };
    text: string;
}

interface DefinerState {
    visible: boolean;
    x: number;
    y: number;
    text: string;
    termId: string | null;
    isManualTrigger: boolean; // If true, show "Add to Pending" if no match
}

const HybridEditor = forwardRef<HybridEditorHandle, HybridEditorProps>(({ 
    doc, noteId, onDocChange, readOnly = false, workspace, 
    onOpenNote, onOpenTerm, onSearchStateChange, linkMode = 'note' 
}, ref) => {
    
    const [glossarySuggestion, setGlossarySuggestion] = useState<GlossarySuggestionState | null>(null);
    const [definerState, setDefinerState] = useState<DefinerState | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Prepare Content (Resolve Paths + Migrate Legacy)
    const prepareContent = async (rawContent: any) => {
        const existingNote = workspace.notes[noteId];
        // If noteId is actually a termId, create a fake note container for migration utils
        const note: Note = existingNote || { 
            id: noteId, 
            content: rawContent, 
            title: 'Term', 
            status: 'Canon',
            type: 'General',
            unresolved: false,
            universeTag: null,
            folderId: 'glossary',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false,
            tag_ids: []
        };
        
        const noteWithCurrentContent = { ...note, content: rawContent };
        const { doc: migratedDoc, changed } = migrateContent(noteWithCurrentContent, workspace);
        
        if (changed) {
            setTimeout(() => onDocChange(migratedDoc), 0);
        }

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

    // Extension Configuration
    const extensions = [
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
        Placeholder.configure({ placeholder: linkMode === 'glossary' ? 'Define this term...' : 'Type "/" for commands or "[[" to link...' }),
        HeadingId,
        MathBlock,
        CollapsibleBlock,
        CollapsibleSummary,
        CollapsibleContent,
        SearchExtension.configure({
            searchTerm: '',
            results: [],
            index: 0,
        }),
        // Internal Link (Wiki Links) - Only in note mode
        linkMode === 'note' ? InternalLink.configure({
            suggestion: getSuggestionOptions(workspace, noteId),
            resolver: (title) => workspace.indexes.title_to_note_id[title],
            onUnknownTitle: (title) => ensureUnresolvedNote(workspace, title, noteId)
        }) : null,
        // Glossary Link (Internal to glossary logic)
        GlossaryLink
    ].filter(Boolean);

    const editor = useEditor({
        extensions: extensions as any,
        content: { type: 'doc', content: [] }, // Initial empty, loaded via effect
        onUpdate: ({ editor }) => {
            onDocChange(editor.getJSON());
            
            // Search State Update
            const searchState = SearchPluginKey.getState(editor.state);
            if (searchState && onSearchStateChange) {
                onSearchStateChange({ index: searchState.index, count: searchState.results.length });
            }

            // Glossary Scanning (Only in glossary mode - separate from Definer Tooltip)
            if (linkMode === 'glossary') {
                scanForGlossaryTerms(editor);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            if (linkMode === 'glossary') {
                scanForGlossaryTerms(editor);
            }
            // Clear tooltip on selection change (prevents stale tooltips)
            setDefinerState(null);
        },
        editable: !readOnly,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none text-text max-w-none',
            },
        },
    }, [noteId, readOnly, linkMode]); // Re-create if mode changes

    // Load Content Effect
    useEffect(() => {
        if (editor && doc) {
            prepareContent(doc).then(prepared => {
                const currentJSON = JSON.stringify(editor.getJSON());
                const newJSON = JSON.stringify(prepared);
                if (currentJSON !== newJSON) {
                    // Use editor.setContent which supports emitUpdate: false
                    // This prevents the onUpdate callback from firing, avoiding loops.
                    (editor as any).setContent(prepared, false);
                }
            });
        }
    }, [doc, noteId, editor]);

    // Imperative Handle
    useImperativeHandle(ref, () => ({
        setSearchTerm: (term: string) => editor?.commands.setSearchTerm(term),
        findNext: () => editor?.commands.findNext(),
        findPrevious: () => editor?.commands.findPrevious(),
        clearSearch: () => editor?.commands.clearSearch(),
        getSearchState: () => {
            if (!editor) return { index: 0, count: 0 };
            const state = SearchPluginKey.getState(editor.state);
            return { index: state?.index || 0, count: state?.results.length || 0 };
        }
    }));

    // --- Definer Logic (Hover & Hotkey) ---

    // Hover Event Listener
    useEffect(() => {
        if (!editor || !editor.view) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Debounce
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            
            // Ignore if dragging or if user typed recently (simple approximation: no typing event listener here, but debounce helps)
            if (e.buttons > 0) return; // Dragging

            hoverTimeoutRef.current = setTimeout(() => {
                const view = editor.view;
                const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
                
                if (pos) {
                    const $pos = view.state.doc.resolve(pos.pos);
                    // Extract word at hover position
                    // We need to find word boundaries.
                    // Simple logic: grab text node, regex for word around offset
                    const textNode = $pos.parent.child($pos.index());
                    if (textNode.isText && textNode.text) {
                        const offsetInNode = $pos.parentOffset - ($pos.nodeBefore ? $pos.nodeBefore.nodeSize : 0); // Approximation, offset is absolute in parent
                        // Correct way: use resolved pos info
                        // pos.pos is absolute. 
                        // Let's get the range of the word at pos.
                        const resolvedPos = view.state.doc.resolve(pos.pos);
                        
                        // Use regex to find word boundaries around offset
                        // Text node start pos:
                        const start = resolvedPos.start();
                        const text = resolvedPos.parent.textContent;
                        const offset = resolvedPos.pos - start;
                        
                        // Regex to grab word around cursor
                        // Matches letters, numbers, apostrophes, hyphens
                        const wordRegex = /[\w-']+/g;
                        let match;
                        let foundWord = null;
                        
                        while ((match = wordRegex.exec(text)) !== null) {
                            if (match.index <= offset && match.index + match[0].length >= offset) {
                                foundWord = match[0];
                                break;
                            }
                        }

                        if (foundWord) {
                            const termId = lookupGlossaryTermId(workspace, foundWord);
                            if (termId) {
                                setDefinerState({
                                    visible: true,
                                    x: e.clientX,
                                    y: e.clientY,
                                    text: foundWord,
                                    termId,
                                    isManualTrigger: false
                                });
                                return;
                            }
                        }
                    }
                }
                
                // If we get here, no match or no hover. Clear unless it was manual trigger locked? 
                // Hover tooltip should disappear if we move away.
                // We only clear if we are NOT over the tooltip itself (handled by pointer-events in tooltip or portal logic?)
                // DefinerTooltip uses portal. We can't detect hover on it easily from here.
                // Actually, if we move the mouse, we update. If we move to empty space, we clear.
                setDefinerState(null);

            }, 100); // 100ms Debounce
        };

        const dom = editor.view.dom;
        dom.addEventListener('mousemove', handleMouseMove);
        return () => {
            dom.removeEventListener('mousemove', handleMouseMove);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, [editor, workspace]);

    // Hotkey Listener (Ctrl+D)
    useEffect(() => {
        if (!editor) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
                e.preventDefault();
                // Trigger Definition
                const selection = editor.state.selection;
                let text = "";
                
                if (!selection.empty) {
                    text = editor.state.doc.textBetween(selection.from, selection.to);
                } else {
                    // Grab word at cursor
                    const $pos = editor.state.selection.$from;
                    // Similar logic to hover, but simpler selection expansion?
                    // Use TipTap text expansion?
                    // We'll reimplement simple word grabber from range
                    const range = editor.state.doc.resolve(selection.from);
                    const start = range.start();
                    const fullText = range.parent.textContent;
                    const offset = selection.from - start;
                    const wordRegex = /[\w-']+/g;
                    let match;
                    while ((match = wordRegex.exec(fullText)) !== null) {
                        if (match.index <= offset && match.index + match[0].length >= offset) {
                            text = match[0];
                            break;
                        }
                    }
                }

                if (text) {
                    const termId = lookupGlossaryTermId(workspace, text);
                    const coords = editor.view.coordsAtPos(selection.from);
                    setDefinerState({
                        visible: true,
                        x: coords.left,
                        y: coords.bottom,
                        text,
                        termId,
                        isManualTrigger: true // Always show, even if no match
                    });
                }
            }
        };

        const dom = editor.view.dom;
        dom.addEventListener('keydown', handleKeyDown);
        return () => dom.removeEventListener('keydown', handleKeyDown);
    }, [editor, workspace]);

    // Definer Actions
    const handleOpenDefinition = () => {
        if (definerState?.termId) {
            // Open Definition Widget with term
            // We need to trigger widget state update. 
            // We don't have direct access to widget state setter here.
            // We can dispatch an event or use the EditorContext if we expand it.
            // Dispatch custom event which App/WidgetBar listens to?
            // Existing 'glossary-click' event was used for this. Let's reuse or add 'open-definition'.
            window.dispatchEvent(new CustomEvent('open-definition', { detail: { termId: definerState.termId } }));
            setDefinerState(null);
        }
    };

    const handleAddToPending = () => {
        if (definerState?.text) {
            addPendingTerm(workspace, definerState.text, { 
                noteId, 
                snippet: "Added from editor selection." // Could improve snippet extraction
            });
            // Show feedback? Storage logs notification.
            setDefinerState(null);
        }
    };

    // --- Legacy Glossary Scanner Logic (for auto-linking in glossary mode) ---
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scanForGlossaryTerms = (editorInstance: any) => {
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        
        scanTimeoutRef.current = setTimeout(() => {
            if (editorInstance.state.selection.empty) {
                const { from } = editorInstance.state.selection;
                const $pos = editorInstance.state.doc.resolve(from);
                
                // Only scan if in text block
                if (!$pos.parent.isTextblock) return setGlossarySuggestion(null);

                // Get text before cursor (up to 50 chars)
                const textBefore = $pos.parent.textBetween(Math.max(0, $pos.parentOffset - 50), $pos.parentOffset, undefined, '\ufffc');
                if (!textBefore) return setGlossarySuggestion(null);

                // Ignore if we are already inside a link node (check marks/nodes at pos)
                const nodeBefore = $pos.nodeBefore;
                if (nodeBefore && (nodeBefore.type.name === 'glossaryLink' || nodeBefore.type.name === 'internalLink')) {
                    return setGlossarySuggestion(null);
                }

                // Scan for matches
                const lookup = workspace.glossary.index.lookup;
                let found: GlossarySuggestionState | null = null;

                // Check suffixes
                for (let i = textBefore.length - 1; i >= 0; i--) {
                    const sub = textBefore.substring(i);
                    // Skip if splitting a word
                    const charBefore = i > 0 ? textBefore[i-1] : null;
                    if (charBefore && /[\w-]/.test(charBefore)) continue; 

                    const normalized = normalizeKey(sub);
                    if (!normalized) continue;
                    
                    const termId = lookup[normalized];
                    if (termId) {
                        // Found a match
                        const term = workspace.glossary.terms[termId];
                        // Don't suggest self-linking (if editing term definition)
                        if (termId === noteId) continue; 
                        
                        const coords = editorInstance.view.coordsAtPos(from);
                        found = {
                            visible: true,
                            termId,
                            termName: term.primaryName,
                            text: sub,
                            range: { from: from - sub.length, to: from },
                            position: { x: coords.left, y: coords.bottom }
                        };
                    }
                }
                setGlossarySuggestion(found);
            } else {
                setGlossarySuggestion(null);
            }
        }, 300); // 300ms debounce
    };

    const confirmGlossaryLink = () => {
        if (!editor || !glossarySuggestion) return;
        
        editor.chain()
            .focus()
            .deleteRange(glossarySuggestion.range)
            .insertContent({
                type: 'glossaryLink',
                attrs: {
                    termId: glossarySuggestion.termId,
                    display: glossarySuggestion.text
                }
            })
            .run();
        
        setGlossarySuggestion(null);
    };

    const dismissGlossaryLink = () => {
        setGlossarySuggestion(null);
    };

    // Helper to get preview text from term
    const getDefinitionPreview = (termId: string | null) => {
        if (!termId) return undefined;
        const term = workspace.glossary.terms[termId];
        if (!term) return undefined;
        const plain = noteContentToPlainText({ content: term.definitionRichText });
        return plain.substring(0, 150) + (plain.length > 150 ? '...' : '');
    };

    return (
        <EditorContextProvider value={{ workspace, onOpenNote, onOpenTerm }}>
            <div className="relative group/editor flex flex-col h-full">
                {!readOnly && <MenuBar editor={editor} noteId={noteId} />}
                <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
                
                {/* Glossary Suggestion Popover (Legacy Mode) */}
                {glossarySuggestion && !readOnly && (
                    <div 
                        className="fixed z-[100] bg-panel border border-accent rounded shadow-xl p-2 flex flex-col gap-2 animate-in fade-in zoom-in-95"
                        style={{ left: glossarySuggestion.position.x, top: glossarySuggestion.position.y + 10 }}
                    >
                        <div className="text-xs text-text whitespace-nowrap">
                            Link to <span className="font-bold text-accent">{glossarySuggestion.termName}</span>?
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={dismissGlossaryLink} className="h-6 px-2 text-[10px]">Ignore</Button>
                            <Button size="sm" onClick={confirmGlossaryLink} className="h-6 px-2 text-[10px]">Link</Button>
                        </div>
                    </div>
                )}

                {/* Definer Tooltip (Global) */}
                {definerState && (definerState.termId || definerState.isManualTrigger) && (
                    <DefinerTooltip 
                        x={definerState.x}
                        y={definerState.y}
                        termId={definerState.termId}
                        text={definerState.text}
                        definitionPreview={getDefinitionPreview(definerState.termId)}
                        universeScopes={definerState.termId ? workspace.glossary.terms[definerState.termId]?.universeScopes : undefined}
                        onOpenDefinition={handleOpenDefinition}
                        onAddToPending={handleAddToPending}
                        onClose={() => setDefinerState(null)}
                    />
                )}
            </div>
        </EditorContextProvider>
    );
});

export default HybridEditor;
