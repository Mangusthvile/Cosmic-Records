
import React, { useState, useEffect } from 'react';
import { WidgetId, Workspace, WidgetSystemState, Tab } from '../types';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from './ui/Primitives';
import { WIDGET_REGISTRY, AVAILABLE_WIDGETS, WidgetDefinition } from './widgets/WidgetRegistry';

interface WidgetBarProps {
    workspace: Workspace;
    activeNoteId: string | null;
    activeTab: Tab | undefined;
    onOpenNote: (id: string) => void;
    onUpdateWorkspace: (ws: Workspace) => void;
    initialState: WidgetSystemState;
    onStateChange: (state: WidgetSystemState) => void;
}

const WidgetBar: React.FC<WidgetBarProps> = ({ workspace, activeNoteId, activeTab, onOpenNote, onUpdateWorkspace, initialState, onStateChange }) => {
    // Local state for UI
    const [openWidgetIds, setOpenWidgetIds] = useState<WidgetId[]>(initialState.openWidgetIds || ['outline', 'backlinks']);
    const [widgetStates, setWidgetStates] = useState<Record<string, any>>(initialState.widgetStates || {});
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [activeDragId, setActiveDragId] = useState<WidgetId | null>(null);

    // Sync to persistence when state changes
    useEffect(() => {
        onStateChange({ openWidgetIds, widgetStates });
    }, [openWidgetIds, widgetStates]);

    const toggleWidget = (id: WidgetId) => {
        if (openWidgetIds.includes(id)) {
            setOpenWidgetIds(prev => prev.filter(w => w !== id));
        } else {
            if (openWidgetIds.length >= 4) {
                alert("Maximum 4 widgets allowed. Close one to open another.");
                return;
            }
            setOpenWidgetIds(prev => [...prev, id]);
            // Initialize default state if missing
            if (!widgetStates[id]) {
                setWidgetStates(prev => ({ ...prev, [id]: WIDGET_REGISTRY[id].defaultState }));
            }
        }
    };

    const updateWidgetState = (id: WidgetId, newState: any) => {
        setWidgetStates(prev => ({ ...prev, [id]: newState }));
    };

    // Dnd Handlers
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as WidgetId);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over) {
            setOpenWidgetIds((items) => {
                const oldIndex = items.indexOf(active.id as WidgetId);
                const newIndex = items.indexOf(over.id as WidgetId);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
        setActiveDragId(null);
    };

    return (
        <div className="flex flex-col h-full bg-panel border-l border-border">
            {/* 1. Header / Picker Toggle */}
            <div className="flex-shrink-0 border-b border-border bg-panel z-20">
                <button 
                    onClick={() => setIsPickerOpen(!isPickerOpen)} 
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-text2 hover:text-text uppercase tracking-widest hover:bg-panel2 transition-colors select-none"
                >
                    <span className="flex items-center gap-2">Widgets {openWidgetIds.length > 0 && <span className="text-[10px] opacity-50">({openWidgetIds.length})</span>}</span>
                    {isPickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {/* 2. Compact Picker */}
                {isPickerOpen && (
                    <div className="px-3 pb-3 bg-panel border-b border-border animate-in slide-in-from-top-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 gap-1">
                            {AVAILABLE_WIDGETS.map(def => {
                                const isOpen = openWidgetIds.includes(def.id);
                                return (
                                    <button 
                                        key={def.id} 
                                        onClick={() => toggleWidget(def.id)} 
                                        className={`flex items-center justify-between px-3 py-2 rounded text-xs transition-all border
                                            ${isOpen 
                                                ? 'bg-accent/10 text-accent border-accent/30 font-bold' 
                                                : 'bg-panel2 text-text2 border-transparent hover:border-border hover:text-text'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <def.icon size={14} />
                                            <span>{def.title}</span>
                                        </div>
                                        {isOpen ? <X size={12} className="opacity-70" /> : <Plus size={12} className="opacity-50" />}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="mt-3 text-[10px] text-center text-text2 opacity-50">
                            Max 4 widgets active. Drag active widgets below to reorder.
                        </div>
                    </div>
                )}
            </div>
            
            {/* 3. Stacked Active Widgets */}
            <div className="flex-1 flex flex-col min-h-0 bg-deep-space">
                {openWidgetIds.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-text2 italic">
                        No active widgets.<br/>Open the picker to add tools.
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <SortableContext items={openWidgetIds} strategy={verticalListSortingStrategy}>
                            {openWidgetIds.map((id) => {
                                const def = WIDGET_REGISTRY[id];
                                if (!def) return null; // Safety
                                const WidgetComponent = def.component;
                                
                                return (
                                    <SortableWidgetContainer key={id} id={id} title={def.title} icon={def.icon} onClose={() => toggleWidget(id)}>
                                        <WidgetComponent 
                                            workspace={workspace}
                                            activeNoteId={activeNoteId}
                                            activeTab={activeTab}
                                            onOpenNote={onOpenNote}
                                            onUpdateWorkspace={onUpdateWorkspace}
                                            state={widgetStates[id] || def.defaultState}
                                            onStateChange={(ns) => updateWidgetState(id, ns)}
                                        />
                                    </SortableWidgetContainer>
                                );
                            })}
                        </SortableContext>
                        
                        <DragOverlay>
                            {activeDragId ? (
                                <div className="h-10 bg-panel border border-accent rounded shadow-xl flex items-center px-4 text-text text-xs font-bold opacity-90">
                                    {WIDGET_REGISTRY[activeDragId].title}
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>
        </div>
    );
};

// --- Stack Item Wrapper ---
const SortableWidgetContainer: React.FC<{ id: string, title: string, icon: React.ElementType, children: React.ReactNode, onClose: () => void }> = ({ id, title, icon: Icon, children, onClose }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 50 : 'auto' };
    
    return (
        <div ref={setNodeRef} style={style} className="flex flex-col border-b border-border flex-1 min-h-[150px] bg-panel overflow-hidden transition-all">
            {/* Widget Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-panel2 border-b border-border select-none group flex-shrink-0">
                <div className="flex items-center gap-2 text-text2 cursor-grab active:cursor-grabbing hover:text-text transition-colors" {...attributes} {...listeners}>
                    <GripVertical size={12} className="opacity-50 group-hover:opacity-100" />
                    <Icon size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
                </div>
                <IconButton size="sm" onClick={onClose} className="opacity-50 group-hover:opacity-100"><X size={12} /></IconButton>
            </div>
            {/* Widget Body */}
            <div className="flex-1 overflow-hidden relative bg-panel">
                {children}
            </div>
        </div>
    );
};

export default WidgetBar;
