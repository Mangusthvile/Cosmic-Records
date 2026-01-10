
import React from 'react';
import { PaneSystemState, PaneState, Tab, PaneId, Workspace, Note, NoteTab, StarMapTab, GlossaryTab, MissingTab } from '../types';
import { X, Globe, FileText, Book, FileWarning, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import StarMap from './StarMap';
import NoteEditor from './NoteEditor';
import GlossaryView from './GlossaryView';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, DragStartEvent, DragEndEvent, closestCenter, defaultDropAnimationSideEffects, DropAnimation } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from './ui/Primitives';

const getTabIcon = (type: Tab['kind']) => {
    switch (type) {
        case 'starmap': return <Globe size={12} className="text-accent" />;
        case 'note': return <FileText size={12} className="text-text2" />;
        case 'glossary': return <Book size={12} className="text-text2" />;
        case 'missing': return <FileWarning size={12} className="text-danger" />;
        default: return <FileText size={12} />;
    }
};

const SortableTab: React.FC<{
    tab: Tab;
    isActive: boolean;
    onSelect: () => void;
    onClose: () => void;
}> = ({ tab, isActive, onSelect, onClose }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id, data: { type: 'TAB', tab } });
    const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 999 : 'auto' };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`
                group flex items-center gap-2 px-3 h-full border-r border-border cursor-pointer min-w-[100px] max-w-[200px] select-none
                ${isActive 
                    ? 'bg-bg text-text border-t-2 border-t-accent' 
                    : 'bg-panel text-text2 hover:bg-panel2 hover:text-text border-t-2 border-t-transparent'}
            `}
        >
            {getTabIcon(tab.kind)}
            <span className={`text-[11px] truncate flex-1 ${tab.kind === 'missing' ? 'text-danger italic' : ''}`}>{tab.title}</span>
            <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="opacity-0 group-hover:opacity-100 hover:text-danger rounded p-0.5 transition-opacity"
            >
                <X size={10} />
            </button>
        </div>
    );
};

interface TabViewProps {
    tab: Tab;
    workspace: Workspace;
    onUpdateState: (partial: any) => void;
    onUpdateNote: (note: Note, ws?: Workspace) => void;
    onGenerateTitle: (note: Note) => void;
    onOpenNote: (id: string) => void;
    onCloseSelf: () => void;
    isFocusedPane: boolean;
}

const TabView: React.FC<TabViewProps> = ({ tab, workspace, onUpdateState, onUpdateNote, onGenerateTitle, onOpenNote, onCloseSelf, isFocusedPane }) => {
    switch (tab.kind) {
        case 'note': {
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
        }
        case 'starmap': {
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
        }
        case 'glossary': return <GlossaryView tab={tab as GlossaryTab} workspace={workspace} onUpdateState={onUpdateState} />;
        case 'missing': return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 bg-bg p-8">
                <FileWarning size={48} className="text-danger opacity-50" />
                <div className="text-center"><h3 className="text-lg font-bold text-text mb-1">Missing Reference</h3><p className="text-sm text-text2 max-w-md">File not found.</p></div>
                <button onClick={onCloseSelf} className="px-4 py-2 bg-panel border border-border hover:border-danger hover:text-danger rounded transition-colors text-sm font-bold">Close Tab</button>
            </div>
        );
        default: return <div className="p-4 text-xs text-danger">Unknown Tab</div>;
    }
};

const PaneTabStrip: React.FC<{ pane: PaneState; isFocused: boolean; onSelectTab: (id: string) => void; onCloseTab: (id: string) => void; onFocus: () => void; }> = ({ pane, isFocused, onSelectTab, onCloseTab, onFocus }) => {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId);
    if (!isFocused) return (
        <div onClick={onFocus} className="flex items-center h-9 bg-panel border-b border-border px-3 cursor-pointer hover:bg-panel2 transition-colors select-none opacity-60 hover:opacity-100">
            <div className="flex items-center gap-2 text-text2 text-xs">
                <Maximize2 size={10} />
                <span className={`font-mono uppercase tracking-wider text-[10px] truncate max-w-[150px] ${activeTab?.kind === 'missing' ? 'text-danger' : ''}`}>{activeTab ? activeTab.title : 'Empty'}</span>
            </div>
        </div>
    );
    return (
        <div className="flex items-center h-9 bg-panel border-b border-border overflow-x-auto no-scrollbar select-none" onClick={(e) => { e.stopPropagation(); onFocus(); }}>
             <SortableContext items={pane.tabs.map(t => t.id)} strategy={horizontalListSortingStrategy} id={pane.id}>
                {pane.tabs.map(tab => <SortableTab key={tab.id} tab={tab} isActive={tab.id === pane.activeTabId} onSelect={() => onSelectTab(tab.id)} onClose={() => onCloseTab(tab.id)} />)}
            </SortableContext>
             {pane.tabs.length === 0 && <div className="flex-1 h-full flex items-center px-3 text-[10px] text-text2 uppercase tracking-wider">Empty Pane</div>}
        </div>
    );
};

const Pane: React.FC<{ pane: PaneState; isFocused: boolean; onFocus: () => void; onCloseTab: (tabId: string) => void; onSelectTab: (tabId: string) => void; workspace: Workspace; onUpdateNote: (note: Note, ws?: Workspace) => void; onGenerateTitle: (note: Note) => void; onOpenNote: (id: string) => void; onUpdateTabState: (paneId: PaneId, tabId: string, partial: any) => void; }> = ({ pane, isFocused, onFocus, onCloseTab, onSelectTab, workspace, onUpdateNote, onGenerateTitle, onOpenNote, onUpdateTabState }) => {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId);
    return (
        <div onClick={onFocus} className={`flex flex-col h-full overflow-hidden relative border transition-colors ${isFocused ? 'border-accent/50 shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-border'}`}>
            <PaneTabStrip pane={pane} isFocused={isFocused} onSelectTab={onSelectTab} onCloseTab={onCloseTab} onFocus={onFocus} />
            <div className="flex-1 overflow-hidden relative bg-deep-space">
                {activeTab ? <TabView key={activeTab.id} tab={activeTab} workspace={workspace} onUpdateState={(partial) => onUpdateTabState(pane.id, activeTab.id, partial)} onUpdateNote={onUpdateNote} onGenerateTitle={onGenerateTitle} onOpenNote={onOpenNote} onCloseSelf={() => onCloseTab(activeTab.id)} isFocusedPane={isFocused} /> : <div className="flex flex-col items-center justify-center h-full text-text2 gap-2 select-none pointer-events-none"><div className="text-4xl opacity-10">❖</div><div className="text-xs uppercase tracking-widest opacity-50">Empty Pane</div></div>}
            </div>
        </div>
    );
};

export const PaneGrid: React.FC<{ system: PaneSystemState; onFocusPane: (id: PaneId) => void; onCloseTab: (paneId: PaneId, tabId: string) => void; onSelectTab: (paneId: PaneId, tabId: string) => void; onReorderTab: (paneId: PaneId, oldIndex: number, newIndex: number) => void; onMoveTab: (sourcePaneId: PaneId, targetPaneId: PaneId, tabId: string, newIndex?: number) => void; onUpdateTabState: (paneId: PaneId, tabId: string, partial: any) => void; workspace: Workspace; onUpdateNote: (note: Note, ws?: Workspace) => void; onGenerateTitle: (note: Note) => void; onOpenNote: (id: string) => void; }> = ({ system, onFocusPane, onCloseTab, onSelectTab, onReorderTab, onMoveTab, onUpdateTabState, workspace, onUpdateNote, onGenerateTitle, onOpenNote }) => {
    const [activeDragTab, setActiveDragTab] = React.useState<Tab | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const findPaneOfTab = (tabId: string): PaneId | null => { for (const pid of Object.keys(system.panes) as PaneId[]) { if (system.panes[pid].tabs.find(t => t.id === tabId)) return pid; } return null; };
    const handleDragStart = (event: DragStartEvent) => { const { active } = event; const paneId = findPaneOfTab(active.id as string); if (paneId) { const tab = system.panes[paneId].tabs.find(t => t.id === active.id); if (tab) { setActiveDragTab(tab); onFocusPane(paneId); } } };
    const handleDragEnd = (event: DragEndEvent) => { const { active, over } = event; setActiveDragTab(null); if (!over) return; const sourcePaneId = findPaneOfTab(active.id as string); let targetPaneId = findPaneOfTab(over.id as string); if (sourcePaneId && targetPaneId) { if (sourcePaneId === targetPaneId) { if (active.id !== over.id) { const pane = system.panes[sourcePaneId]; onReorderTab(sourcePaneId, pane.tabs.findIndex(t => t.id === active.id), pane.tabs.findIndex(t => t.id === over.id)); } } else { const targetPane = system.panes[targetPaneId]; onMoveTab(sourcePaneId, targetPaneId, active.id as string, targetPane.tabs.findIndex(t => t.id === over.id)); } } };
    const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) };
    const getGridStyle = () => { switch (system.layout) { case 'single': return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }; case 'splitVertical': return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }; case 'splitHorizontal': return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }; case 'grid': return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }; } };
    const renderPane = (id: PaneId) => <Pane key={id} pane={system.panes[id]} isFocused={system.focusedPaneId === id} onFocus={() => onFocusPane(id)} onCloseTab={(tId) => onCloseTab(id, tId)} onSelectTab={(tId) => onSelectTab(id, tId)} workspace={workspace} onUpdateNote={onUpdateNote} onGenerateTitle={onGenerateTitle} onOpenNote={onOpenNote} onUpdateTabState={onUpdateTabState} />;
    const visiblePanes = (() => { switch(system.layout) { case 'single': return [renderPane('paneA')]; case 'splitVertical': return [renderPane('paneA'), renderPane('paneB')]; case 'splitHorizontal': return [renderPane('paneA'), renderPane('paneC')]; case 'grid': return [renderPane('paneA'), renderPane('paneB'), renderPane('paneC'), renderPane('paneD')]; } })();
    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="w-full h-full bg-bg" style={getGridStyle()}>{visiblePanes}</div>
            <DragOverlay dropAnimation={dropAnimation}>{activeDragTab ? <div className="flex items-center gap-2 px-3 h-9 bg-panel text-text border border-accent rounded shadow-xl opacity-90 cursor-grabbing">{getTabIcon(activeDragTab.kind)}<span className="text-xs font-bold">{activeDragTab.title}</span></div> : null}</DragOverlay>
        </DndContext>
    );
};
