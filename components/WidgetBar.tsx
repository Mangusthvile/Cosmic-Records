
import React, { useState, useEffect } from 'react';
import { WidgetId, Workspace, WidgetSystemState, Tab } from '../types';
import { List, Link2, Book, Sparkles, Bell, X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Widgets
import OutlineWidget from './widgets/OutlineWidget';
import BacklinksWidget from './widgets/BacklinksWidget';
import GlossaryWidget from './widgets/GlossaryWidget';
import AIChatWidget from './widgets/AIChatWidget';
import NotificationsWidget from './widgets/NotificationsWidget';

interface WidgetBarProps {
    workspace: Workspace;
    activeNoteId: string | null;
    activeTab: Tab | undefined;
    onOpenNote: (id: string) => void;
    onUpdateWorkspace: (ws: Workspace) => void;
    initialState: WidgetSystemState;
    onStateChange: (state: WidgetSystemState) => void;
}

interface WidgetDef {
    id: WidgetId;
    title: string;
    icon: React.ElementType;
    isGlobal: boolean;
}

const WIDGET_DEFS: WidgetDef[] = [
    { id: 'outline', title: 'Outline', icon: List, isGlobal: false },
    { id: 'backlinks', title: 'Connections', icon: Link2, isGlobal: false },
    { id: 'glossary', title: 'Glossary', icon: Book, isGlobal: true }, // Global context but specialized in prompt
    { id: 'ai_chat', title: 'AI Assistant', icon: Sparkles, isGlobal: true },
    { id: 'notifications', title: 'System Log', icon: Bell, isGlobal: true },
];

const WidgetBar: React.FC<WidgetBarProps> = ({ workspace, activeNoteId, activeTab, onOpenNote, onUpdateWorkspace, initialState, onStateChange }) => {
    // --- State (Hydrated from props) ---
    const [openWidgetIds, setOpenWidgetIds] = useState<WidgetId[]>(initialState.openWidgetIds || ['outline', 'backlinks']);
    const [widgetStates, setWidgetStates] = useState<Record<string, any>>(initialState.widgetStates || {});
    
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // --- Persistence ---
    useEffect(() => {
        onStateChange({ openWidgetIds, widgetStates });
    }, [openWidgetIds, widgetStates]);

    // --- Handlers ---

    const toggleWidget = (id: WidgetId) => {
        setOpenWidgetIds(prev => {
            if (prev.includes(id)) return prev.filter(w => w !== id);
            if (prev.length >= 4) {
                alert("Max 4 widgets allowed. Close one to open another.");
                return prev;
            }
            return [...prev, id];
        });
    };

    const closeWidget = (id: WidgetId) => {
        setOpenWidgetIds(prev => prev.filter(w => w !== id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setOpenWidgetIds((items) => {
                const oldIndex = items.indexOf(active.id as WidgetId);
                const newIndex = items.indexOf(over?.id as WidgetId);
                const newItems = [...items];
                newItems.splice(oldIndex, 1);
                newItems.splice(newIndex, 0, active.id as WidgetId);
                return newItems;
            });
        }
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // --- Renderers ---

    const renderWidgetContent = (id: WidgetId) => {
        // Context Sensitivity Check
        const isNoteTab = activeTab?.kind === 'note';
        const isMapTab = activeTab?.kind === 'starmap';
        
        // Availability Logic
        if (id === 'outline' && !isNoteTab) return <div className="p-4 text-xs text-muted italic text-center">Not available in this view.</div>;
        if (id === 'backlinks' && !isNoteTab) return <div className="p-4 text-xs text-muted italic text-center">Not available in this view.</div>;
        if (isMapTab && !['ai_chat', 'notifications'].includes(id)) return <div className="p-4 text-xs text-muted italic text-center">Not available in Map view.</div>;

        switch (id) {
            case 'outline': return <OutlineWidget note={activeNoteId ? workspace.notes[activeNoteId] : null} />;
            case 'backlinks': return <BacklinksWidget note={activeNoteId ? workspace.notes[activeNoteId] : null} workspace={workspace} onOpenNote={onOpenNote} />;
            case 'glossary': return <GlossaryWidget workspace={workspace} onUpdateWorkspace={onUpdateWorkspace} />;
            case 'ai_chat': return <AIChatWidget />;
            case 'notifications': return <NotificationsWidget workspace={workspace} onOpenNote={onOpenNote} />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-chrome-panel">
            {/* PICKER HEADER */}
            <div className="flex-shrink-0 border-b border-chrome-border bg-chrome-panel">
                <button 
                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-muted hover:text-foreground uppercase tracking-widest hover:bg-surface transition-colors"
                >
                    <span>Widgets</span>
                    {isPickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {isPickerOpen && (
                    <div className="px-2 pb-2 grid grid-cols-2 gap-1 animate-in slide-in-from-top-1">
                        {WIDGET_DEFS.map(def => {
                            const isOpen = openWidgetIds.includes(def.id);
                            return (
                                <button
                                    key={def.id}
                                    onClick={() => toggleWidget(def.id)}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                                        isOpen ? 'bg-accent/20 text-accent' : 'bg-surface text-muted hover:text-foreground'
                                    }`}
                                >
                                    <def.icon size={12} />
                                    <span>{def.title}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* STACK */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={openWidgetIds} strategy={verticalListSortingStrategy}>
                        {openWidgetIds.map((id) => {
                            const def = WIDGET_DEFS.find(d => d.id === id)!;
                            return (
                                <SortableWidgetPanel 
                                    key={id} 
                                    id={id} 
                                    title={def.title} 
                                    icon={def.icon}
                                    onClose={() => closeWidget(id)}
                                >
                                    {renderWidgetContent(id)}
                                </SortableWidgetPanel>
                            );
                        })}
                    </SortableContext>
                </DndContext>
                
                {openWidgetIds.length === 0 && (
                    <div className="p-8 text-center text-xs text-faint italic">
                        No active widgets.
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sortable Panel Wrapper ---

const SortableWidgetPanel: React.FC<{ id: string, title: string, icon: React.ElementType, children: React.ReactNode, onClose: () => void }> = ({ id, title, icon: Icon, children, onClose }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col border-b border-chrome-border flex-shrink-0 min-h-[150px] max-h-[50%] bg-chrome-panel">
            {/* Widget Header */}
            <div className="flex items-center justify-between px-2 py-1 bg-surface/30 border-b border-border select-none group">
                <div className="flex items-center gap-2 text-muted" {...attributes} {...listeners}>
                    <GripVertical size={12} className="cursor-grab hover:text-foreground" />
                    <Icon size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
                </div>
                <button onClick={onClose} className="text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {children}
            </div>
        </div>
    );
};

export default WidgetBar;
