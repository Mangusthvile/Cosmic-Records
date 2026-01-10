
import React from 'react';
import { Tab, Workspace, Note, NoteTab, StarMapTab, GlossaryTab, SearchResultsTab, MissingTab, GlossaryEntryTab } from '../../types';
import NoteEditor from '../NoteEditor';
import StarMap from '../StarMap';
import GlossaryView from '../GlossaryView';
import GlossaryEntryView from './GlossaryEntryView';
import SearchResultsView from './SearchResultsView';
import { FileWarning, FileText, Globe, Book, Search, ZoomIn, ZoomOut, Maximize2, FileType } from 'lucide-react';
import { IconButton } from '../ui/Primitives';

// Registry Definition
export const ViewRegistry = {
    note: {
        component: ({ tab, workspace, onUpdateState, onUpdateNote, onGenerateTitle, onOpenNote, isFocusedPane }: any) => {
            const noteTab = tab as NoteTab;
            const note = workspace.notes[noteTab.payload.noteId];
            if (!note) return (
                <div className="flex flex-col items-center justify-center h-full space-y-4 bg-bg p-8">
                    <FileWarning size={48} className="text-danger opacity-50" />
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-text mb-1">Note Not Found</h3>
                        <p className="text-sm text-text2 max-w-md">The note ID {noteTab.payload.noteId} is not in the index.</p>
                    </div>
                </div>
            );
            return (
                <NoteEditor 
                    key={note.id} 
                    note={note}
                    workspace={workspace}
                    onUpdate={onUpdateNote}
                    onGenerateTitle={() => onGenerateTitle(note)}
                    readMode={noteTab.state.readMode}
                    onToggleReadMode={(enabled) => onUpdateState({ readMode: enabled })}
                    onOpenNote={onOpenNote}
                    isFocusedPane={isFocusedPane}
                />
            );
        },
        icon: FileText
    },
    starmap: {
        component: ({ tab, workspace, onUpdateState, onOpenNote }: any) => {
            const mapTab = tab as StarMapTab;
            return (
                <div className="relative w-full h-full group/map">
                     <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-panel/80 backdrop-blur p-2 rounded border border-border shadow-soft">
                        <div className="text-[10px] text-accent font-bold uppercase tracking-widest text-center">Zoom State</div>
                        <div className="flex items-center gap-2">
                             <IconButton size="sm" onClick={() => onUpdateState({ zoom: Math.max(0.5, mapTab.state.zoom - 0.1) })}><ZoomOut size={14} /></IconButton>
                             <div className="font-mono text-xs w-8 text-center text-text">{mapTab.state.zoom.toFixed(1)}x</div>
                             <IconButton size="sm" onClick={() => onUpdateState({ zoom: Math.min(3.0, mapTab.state.zoom + 0.1) })}><ZoomIn size={14} /></IconButton>
                        </div>
                     </div>
                    <StarMap workspace={workspace} onSelectNote={onOpenNote} />
                </div>
            );
        },
        icon: Globe
    },
    glossary: {
        component: ({ tab, workspace, onUpdateState }: any) => (
            <GlossaryView tab={tab as GlossaryTab} workspace={workspace} onUpdateState={onUpdateState} />
        ),
        icon: Book
    },
    glossary_entry: {
        component: ({ tab, workspace, onUpdateState, onCloseSelf, onUpdateWorkspace, onOpenNote }: any) => (
            <GlossaryEntryView 
                tab={tab as GlossaryEntryTab} 
                workspace={workspace} 
                onUpdateWorkspace={onUpdateWorkspace}
                onCloseSelf={onCloseSelf} 
                onOpenNote={onOpenNote}
            />
        ),
        icon: FileType
    },
    search: {
        component: ({ tab, workspace, onUpdateState, onOpenNote }: any) => (
            <SearchResultsView tab={tab as SearchResultsTab} workspace={workspace} onUpdateState={onUpdateState} onOpenNote={onOpenNote} />
        ),
        icon: Search
    },
    missing: {
        component: ({ tab, onCloseSelf }: any) => (
            <div className="flex flex-col items-center justify-center h-full space-y-4 bg-bg p-8">
                <FileWarning size={48} className="text-danger opacity-50" />
                <div className="text-center"><h3 className="text-lg font-bold text-text mb-1">Missing Reference</h3><p className="text-sm text-text2 max-w-md">File not found.</p></div>
                <button onClick={onCloseSelf} className="px-4 py-2 bg-panel border border-border hover:border-danger hover:text-danger rounded transition-colors text-sm font-bold">Close Tab</button>
            </div>
        ),
        icon: FileWarning
    }
};

export const renderView = (type: string, props: any) => {
    const entry = ViewRegistry[type as keyof typeof ViewRegistry];
    if (!entry) return <div className="p-4 text-danger">Unknown view type: {type}</div>;
    const Component = entry.component;
    return <Component {...props} />;
};

export const getViewIcon = (type: string) => {
    const entry = ViewRegistry[type as keyof typeof ViewRegistry];
    return entry ? entry.icon : FileText;
};
