
import React from 'react';
import { PaneSystemState, PaneState, Tab, PaneId, Workspace, Note, NoteTab, StarMapTab, GlossaryTab, MissingTab, PaneLayout, GlossaryEntryTab, PendingReviewTab } from '../types';
import { X, Globe, FileText, Book, FileWarning, Maximize2, ZoomIn, ZoomOut, Plus, Map as MapIcon, ChevronRight, Minimize2, Edit3, Clock } from 'lucide-react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, DragStartEvent, DragEndEvent, closestCenter, defaultDropAnimationSideEffects, DropAnimation, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton, Button } from './ui/Primitives';
import { renderView, getViewIcon } from './views/ViewRegistry';

const SortableTab: React.FC<{
    tab: Tab;
    isActive: boolean;
    onSelect: () => void;
    onClose: () => void;
}> = ({ tab, isActive, onSelect, onClose }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id, data: { type: 'TAB', tab } });
    const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 999 : 'auto' };
    const Icon = getViewIcon(tab.kind);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`
                group flex items-center gap-2 px-3 h-full border-r border-border cursor-pointer min-w-[120px] max-w-[200px] select-none
                ${isActive 
                    ? 'bg-bg text-text border-t-2 border-t-accent' 
                    : 'bg-panel text-text2 hover:bg-panel2 hover:text-text border-t-2 border-t-transparent'}
            `}
        >
            <Icon size={12} className={tab.kind === 'starmap' ? 'text-accent' : ''} />
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

const EmptyPaneState: React.FC<{ 
    onCreateNote: () => void; 
    onOpenMap: () => void;
    onClosePane: () => void;
    canClose: boolean;
}> = ({ onCreateNote, onOpenMap, onClosePane, canClose }) => (
    <div className="flex flex-col items-center justify-center h-full text-text2 gap-4 select-none bg-deep-space relative">
        <div className="text-4xl opacity-10">❖</div>
        <div className="text-sm font-medium opacity-50">Empty Pane</div>
        <div className="flex gap-2">
            <Button size="sm" onClick={onCreateNote}><Plus size={14} className="mr-1" /> New Record</Button>
            <Button size="sm" variant="outline" onClick={onOpenMap}><MapIcon size={14} className="mr-1" /> Open Map</Button>
        </div>
        <p className="text-[10px] opacity-40 mt-2">Open a note from the explorer or drop a tab here.</p>
        
        {canClose && (
            <div className="absolute top-4 right-4">
                <Button size="sm" variant="danger" onClick={onClosePane} className="opacity-50 hover:opacity-100 transition-opacity">
                    <Minimize2 size={14} className="mr-1" /> Close Pane
                </Button>
            </div>
        )}
    </div>
);

const PaneTabStrip: React.FC<{ pane: PaneState; isFocused: boolean; onSelectTab: (id: string) => void; onCloseTab: (id: string) => void; onFocus: () => void; }> = ({ pane, isFocused, onSelectTab, onCloseTab, onFocus }) => {
    return (
        <div className={`flex items-center h-9 border-b border-border overflow-x-auto no-scrollbar select-none bg-panel relative ${isFocused ? 'bg-bg' : ''}`} onClick={(e) => { e.stopPropagation(); onFocus(); }}>
             <SortableContext items={pane.tabs.map(t => t.id)} strategy={horizontalListSortingStrategy} id={pane.id}>
                {pane.tabs.map(tab => <SortableTab key={tab.id} tab={tab} isActive={tab.id === pane.activeTabId} onSelect={() => onSelectTab(tab.id)} onClose={() => onCloseTab(tab.id)} />)}
            </SortableContext>
        </div>
    );
};

const CompactPaneHeader: React.FC<{ pane: PaneState; onFocus: () => void }> = ({ pane, onFocus }) => {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId);
    const Icon = activeTab ? getViewIcon(activeTab.kind) : FileText;
    
    return (
        <div onClick={(e) => { e.stopPropagation(); onFocus(); }} className="h-9 border-b border-border bg-panel2 flex items-center px-4 cursor-pointer hover:bg-panel transition-colors select-none text-text2 hover:text-text">
            {activeTab ? (
                <div className="flex items-center gap-2">
                    <Icon size={12} />
                    <span className="text-xs font-bold">{activeTab.title}</span>
                </div>
            ) : (
                <span className="text-xs italic opacity-50">Empty</span>
            )}
        </div>
    );
};

const Pane: React.FC<{ 
    pane: PaneState; 
    isFocused: boolean; 
    canClose: boolean;
    onFocus: () => void; 
    onCloseTab: (tabId: string) => void; 
    onClosePane: () => void;
    onSelectTab: (tabId: string) => void; 
    workspace: Workspace; 
    onUpdateNote: (note: Note, ws?: Workspace) => void; 
    onGenerateTitle: (note: Note) => void; 
    onOpenNote: (id: string) => void; 
    onOpenTerm: (id: string) => void;
    onUpdateTabState: (paneId: PaneId, tabId: string, partial: any) => void; 
    onCreateNote: () => void;
    onOpenMap: () => void;
}> = ({ pane, isFocused, canClose, onFocus, onCloseTab, onClosePane, onSelectTab, workspace, onUpdateNote, onGenerateTitle, onOpenNote, onOpenTerm, onUpdateTabState, onCreateNote, onOpenMap }) => {
    const { setNodeRef } = useDroppable({ id: pane.id });
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId);
    
    return (
        <div 
            ref={setNodeRef}
            onClick={onFocus} 
            className={`flex flex-col h-full overflow-hidden relative transition-all duration-200 border
                ${isFocused 
                    ? 'border-accent/50 shadow-[inset_0_0_0_1px_var(--accent)] z-10' 
                    : 'border-border z-0'}
            `}
        >
            {isFocused || pane.tabs.length === 0 ? (
                <PaneTabStrip pane={pane} isFocused={isFocused} onSelectTab={onSelectTab} onCloseTab={onCloseTab} onFocus={onFocus} />
            ) : (
                <CompactPaneHeader pane={pane} onFocus={onFocus} />
            )}
            
            <div className="flex-1 overflow-hidden relative bg-deep-space">
                {activeTab ? (
                    renderView(activeTab.kind, {
                        key: activeTab.id,
                        tab: activeTab,
                        workspace,
                        onUpdateState: (partial: any) => onUpdateTabState(pane.id, activeTab.id, partial),
                        onUpdateNote,
                        onGenerateTitle,
                        onOpenNote,
                        onOpenTerm,
                        onCloseSelf: () => onCloseTab(activeTab.id),
                        isFocusedPane: isFocused
                    })
                ) : (
                    <EmptyPaneState onCreateNote={onCreateNote} onOpenMap={onOpenMap} onClosePane={onClosePane} canClose={canClose} />
                )}
            </div>
        </div>
    );
};

// --- Drop Zones ---
const SplitDropZone: React.FC<{ id: string, style: React.CSSProperties, active: boolean }> = ({ id, style, active }) => {
    const { setNodeRef } = useDroppable({ id });
    if (!active) return null;
    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className="absolute z-[100] bg-accent/20 border-2 border-accent backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
        >
            <div className="bg-accent text-bg px-2 py-1 rounded text-xs font-bold uppercase">Drop to Split</div>
        </div>
    );
};

export const PaneGrid: React.FC<{ 
    system: PaneSystemState; 
    onFocusPane: (id: PaneId) => void; 
    onCloseTab: (paneId: PaneId, tabId: string) => void; 
    onClosePane: (paneId: PaneId) => void;
    onSelectTab: (paneId: PaneId, tabId: string) => void; 
    onReorderTab: (paneId: PaneId, oldIndex: number, newIndex: number) => void; 
    onMoveTab: (sourcePaneId: PaneId, targetPaneId: PaneId, tabId: string, newIndex?: number) => void; 
    onUpdateTabState: (paneId: PaneId, tabId: string, partial: any) => void; 
    handleDragToSplit: (sourcePaneId: PaneId, tabId: string, direction: 'right' | 'bottom') => void;
    workspace: Workspace; 
    onUpdateNote: (note: Note, ws?: Workspace) => void; 
    onGenerateTitle: (note: Note) => void; 
    onOpenNote: (id: string) => void; 
    onOpenTerm: (id: string) => void;
    onCreateNote: () => void;
    onOpenMap: () => void;
}> = ({ 
    system, onFocusPane, onCloseTab, onClosePane, onSelectTab, onReorderTab, onMoveTab, onUpdateTabState, handleDragToSplit,
    workspace, onUpdateNote, onGenerateTitle, onOpenNote, onOpenTerm, onCreateNote, onOpenMap
}) => {
    const [activeDragTab, setActiveDragTab] = React.useState<Tab | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

    const findPaneOfTab = (tabId: string): PaneId | null => { 
        for (const pid of Object.keys(system.panes) as PaneId[]) { 
            if (system.panes[pid].tabs.find(t => t.id === tabId)) return pid; 
        } 
        return null; 
    };

    const handleDragStart = (event: DragStartEvent) => { 
        const { active } = event; 
        const paneId = findPaneOfTab(active.id as string); 
        if (paneId) { 
            const tab = system.panes[paneId].tabs.find(t => t.id === active.id); 
            if (tab) { 
                setActiveDragTab(tab); 
                onFocusPane(paneId); 
            } 
        } 
    };

    const handleDragEnd = (event: DragEndEvent) => { 
        const { active, over } = event; 
        setActiveDragTab(null); 
        if (!over) return; 

        const sourcePaneId = findPaneOfTab(active.id as string); 
        if (!sourcePaneId) return;

        if (over.id === 'zone-right') { handleDragToSplit(sourcePaneId, active.id as string, 'right'); return; }
        if (over.id === 'zone-bottom') { handleDragToSplit(sourcePaneId, active.id as string, 'bottom'); return; }

        let targetPaneId: PaneId | null = null;
        if (system.panes[over.id as PaneId]) { targetPaneId = over.id as PaneId; } else { targetPaneId = findPaneOfTab(over.id as string); }
        
        if (sourcePaneId && targetPaneId) { 
            if (sourcePaneId === targetPaneId) { 
                if (active.id !== over.id && !system.panes[over.id as PaneId]) { 
                    const pane = system.panes[sourcePaneId]; 
                    const oldIndex = pane.tabs.findIndex(t => t.id === active.id);
                    const newIndex = pane.tabs.findIndex(t => t.id === over.id);
                    if (oldIndex !== -1 && newIndex !== -1) { onReorderTab(sourcePaneId, oldIndex, newIndex); }
                } 
            } else { 
                let newIndex: number | undefined = undefined;
                if (!system.panes[over.id as PaneId]) { newIndex = system.panes[targetPaneId].tabs.findIndex(t => t.id === over.id); }
                onMoveTab(sourcePaneId, targetPaneId, active.id as string, newIndex); 
            } 
        } 
    };

    const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) };

    const getGridStyle = (): React.CSSProperties => { 
        switch (system.layout) { 
            case 'single': return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }; 
            case 'splitVertical': return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }; 
            case 'splitHorizontal': return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }; 
            case 'quad': return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }; 
        } 
    };

    const renderPane = (id: PaneId) => (
        <Pane 
            key={id} 
            pane={system.panes[id]} 
            isFocused={system.focusedPaneId === id} 
            canClose={system.layout !== 'single'}
            onFocus={() => onFocusPane(id)} 
            onCloseTab={(tId) => onCloseTab(id, tId)} 
            onClosePane={() => onClosePane(id)}
            onSelectTab={(tId) => onSelectTab(id, tId)} 
            workspace={workspace} 
            onUpdateNote={onUpdateNote} 
            onGenerateTitle={onGenerateTitle} 
            onOpenNote={onOpenNote} 
            onOpenTerm={onOpenTerm}
            onUpdateTabState={onUpdateTabState}
            onCreateNote={onCreateNote}
            onOpenMap={onOpenMap} 
        />
    );

    const visiblePanes = (() => { 
        switch(system.layout) { 
            case 'single': return [renderPane('paneA')]; 
            case 'splitVertical': return [renderPane('paneA'), renderPane('paneB')]; 
            case 'splitHorizontal': return [renderPane('paneA'), renderPane('paneC')]; 
            case 'quad': return [renderPane('paneA'), renderPane('paneB'), renderPane('paneC'), renderPane('paneD')]; 
        } 
    })();

    const isDraggingTab = !!activeDragTab;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="w-full h-full relative" style={getGridStyle()}>
                {visiblePanes}
                <SplitDropZone id="zone-right" active={isDraggingTab} style={{ top: 0, right: 0, bottom: 0, width: '20%' }} />
                <SplitDropZone id="zone-bottom" active={isDraggingTab} style={{ left: 0, right: 0, bottom: 0, height: '20%' }} />
            </div>
            
            <DragOverlay dropAnimation={dropAnimation}>
                {activeDragTab ? (
                    <div className="flex items-center gap-2 px-3 h-9 bg-panel text-text border border-accent rounded shadow-xl opacity-90 cursor-grabbing w-[150px]">
                        {React.createElement(getViewIcon(activeDragTab.kind), { size: 12 })}
                        <span className="text-xs font-bold truncate">{activeDragTab.title}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
