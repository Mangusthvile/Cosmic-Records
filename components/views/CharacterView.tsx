
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Note, Workspace, CharacterTab, CharacterBlock, CharacterBlockType, CharacterData, CharacterSnapshot } from '../../types';
import { getCharacterModuleSpec, createCharacterBlock } from '../../services/modularModuleRegistry';
import { IconButton, Button } from '../ui/Primitives';
import { GripVertical, ChevronDown, ChevronRight, Trash2, Plus, X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUniqueTitle, logNotification } from '../../services/storageService';
import { resolveBlocks, ensureFormsStructure } from '../../services/modularResolution';
import { validateCharacter, ValidationResult } from '../../services/modularValidation';
import CharacterHeader from './CharacterHeader';
import ValidationPanel from './ValidationPanel';

interface CharacterViewProps {
    tab: CharacterTab;
    workspace: Workspace;
    onUpdateNote: (note: Note) => void;
    onOpenNote: (id: string) => void;
    onUpdateWorkspace?: (ws: Workspace) => void;
}

// --- Module Card ---
const SortableModuleCard = ({ block, index, onUpdate, onRemove, workspace, onOpenNote, readOnly, isOverride, onUpdateWorkspace, id }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1
    };

    const spec = getCharacterModuleSpec(block.type);
    const Component = spec.Renderer;
    const Icon = spec.icon;

    return (
        <div ref={setNodeRef} style={style} className={`border rounded bg-panel overflow-hidden transition-shadow hover:shadow-soft ${isOverride ? 'border-accent/30' : 'border-border'}`} id={`module-${block.blockId}`}>
            <div className="flex items-center justify-between p-2 bg-panel2 border-b border-border select-none group">
                <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => onUpdate({ collapsed: !block.collapsed })}>
                    <div 
                        className="text-text2 cursor-grab active:cursor-grabbing p-1 hover:bg-surface rounded" 
                        {...attributes} 
                        {...listeners}
                        onClick={e => e.stopPropagation()}
                    >
                        <GripVertical size={14} />
                    </div>
                    <div className="text-text2">
                        {block.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon size={14} className="text-accent opacity-70" />
                        <span className="font-bold text-xs uppercase tracking-widest text-text2">{block.title}</span>
                        {isOverride && <span className="text-[9px] bg-accent/10 text-accent px-1.5 rounded border border-accent/20">Override</span>}
                    </div>
                </div>
                {!readOnly && (
                    <IconButton size="sm" onClick={() => onRemove()} className="opacity-0 group-hover:opacity-100 hover:text-danger">
                        <Trash2 size={14} />
                    </IconButton>
                )}
            </div>
            
            {!block.collapsed && (
                <div className="p-4 bg-bg">
                    <Component 
                        noteId={`module-${block.blockId}`}
                        blockId={block.blockId}
                        title={block.title}
                        collapsed={block.collapsed}
                        payload={block.payload} 
                        onChange={(nextPayload: any) => onUpdate({ payload: nextPayload })} 
                        onMetaChange={(meta: any) => onUpdate(meta)}
                        readOnly={readOnly}
                        workspace={workspace} 
                        onOpenNote={onOpenNote}
                    />
                </div>
            )}
        </div>
    );
};

// --- Main View ---
const CharacterView: React.FC<CharacterViewProps> = ({ tab, workspace, onUpdateNote, onOpenNote, onUpdateWorkspace }) => {
    const note = workspace.notes[tab.payload.noteId];
    
    if (!note) {
        return <div className="p-8 text-center text-muted">Record Not Found</div>;
    }

    // Ensure structure is up to date (migration)
    const charDataRaw = note.metadata?.characterData;
    const charData = useMemo(() => ensureFormsStructure(charDataRaw || {} as any), [charDataRaw]);

    const activeFormId = charData.forms.activeFormId;
    const activeSnapshotId = charData.snapshots.activeSnapshotId;
    const activeForm = charData.forms.items[activeFormId];
    const isLive = !activeSnapshotId;
    const isBaseForm = activeFormId === 'base';

    const template = workspace.characterTemplates[charData.templateId];
    const strictMode = charData.templateStrictOverride ?? template?.strictMode ?? false;

    // Validation State
    const [validationResult, setValidationResult] = useState<ValidationResult>({ errors: [], warnings: [], updatedAt: 0 });
    const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // RESOLUTION: Calculate visible blocks
    const resolvedBlocks = useMemo(() => {
        if (!isLive && activeSnapshotId) {
            const snap = charData.snapshots.items[activeSnapshotId];
            return snap ? snap.resolved.blocks : [];
        }
        return resolveBlocks(charData.blocks, activeForm);
    }, [charData.blocks, activeForm, activeSnapshotId, isLive, charData.snapshots.items]);

    // Validation Runner
    const runValidation = (currentNote: Note, blocks: CharacterBlock[]) => {
        const result = validateCharacter(currentNote, blocks, workspace, workspace.settings.characterValidation, template);
        setValidationResult(result);
        return result;
    };

    // Effect: Run validation on mount and when data changes (debounced)
    useEffect(() => {
        if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
        validateTimeoutRef.current = setTimeout(() => {
            runValidation(note, resolvedBlocks);
        }, 1000);
        return () => { if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current); };
    }, [note, resolvedBlocks, workspace.settings.characterValidation, template]);

    // Handle Update Wrapper (Blocks save if strict & error)
    const handleUpdateNote = (partial: Partial<Note>) => {
        let updated = { ...note, ...partial, updatedAt: Date.now() };
        
        // Handle Title Uniqueness
        if (partial.title && partial.title !== note.title) {
            updated.title = getUniqueTitle(workspace, partial.title, note.id);
        }

        // Run validation immediately for save check
        const result = validateCharacter(updated, resolvedBlocks, workspace, workspace.settings.characterValidation, template);
        setValidationResult(result);

        // Strict Mode Blocking Logic
        if (strictMode && result.errors.length > 0) {
            // Apply transient flag to prevent disk save
            updated._preventSave = true;
            // We still update App state so UI reflects changes (in-memory)
            onUpdateNote(updated);
            // Notify user
            logNotification(workspace, 'warning', `Save blocked for "${updated.title}" due to ${result.errors.length} error(s).`);
        } else {
            updated._preventSave = false;
            onUpdateNote(updated);
        }
    };

    const updateData = (partial: Partial<CharacterData>) => {
        const newData = { ...charData, ...partial };
        // We need to re-resolve blocks to validate accurately, but that's expensive here.
        // We pass the new data to handleUpdateNote, which will eventually trigger re-render and re-validation effect.
        // For immediate blocking on block edits, we rely on the next render cycle or handleUpdateNote's logic.
        // Since block edits are granular, we might not block EVERY keystroke, but the final save.
        handleUpdateNote({ metadata: { ...note.metadata, characterData: newData } });
    };

    const handleBlockUpdate = (blockId: string, updates: Partial<CharacterBlock>) => {
        if (!isLive) return;

        // Determine if block is Base or Local
        const isBaseBlock = charData.blocks.some(b => b.blockId === blockId);
        
        if (isBaseForm) {
            // In Base form, always update base blocks directly
            if (isBaseBlock) {
                const newBlocks = charData.blocks.map(b => b.blockId === blockId ? { ...b, ...updates } : b);
                updateData({ blocks: newBlocks });
            }
        } else {
            // In Derived form
            if (isBaseBlock) {
                // Update Override
                const currentOverride = activeForm.overrides[blockId] || {};
                const newOverride = {
                    schemaVersion: 1 as const,
                    ...currentOverride,
                    ...updates // Payload, title, collapsed
                };
                const newForm = {
                    ...activeForm,
                    overrides: { ...activeForm.overrides, [blockId]: newOverride }
                };
                updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
            } else {
                // Update Local Block
                const newLocals = activeForm.localBlocks.map(b => b.blockId === blockId ? { ...b, ...updates } : b);
                const newForm = { ...activeForm, localBlocks: newLocals };
                updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
            }
        }
    };

    const handleBlockRemove = (blockId: string) => {
        if (!isLive) return;
        if (!confirm("Remove module?")) return;

        const isBaseBlock = charData.blocks.some(b => b.blockId === blockId);

        if (isBaseForm) {
            if (isBaseBlock) {
                const newBlocks = charData.blocks.filter(b => b.blockId !== blockId);
                updateData({ blocks: newBlocks });
            }
        } else {
            if (isBaseBlock) {
                // Hide in override
                const newOverride = { ...activeForm.overrides[blockId], deleted: true, schemaVersion: 1 as const };
                const newForm = { ...activeForm, overrides: { ...activeForm.overrides, [blockId]: newOverride } };
                updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
            } else {
                // Remove local
                const newLocals = activeForm.localBlocks.filter(b => b.blockId !== blockId);
                const newForm = { ...activeForm, localBlocks: newLocals };
                updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
            }
        }
    };

    const handleAddModule = (type: CharacterBlockType) => {
        const newBlock = createCharacterBlock(type);
        if (isBaseForm) {
            updateData({ blocks: [...charData.blocks, newBlock] });
        } else {
            // Add as local block to current form
            const newForm = { ...activeForm, localBlocks: [...activeForm.localBlocks, newBlock] };
            updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
        }
        setIsAddMenuOpen(false);
    };

    // Reorder Logic
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !isLive) return;

        if (isBaseForm) {
            const oldIndex = charData.blocks.findIndex(b => b.blockId === active.id);
            const newIndex = charData.blocks.findIndex(b => b.blockId === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                const newBlocks = arrayMove(charData.blocks, oldIndex, newIndex);
                updateData({ blocks: newBlocks });
            }
        } else {
            // In derived forms, only allow reordering local blocks amongst themselves for now to avoid complexity
            const oldIndex = activeForm.localBlocks.findIndex(b => b.blockId === active.id);
            const newIndex = activeForm.localBlocks.findIndex(b => b.blockId === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                const newLocals = arrayMove(activeForm.localBlocks, oldIndex, newIndex);
                const newForm = { ...activeForm, localBlocks: newLocals };
                updateData({ forms: { ...charData.forms, items: { ...charData.forms.items, [activeFormId]: newForm } } });
            }
        }
    };

    // Snapshots
    const handleCreateSnapshot = () => {
        const label = prompt("Snapshot Label (e.g. 'End of Arc 1'):");
        if (!label) return;
        
        const snapId = crypto.randomUUID();
        const snapshot: CharacterSnapshot = {
            snapshotId: snapId,
            label,
            formId: activeFormId,
            date: new Date().toLocaleDateString(),
            createdAt: Date.now(),
            resolved: {
                templateId: charData.templateId,
                blocks: resolvedBlocks // Snapshot the currently resolved view
            }
        };

        const newSnapshots = {
            ...charData.snapshots,
            order: [snapId, ...charData.snapshots.order],
            items: { ...charData.snapshots.items, [snapId]: snapshot },
            activeSnapshotId: snapId // Auto-switch to view it
        };
        
        updateData({ snapshots: newSnapshots });
        logNotification(workspace, 'success', `Snapshot created: ${label}`);
    };

    const handleRestoreSnapshot = (snapId: string) => {
        const snap = charData.snapshots.items[snapId];
        if (!snap) return;

        if (confirm(`Restore snapshot "${snap.label}"? This will create a new form.`)) {
            const newFormId = crypto.randomUUID();
            const newForm: any = {
                formId: newFormId,
                name: `${snap.label} (Restored)`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                overrides: {},
                localBlocks: []
            };

            snap.resolved.blocks.forEach(block => {
                const isBase = charData.blocks.find(b => b.blockId === block.blockId);
                if (isBase) {
                    newForm.overrides[block.blockId] = {
                        schemaVersion: 1,
                        payload: block.payload,
                        title: block.title,
                        collapsed: block.collapsed
                    };
                } else {
                    newForm.localBlocks.push(block);
                }
            });

            charData.blocks.forEach(base => {
                const inSnap = snap.resolved.blocks.find(b => b.blockId === base.blockId);
                if (!inSnap) {
                    newForm.overrides[base.blockId] = { schemaVersion: 1, deleted: true };
                }
            });

            updateData({
                forms: {
                    ...charData.forms,
                    order: [...charData.forms.order, newFormId],
                    items: { ...charData.forms.items, [newFormId]: newForm },
                    activeFormId: newFormId
                },
                snapshots: { ...charData.snapshots, activeSnapshotId: null }
            });
        }
    };

    const handleFocusModule = (blockId: string) => {
        const el = document.getElementById(`module-${blockId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // --- Add Module Menu ---
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const availableModules: CharacterBlockType[] = ['identity', 'summary', 'appearance', 'personality', 'stats', 'abilities', 'items', 'relationships', 'history', 'locations', 'tags', 'authorNotes'];

    return (
        <div className="flex flex-col h-full bg-deep-space text-text relative">
            <CharacterHeader 
                note={note} 
                characterData={charData}
                universeTags={workspace.settings.universeTags.tags}
                onUpdate={handleUpdateNote}
                onUpdateData={updateData}
                onCreateSnapshot={handleCreateSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
            />

            <ValidationPanel 
                validation={validationResult} 
                onFocusModule={handleFocusModule} 
                onOpenNote={onOpenNote} 
                strictMode={strictMode}
            />

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={resolvedBlocks.map(b => b.blockId)} strategy={verticalListSortingStrategy}>
                            {resolvedBlocks.map((block, index) => {
                                const isOverride = !isBaseForm && !isLive ? false : (activeForm.overrides[block.blockId] !== undefined);
                                return (
                                    <SortableModuleCard 
                                        key={block.blockId} 
                                        id={block.blockId}
                                        block={block} 
                                        index={index}
                                        onUpdate={(updates: any) => handleBlockUpdate(block.blockId, updates)}
                                        onRemove={() => handleBlockRemove(block.blockId)}
                                        workspace={workspace}
                                        onOpenNote={onOpenNote}
                                        readOnly={!isLive}
                                        isOverride={isOverride}
                                        onUpdateWorkspace={onUpdateWorkspace}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>

                    {isLive && (
                        <div className="relative flex justify-center mt-8">
                            {isAddMenuOpen ? (
                                <div className="absolute bottom-0 mb-12 bg-panel border border-border rounded-lg shadow-2xl p-2 grid grid-cols-2 gap-2 w-64 animate-in fade-in zoom-in-95 z-50">
                                    <div className="col-span-2 flex justify-between items-center px-2 pb-2 border-b border-border mb-1">
                                        <span className="text-[10px] font-bold uppercase text-text2">Add Module</span>
                                        <button onClick={() => setIsAddMenuOpen(false)}><X size={14}/></button>
                                    </div>
                                    {availableModules.map(type => {
                                        const spec = getCharacterModuleSpec(type);
                                        const Icon = spec.icon;
                                        return (
                                            <button 
                                                key={type} 
                                                onClick={() => handleAddModule(type)}
                                                className="flex items-center gap-2 p-2 hover:bg-panel2 rounded text-xs text-left transition-colors border border-transparent hover:border-accent/30"
                                            >
                                                <Icon size={14} className="text-accent"/> {spec.displayName}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                            
                            <Button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="rounded-full px-6 shadow-lg border border-accent/20">
                                <Plus size={16} className="mr-2" /> Add Module {isBaseForm ? '' : '(Local)'}
                            </Button>
                        </div>
                    )}

                    <div className="h-20" />
                </div>
            </div>
        </div>
    );
};

export default CharacterView;