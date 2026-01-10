
import React, { useState } from 'react';
import { Note, CharacterData, NoteStatus, CharacterSnapshot, CharacterForm, Workspace } from '../../types';
import { Input, Select, Button, IconButton } from '../ui/Primitives';
import { Layers, Camera, Globe, Clock, Plus, MoreHorizontal, Check, X, Copy, Trash2, Edit2, RotateCcw, Download, FileJson } from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';
import { createCharacterBundle, createCharacterFullBundle, downloadJSON } from '../../services/modularExportService';

interface CharacterHeaderProps {
    note: Note;
    characterData: CharacterData;
    universeTags: string[];
    onUpdate: (partial: Partial<Note>) => void;
    onUpdateData: (partial: Partial<CharacterData>) => void;
    onCreateSnapshot: () => void;
    onRestoreSnapshot: (snapshotId: string) => void;
    workspace?: Workspace; // Optional for now until passed down, but needed for export resolution
}

const CharacterHeader: React.FC<CharacterHeaderProps> = ({ 
    note, characterData, universeTags, onUpdate, onUpdateData, onCreateSnapshot, onRestoreSnapshot, workspace
}) => {
    const [menuOpen, setMenuOpen] = useState<{ type: 'form' | 'snapshot' | 'main', x: number, y: number } | null>(null);
    const [isRenamingForm, setIsRenamingForm] = useState(false);
    const [tempFormName, setTempFormName] = useState('');

    const forms = characterData.forms;
    const snapshots = characterData.snapshots;
    const activeFormId = forms.activeFormId;
    const activeSnapshotId = snapshots.activeSnapshotId;
    
    const activeForm = forms.items[activeFormId];
    const activeSnapshot = activeSnapshotId ? snapshots.items[activeSnapshotId] : null;

    // Handlers
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ title: e.target.value });
    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => onUpdate({ status: e.target.value as NoteStatus });
    const handleUniverseChange = (e: React.ChangeEvent<HTMLSelectElement>) => onUpdate({ universeTag: e.target.value === 'none' ? null : e.target.value });

    const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateData({ 
            forms: { ...forms, activeFormId: e.target.value },
            snapshots: { ...snapshots, activeSnapshotId: null } // Switching form goes to Live
        });
    };

    const handleSnapshotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onUpdateData({ 
            snapshots: { ...snapshots, activeSnapshotId: val === 'live' ? null : val } 
        });
    };

    const handleCreateForm = () => {
        const name = prompt("New Form Name:");
        if (!name) return;
        const newId = crypto.randomUUID();
        const newForm: CharacterForm = {
            formId: newId,
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            overrides: {},
            localBlocks: []
        };
        onUpdateData({
            forms: {
                ...forms,
                order: [...forms.order, newId],
                items: { ...forms.items, [newId]: newForm },
                activeFormId: newId
            },
            snapshots: { ...snapshots, activeSnapshotId: null }
        });
    };

    const handleDeleteForm = () => {
        if (activeFormId === 'base') return;
        if (!confirm(`Delete form "${activeForm?.name}"?`)) return;
        
        const newItems = { ...forms.items };
        delete newItems[activeFormId];
        const newOrder = forms.order.filter(id => id !== activeFormId);
        
        onUpdateData({
            forms: {
                ...forms,
                activeFormId: 'base', // Fallback to base
                order: newOrder,
                items: newItems
            }
        });
    };

    const handleDuplicateForm = () => {
        const newId = crypto.randomUUID();
        const newForm: CharacterForm = {
            ...activeForm,
            formId: newId,
            name: `${activeForm.name} (Copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        onUpdateData({
            forms: {
                ...forms,
                order: [...forms.order, newId],
                items: { ...forms.items, [newId]: newForm },
                activeFormId: newId
            }
        });
    };

    const startRename = () => {
        setTempFormName(activeForm.name);
        setIsRenamingForm(true);
    };

    const confirmRename = () => {
        if (tempFormName.trim()) {
            onUpdateData({
                forms: {
                    ...forms,
                    items: { ...forms.items, [activeFormId]: { ...activeForm, name: tempFormName.trim() } }
                }
            });
        }
        setIsRenamingForm(false);
    };

    // Export Handlers
    const handleExportBundle = () => {
        if (!workspace) return;
        const bundle = createCharacterBundle(note, workspace);
        if (bundle) {
            const filename = `${note.title.toLowerCase().replace(/\s+/g, '-')}_${note.id.slice(0,6)}_bundle.json`;
            downloadJSON(bundle, filename);
        }
    };

    const handleExportFull = () => {
        if (!workspace) return;
        const bundle = createCharacterFullBundle(note, workspace);
        if (bundle) {
            const filename = `${note.title.toLowerCase().replace(/\s+/g, '-')}_${note.id.slice(0,6)}_full.json`;
            downloadJSON(bundle, filename);
        }
    };

    const formMenu: ContextMenuItem[] = [
        { label: 'Duplicate Form', icon: Copy, onClick: handleDuplicateForm },
        { label: 'Rename', icon: Edit2, onClick: startRename },
        { separator: true },
        { label: 'Delete Form', icon: Trash2, danger: true, disabled: activeFormId === 'base', onClick: handleDeleteForm }
    ];

    const mainMenu: ContextMenuItem[] = [
        { label: 'Export JSON (Current Form)', icon: Download, onClick: handleExportBundle },
        { label: 'Export Full Backup (All Forms)', icon: FileJson, onClick: handleExportFull }
    ];

    return (
        <div className="bg-panel border-b border-border p-4 space-y-4 flex-shrink-0 z-10 select-none">
            {/* Properties */}
            <div className="flex gap-4 items-start">
                <div className="flex-1 flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase text-text2 font-bold mb-1 block">Character Name</label>
                        <Input 
                            value={note.title} 
                            onChange={handleTitleChange} 
                            className="text-lg font-bold bg-panel2 w-full border-border focus:border-accent"
                            placeholder="Unnamed Character"
                        />
                    </div>
                    {/* Main Menu Trigger */}
                    {workspace && (
                        <IconButton size="sm" onClick={(e) => setMenuOpen({ type: 'main', x: e.clientX, y: e.clientY })} className="mb-1">
                            <MoreHorizontal size={16} />
                        </IconButton>
                    )}
                </div>
                <div className="w-32">
                    <label className="text-[10px] uppercase text-text2 font-bold mb-1 block">Status</label>
                    <Select value={note.status} onChange={handleStatusChange} className="text-xs h-9">
                        <option value="Draft">Draft</option>
                        <option value="Canon">Canon</option>
                        <option value="Experimental">Experimental</option>
                        <option value="Outdated">Outdated</option>
                        <option value="Archived">Archived</option>
                    </Select>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-4 items-center">
                
                {/* Universe */}
                <div className="flex items-center gap-2 bg-panel2 border border-border rounded-md px-2 py-1">
                    <Globe size={14} className="text-text2" />
                    <select 
                        value={note.universeTag || 'none'} 
                        onChange={handleUniverseChange}
                        className="bg-transparent text-xs font-medium text-text focus:outline-none appearance-none min-w-[80px]"
                    >
                        <option value="none">Cosmos (None)</option>
                        {universeTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {/* Form Selector */}
                <div className="flex items-center gap-2 bg-panel2 border border-border rounded-md px-2 py-1">
                    <Layers size={14} className={activeFormId === 'base' ? "text-text2" : "text-accent"} />
                    {isRenamingForm ? (
                        <div className="flex items-center gap-1">
                            <input 
                                className="bg-bg border border-border rounded px-1 text-xs w-24"
                                value={tempFormName}
                                onChange={e => setTempFormName(e.target.value)}
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && confirmRename()}
                            />
                            <IconButton size="sm" onClick={confirmRename} className="h-5 w-5"><Check size={12}/></IconButton>
                            <IconButton size="sm" onClick={() => setIsRenamingForm(false)} className="h-5 w-5"><X size={12}/></IconButton>
                        </div>
                    ) : (
                        <>
                            <select 
                                value={activeFormId} 
                                onChange={handleFormChange}
                                className="bg-transparent text-xs font-bold uppercase text-text focus:outline-none appearance-none cursor-pointer min-w-[80px]"
                            >
                                {forms.order.map(id => <option key={id} value={id}>{forms.items[id]?.name || 'Unknown'}</option>)}
                            </select>
                            <IconButton size="sm" onClick={(e) => setMenuOpen({ type: 'form', x: e.clientX, y: e.clientY })} className="h-5 w-5">
                                <MoreHorizontal size={12} />
                            </IconButton>
                            <IconButton size="sm" onClick={handleCreateForm} title="New Form" className="h-5 w-5">
                                <Plus size={12} />
                            </IconButton>
                        </>
                    )}
                </div>

                {/* Snapshot Selector */}
                <div className={`flex items-center gap-2 bg-panel2 border border-border rounded-md px-2 py-1 ${activeSnapshotId ? 'ring-1 ring-warning' : ''}`}>
                    <Camera size={14} className={activeSnapshotId ? "text-warning" : "text-text2"} />
                    <select 
                        value={activeSnapshotId || 'live'}
                        onChange={handleSnapshotChange}
                        className="bg-transparent text-xs font-medium text-text focus:outline-none appearance-none cursor-pointer min-w-[100px]"
                    >
                        <option value="live">Live (Editable)</option>
                        <optgroup label="Snapshots">
                            {snapshots.order.map(id => (
                                <option key={id} value={id}>
                                    {snapshots.items[id]?.label || 'Snapshot'} {snapshots.items[id]?.date ? `(${snapshots.items[id].date})` : ''}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                    {!activeSnapshotId && (
                        <IconButton size="sm" onClick={onCreateSnapshot} title="Capture Snapshot" className="h-5 w-5">
                            <Plus size={12} />
                        </IconButton>
                    )}
                </div>

                <div className="ml-auto text-[10px] text-text2 flex items-center gap-1">
                    <Clock size={12} />
                    <span>Updated {new Date(note.updatedAt).toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Snapshot Banner */}
            {activeSnapshot && (
                <div className="bg-warning/10 border border-warning/30 rounded p-2 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-xs text-warning font-bold">
                        <Camera size={14} />
                        Viewing Snapshot: {activeSnapshot.label} ({new Date(activeSnapshot.createdAt).toLocaleDateString()})
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => onRestoreSnapshot(activeSnapshotId!)} className="h-6 text-[10px] gap-1">
                            <RotateCcw size={12} /> Restore
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => onUpdateData({ snapshots: { ...snapshots, activeSnapshotId: null } })} className="h-6 text-[10px]">
                            Return to Live
                        </Button>
                    </div>
                </div>
            )}

            {menuOpen && (
                <ContextMenu 
                    x={menuOpen.x} 
                    y={menuOpen.y} 
                    items={menuOpen.type === 'form' ? formMenu : menuOpen.type === 'main' ? mainMenu : []} 
                    onClose={() => setMenuOpen(null)} 
                />
            )}
        </div>
    );
};

export default CharacterHeader;