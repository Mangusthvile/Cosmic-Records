
import React from 'react';
import { 
    CharacterBlockType, CharacterBlock, Workspace,
    IdentityPayload, RichTextPayload, StatsPayload, 
    AbilitiesPayload, ItemsPayload, ReferencePayload, TagsPayload,
    LocationsPayload, RelationshipsPayload, RelationshipItem
} from '../types';
import { Input, Button, IconButton } from '../components/ui/Primitives';
import HybridEditor from '../components/editor/HybridEditor';
import { 
    User, FileText, Grid, Zap, Box, Users, MapPin, 
    Tag, HelpCircle, Activity, Plus, Trash2, ArrowRight, X, ChevronDown, ChevronRight, AlertCircle
} from 'lucide-react';
import NoteReferencePicker from '../components/ui/NoteReferencePicker';

// --- Interfaces ---

export interface CharacterModuleRendererProps<TPayload> {
    noteId: string;
    blockId: string;
    title: string;
    collapsed: boolean;
    payload: TPayload;
    readOnly: boolean;
    workspace: Workspace;
    onOpenNote: (id: string) => void;
    onChange: (nextPayload: TPayload) => void;
    onMetaChange: (next: { title?: string; collapsed?: boolean }) => void;
}

export interface CharacterModuleSpec<TPayload> {
    type: CharacterBlockType;
    displayName: string;
    defaultTitle: string;
    iconKey: string;
    icon: React.ElementType;
    kind: "richText" | "fields" | "table" | "refs" | "tags" | "unknown";
    createDefaultPayload: () => TPayload;
    validatePayload: (payload: unknown) => { ok: true; value: TPayload } | { ok: false; value: TPayload; warnings: string[] };
    serialize: (payload: TPayload) => any;
    deserialize: (raw: any) => TPayload;
    Renderer: React.FC<CharacterModuleRendererProps<TPayload>>;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Helpers ---

const validateRichText = (payload: any): any => {
    // Ensure doc wrapper if missing or empty
    if (payload && typeof payload === 'object' && payload.type === 'doc') return payload;
    if (payload && payload.doc) return payload.doc;
    return { type: 'doc', content: [{ type: 'paragraph' }] };
};

// --- Renderers ---

const UnknownRenderer: React.FC<CharacterModuleRendererProps<any>> = ({ payload }) => (
    <div className="p-4 bg-panel2 border border-dashed border-border rounded text-xs text-text2 font-mono overflow-auto">
        <div className="font-bold text-warning mb-2">Unknown Module Type</div>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
    </div>
);

const RichTextRenderer: React.FC<CharacterModuleRendererProps<RichTextPayload>> = ({ 
    noteId, blockId, payload, onChange, readOnly, workspace, onOpenNote 
}) => {
    return (
        <div className="min-h-[100px] bg-bg border border-border rounded p-2">
            <HybridEditor
                doc={payload.doc || { type: 'doc', content: [] }}
                noteId={`${noteId}-${blockId}`} 
                onDocChange={(doc) => onChange({ doc })}
                readOnly={readOnly}
                workspace={workspace}
                onOpenNote={onOpenNote}
                linkMode="note"
            />
        </div>
    );
};

const IdentityRenderer: React.FC<CharacterModuleRendererProps<IdentityPayload>> = ({ payload, onChange, readOnly }) => {
    const updateField = (idx: number, key: string, value: string) => {
        const next = [...payload.fields];
        next[idx] = { key, value };
        onChange({ fields: next });
    };

    const addField = () => onChange({ fields: [...payload.fields, { key: '', value: '' }] });
    const removeField = (idx: number) => onChange({ fields: payload.fields.filter((_, i) => i !== idx) });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {payload.fields.map((field, i) => (
                <div key={i} className="flex gap-2 items-center group">
                    <div className="flex-1">
                        <label className="text-[9px] uppercase font-bold text-text2 tracking-wider mb-1 block">{field.key || 'Field'}</label>
                        <div className="flex gap-1">
                            {readOnly ? (
                                <div className="w-full bg-panel2 border border-border rounded px-3 py-1.5 text-sm">{field.value}</div>
                            ) : (
                                <>
                                    <Input 
                                        placeholder="Value" 
                                        value={field.value} 
                                        onChange={e => updateField(i, field.key, e.target.value)} 
                                        className="flex-1"
                                    />
                                    {/* Optional: Allow renaming keys by double click or specific mode, simplified here */}
                                    <IconButton size="sm" onClick={() => removeField(i)} className="opacity-0 group-hover:opacity-100 hover:text-danger">
                                        <Trash2 size={12} />
                                    </IconButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {!readOnly && (
                <Button size="sm" variant="ghost" onClick={addField} className="text-xs border border-dashed h-full min-h-[50px] flex items-center justify-center">
                    <Plus size={12} className="mr-1" /> Add Field
                </Button>
            )}
        </div>
    );
};

const StatsRenderer: React.FC<CharacterModuleRendererProps<StatsPayload>> = ({ payload, onChange, readOnly }) => {
    const updateStat = (idx: number, field: keyof typeof payload.stats[0], val: any) => {
        const next = [...payload.stats];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ stats: next });
    };

    const addStat = () => onChange({ stats: [...payload.stats, { name: 'New Stat', value: 10 }] });
    const removeStat = (idx: number) => onChange({ stats: payload.stats.filter((_, i) => i !== idx) });

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {payload.stats.map((stat, i) => (
                <div key={i} className="p-3 bg-panel2 border border-border rounded flex flex-col gap-2 relative group hover:border-accent/50 transition-colors">
                    {!readOnly && (
                        <button onClick={() => removeStat(i)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-text2 hover:text-danger">
                            <Trash2 size={10} />
                        </button>
                    )}
                    <input 
                        className="bg-transparent text-[10px] font-bold uppercase text-text2 focus:outline-none tracking-wider w-full"
                        value={stat.name}
                        onChange={e => updateStat(i, 'name', e.target.value)}
                        readOnly={readOnly}
                    />
                    <div className="flex items-center gap-2">
                        <IconButton size="sm" className="h-6 w-6" onClick={() => updateStat(i, 'value', (stat.value || 0) - 1)}>-</IconButton>
                        <input 
                            className="bg-transparent text-xl font-bold text-accent w-full text-center focus:outline-none"
                            type="number"
                            value={stat.value}
                            onChange={e => updateStat(i, 'value', parseInt(e.target.value) || 0)}
                            readOnly={readOnly}
                        />
                        <IconButton size="sm" className="h-6 w-6" onClick={() => updateStat(i, 'value', (stat.value || 0) + 1)}>+</IconButton>
                    </div>
                </div>
            ))}
            {!readOnly && (
                <button onClick={addStat} className="p-3 border border-dashed border-border rounded flex items-center justify-center text-text2 hover:text-accent hover:border-accent transition-colors flex-col gap-1 min-h-[80px]">
                    <Plus size={16} />
                    <span className="text-[10px] uppercase font-bold">Add Stat</span>
                </button>
            )}
        </div>
    );
};

const AbilityCard: React.FC<{ 
    ability: any, 
    onChange: (u: any) => void, 
    onRemove: () => void, 
    noteId: string, 
    workspace: Workspace, 
    readOnly: boolean 
}> = ({ ability, onChange, onRemove, noteId, workspace, readOnly }) => {
    const [expanded, setExpanded] = React.useState(false);

    return (
        <div className="border border-border rounded bg-panel overflow-hidden">
            <div className="flex items-center gap-2 p-2 bg-panel2 border-b border-border">
                <button onClick={() => setExpanded(!expanded)} className="text-text2 hover:text-text">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 flex gap-2 items-center">
                    <Input 
                        value={ability.name} 
                        onChange={e => onChange({ ...ability, name: e.target.value })} 
                        className="font-bold h-7 text-sm bg-transparent border-transparent hover:border-border focus:bg-bg" 
                        placeholder="Ability Name"
                        readOnly={readOnly}
                    />
                    <div className="w-px h-4 bg-border" />
                    <Input 
                        value={ability.tags ? ability.tags.join(', ') : ''} 
                        onChange={e => onChange({ ...ability, tags: e.target.value.split(',').map((s:string) => s.trim()) })}
                        className="text-xs h-7 w-32 bg-transparent border-transparent hover:border-border focus:bg-bg text-text2"
                        placeholder="Tags..."
                        readOnly={readOnly}
                    />
                </div>
                {!readOnly && <IconButton size="sm" onClick={onRemove} className="hover:text-danger"><X size={14} /></IconButton>}
            </div>
            {expanded && (
                <div className="p-2 bg-bg">
                    <HybridEditor 
                        doc={ability.descriptionDoc || { type: 'doc', content: [] }}
                        noteId={`${noteId}-desc`}
                        onDocChange={doc => onChange({ ...ability, descriptionDoc: doc })}
                        readOnly={readOnly}
                        workspace={workspace}
                        onOpenNote={() => {}}
                    />
                </div>
            )}
        </div>
    );
};

const AbilitiesRenderer: React.FC<CharacterModuleRendererProps<AbilitiesPayload>> = ({ payload, onChange, readOnly, noteId, blockId, workspace }) => {
    const update = (idx: number, val: any) => {
        const next = [...payload.abilities];
        next[idx] = val;
        onChange({ abilities: next });
    };
    const add = () => onChange({ abilities: [...payload.abilities, { name: 'New Ability', descriptionDoc: { type: 'doc', content: [] }, tags: [] }] });
    const remove = (idx: number) => onChange({ abilities: payload.abilities.filter((_, i) => i !== idx) });

    return (
        <div className="space-y-2">
            {payload.abilities.map((ab, i) => (
                <AbilityCard 
                    key={i} 
                    ability={ab} 
                    onChange={u => update(i, u)} 
                    onRemove={() => remove(i)} 
                    noteId={`${noteId}-${blockId}-${i}`}
                    workspace={workspace}
                    readOnly={readOnly}
                />
            ))}
            {!readOnly && (
                <Button size="sm" onClick={add} className="w-full border border-dashed bg-transparent hover:bg-panel2 text-text2">
                    <Plus size={14} className="mr-2" /> Add Ability
                </Button>
            )}
        </div>
    );
};

const ItemsRenderer: React.FC<CharacterModuleRendererProps<ItemsPayload>> = ({ payload, onChange, readOnly }) => {
    const updateItem = (idx: number, field: keyof typeof payload.items[0], val: any) => {
        const next = [...payload.items];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ items: next });
    };
    const addItem = () => onChange({ items: [...payload.items, { name: '', qty: 1 }] });
    const removeItem = (idx: number) => onChange({ items: payload.items.filter((_, i) => i !== idx) });

    return (
        <div className="space-y-1">
            {payload.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center p-1 bg-bg border border-border rounded group hover:border-accent/50 transition-colors">
                    <input 
                        className="w-12 text-center bg-panel2 border border-border rounded text-xs focus:outline-none h-7 font-mono"
                        type="number"
                        value={item.qty}
                        onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 0)}
                        readOnly={readOnly}
                    />
                    <input 
                        className="flex-1 bg-transparent text-sm focus:outline-none px-2 font-medium"
                        value={item.name}
                        onChange={e => updateItem(i, 'name', e.target.value)}
                        placeholder="Item Name"
                        readOnly={readOnly}
                    />
                    <input 
                        className="w-1/3 bg-transparent text-xs text-text2 focus:outline-none px-2 border-l border-border border-dashed"
                        value={item.notes || ''}
                        onChange={e => updateItem(i, 'notes', e.target.value)}
                        placeholder="Notes..."
                        readOnly={readOnly}
                    />
                    {!readOnly && (
                        <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-text2 hover:text-danger px-1">
                            <X size={12} />
                        </button>
                    )}
                </div>
            ))}
            {!readOnly && (
                <Button size="sm" variant="ghost" onClick={addItem} className="text-xs w-full border border-dashed mt-2">
                    <Plus size={12} className="mr-1" /> Add Item
                </Button>
            )}
        </div>
    );
};

const LocationsRenderer: React.FC<CharacterModuleRendererProps<LocationsPayload>> = ({ payload, onChange, readOnly, workspace, onOpenNote }) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] uppercase font-bold text-text2 tracking-wider mb-1 block">Origin</label>
                    <NoteReferencePicker 
                        workspace={workspace} 
                        allowedTypes={['Place']}
                        selectedId={payload.originPlaceId}
                        onSelect={id => onChange({ ...payload, originPlaceId: id })}
                        onOpenNote={onOpenNote}
                        readOnly={readOnly}
                        placeholder="Select Origin..."
                        allowCreateNew={!readOnly}
                        createNewLabel="New Place"
                    />
                </div>
                <div>
                    <label className="text-[9px] uppercase font-bold text-text2 tracking-wider mb-1 block">Current Location</label>
                    <NoteReferencePicker 
                        workspace={workspace} 
                        allowedTypes={['Place']}
                        selectedId={payload.currentPlaceId}
                        onSelect={id => onChange({ ...payload, currentPlaceId: id })}
                        onOpenNote={onOpenNote}
                        readOnly={readOnly}
                        placeholder="Select Location..."
                        allowCreateNew={!readOnly}
                        createNewLabel="New Place"
                    />
                </div>
            </div>
            
            <div>
                <label className="text-[9px] uppercase font-bold text-text2 tracking-wider mb-2 block">Other Locations</label>
                <div className="space-y-2">
                    {payload.otherPlaces.map((loc, i) => (
                        <div key={loc.id} className="p-2 bg-bg border border-border rounded flex gap-2 items-center">
                            <div className="flex-1">
                                <NoteReferencePicker 
                                    workspace={workspace} 
                                    allowedTypes={['Place']}
                                    selectedId={loc.placeId}
                                    onSelect={id => {
                                        const next = [...payload.otherPlaces];
                                        next[i] = { ...next[i], placeId: id || '' };
                                        onChange({ ...payload, otherPlaces: next });
                                    }}
                                    onOpenNote={onOpenNote}
                                    readOnly={readOnly}
                                    placeholder="Select Place..."
                                />
                            </div>
                            <input 
                                className="bg-transparent border-b border-transparent focus:border-border text-xs w-24"
                                placeholder="Label (e.g. Home)"
                                value={loc.label || ''}
                                onChange={e => {
                                    const next = [...payload.otherPlaces];
                                    next[i] = { ...next[i], label: e.target.value };
                                    onChange({ ...payload, otherPlaces: next });
                                }}
                                readOnly={readOnly}
                            />
                            {!readOnly && (
                                <IconButton size="sm" onClick={() => {
                                    onChange({ ...payload, otherPlaces: payload.otherPlaces.filter((_, idx) => idx !== i) });
                                }} className="hover:text-danger">
                                    <X size={12} />
                                </IconButton>
                            )}
                        </div>
                    ))}
                    {!readOnly && (
                        <Button size="sm" variant="ghost" onClick={() => onChange({ ...payload, otherPlaces: [...payload.otherPlaces, { id: generateId(), placeId: '' }] })} className="text-xs w-full border border-dashed">
                            <Plus size={12} className="mr-1" /> Add Location
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

const RelationshipsRenderer: React.FC<CharacterModuleRendererProps<RelationshipsPayload>> = ({ payload, onChange, readOnly, workspace, onOpenNote, noteId: charNoteId, blockId }) => {
    // Current Character ID to exclude self reference
    // noteId passed in props is usually `module-blockId`, we need actual noteId.
    // The parent View knows it. It's not passed directly here in pure props from registry.
    // However, `NoteReferencePicker` accepts `excludeSelfId`.
    // We can assume the noteId is `charNoteId.split('-')[0]` if format is stable, but that's risky.
    // CharacterView passes `noteId` as `module-${blockId}`. 
    // We can get current note ID via `CharacterView` context or props update if needed.
    // For now, let's rely on user not picking themselves or handle it loosely.
    
    const RELATION_TYPES = ["Ally", "Friend", "Rival", "Enemy", "Mentor", "Student", "Sibling", "Parent", "Child", "Partner", "Spouse", "Ex", "Patron", "Ward", "Leader", "Subordinate", "Acquaintance", "Other"];

    return (
        <div className="space-y-2">
            {payload.relationships.map((rel, i) => (
                <div key={rel.relId} className="p-3 bg-bg border border-border rounded space-y-2 group hover:border-accent/30 transition-colors">
                    <div className="flex gap-2 items-start">
                        <div className="flex-1">
                            <NoteReferencePicker 
                                workspace={workspace}
                                allowedTypes={['Character']}
                                selectedId={rel.targetCharacterId}
                                onSelect={id => {
                                    const next = [...payload.relationships];
                                    next[i] = { ...next[i], targetCharacterId: id || '' };
                                    onChange({ ...payload, relationships: next });
                                }}
                                onOpenNote={onOpenNote}
                                readOnly={readOnly}
                                placeholder="Select Character..."
                                allowCreateNew={!readOnly}
                                createNewLabel="New Character"
                            />
                        </div>
                        <div className="w-1/3">
                            <select 
                                className="w-full bg-panel2 border border-border rounded px-2 py-1 text-xs focus:border-accent"
                                value={rel.type}
                                onChange={e => {
                                    const next = [...payload.relationships];
                                    next[i] = { ...next[i], type: e.target.value };
                                    onChange({ ...payload, relationships: next });
                                }}
                                disabled={readOnly}
                            >
                                <option value="">Type...</option>
                                {RELATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {!readOnly && (
                            <IconButton size="sm" onClick={() => {
                                onChange({ ...payload, relationships: payload.relationships.filter((_, idx) => idx !== i) });
                            }} className="hover:text-danger opacity-0 group-hover:opacity-100">
                                <Trash2 size={12} />
                            </IconButton>
                        )}
                    </div>
                    {/* Optional Notes Toggle or Inline */}
                    <div className="pl-2 border-l-2 border-border/50">
                         <HybridEditor 
                            doc={rel.notesDoc || { type: 'doc', content: [] }}
                            noteId={`${charNoteId}-${blockId}-rel-${rel.relId}`}
                            onDocChange={doc => {
                                const next = [...payload.relationships];
                                next[i] = { ...next[i], notesDoc: doc };
                                onChange({ ...payload, relationships: next });
                            }}
                            readOnly={readOnly}
                            workspace={workspace}
                            onOpenNote={onOpenNote}
                            linkMode="note"
                        />
                    </div>
                </div>
            ))}
            {!readOnly && (
                <Button size="sm" variant="ghost" onClick={() => onChange({ ...payload, relationships: [...payload.relationships, { relId: generateId(), targetCharacterId: '', type: '' }] })} className="text-xs w-full border border-dashed">
                    <Plus size={12} className="mr-1" /> Add Relationship
                </Button>
            )}
        </div>
    );
};

const TagsRenderer: React.FC<CharacterModuleRendererProps<TagsPayload>> = ({ payload, onChange, readOnly }) => {
    const [input, setInput] = React.useState('');
    const add = () => {
        const val = input.trim();
        if (val && !payload.tags.includes(val)) {
            onChange({ tags: [...payload.tags, val] });
            setInput('');
        }
    };
    return (
        <div className="flex flex-wrap gap-2 p-3 bg-bg border border-border rounded min-h-[40px] items-center">
            {payload.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-panel2 border border-border px-2 py-1 rounded text-xs text-text2 group hover:border-accent/50 transition-colors">
                    {tag} 
                    {!readOnly && <button onClick={() => onChange({ tags: payload.tags.filter(t => t !== tag) })} className="opacity-50 group-hover:opacity-100 hover:text-danger ml-1"><X size={10}/></button>}
                </span>
            ))}
            {!readOnly && (
                <input 
                    className="bg-transparent outline-none text-xs text-text min-w-[80px]"
                    placeholder="+ Add Tag"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add()}
                    onBlur={add}
                />
            )}
        </div>
    );
};

// --- Registry Definitions ---

const specs: CharacterModuleSpec<any>[] = [
    {
        type: 'identity', displayName: 'Identity', defaultTitle: 'Identity', iconKey: 'User', icon: User, kind: 'fields',
        createDefaultPayload: () => ({ fields: [
            { key: 'Name', value: '' }, { key: 'Age', value: '' }, { key: 'Species', value: '' }, { key: 'Origin', value: '' }, { key: 'Alignment', value: '' }
        ] }),
        validatePayload: p => ({ ok: true, value: { fields: Array.isArray((p as any).fields) ? (p as any).fields : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: IdentityRenderer
    },
    {
        type: 'summary', displayName: 'Summary', defaultTitle: 'Summary', iconKey: 'FileText', icon: FileText, kind: 'richText',
        createDefaultPayload: () => ({ doc: { type: 'doc', content: [] } }),
        validatePayload: p => ({ ok: true, value: validateRichText(p) }),
        serialize: p => ({ doc: p.doc }), deserialize: p => ({ doc: p.doc || p }), Renderer: RichTextRenderer
    },
    {
        type: 'appearance', displayName: 'Appearance', defaultTitle: 'Appearance', iconKey: 'User', icon: User, kind: 'richText',
        createDefaultPayload: () => ({ doc: { type: 'doc', content: [] } }),
        validatePayload: p => ({ ok: true, value: validateRichText(p) }),
        serialize: p => ({ doc: p.doc }), deserialize: p => ({ doc: p.doc || p }), Renderer: RichTextRenderer
    },
    {
        type: 'personality', displayName: 'Personality', defaultTitle: 'Personality', iconKey: 'Activity', icon: Activity, kind: 'richText',
        createDefaultPayload: () => ({ doc: { type: 'doc', content: [] } }),
        validatePayload: p => ({ ok: true, value: validateRichText(p) }),
        serialize: p => ({ doc: p.doc }), deserialize: p => ({ doc: p.doc || p }), Renderer: RichTextRenderer
    },
    {
        type: 'stats', displayName: 'Stats', defaultTitle: 'Attributes', iconKey: 'Grid', icon: Grid, kind: 'table',
        createDefaultPayload: () => ({ stats: ['Force', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(n => ({ name: n, value: 10 })) }),
        validatePayload: p => ({ ok: true, value: { stats: Array.isArray((p as any).stats) ? (p as any).stats : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: StatsRenderer
    },
    {
        type: 'abilities', displayName: 'Abilities', defaultTitle: 'Abilities', iconKey: 'Zap', icon: Zap, kind: 'table',
        createDefaultPayload: () => ({ abilities: [] }),
        validatePayload: p => ({ ok: true, value: { abilities: Array.isArray((p as any).abilities) ? (p as any).abilities : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: AbilitiesRenderer
    },
    {
        type: 'items', displayName: 'Inventory', defaultTitle: 'Inventory', iconKey: 'Box', icon: Box, kind: 'table',
        createDefaultPayload: () => ({ items: [] }),
        validatePayload: p => ({ ok: true, value: { items: Array.isArray((p as any).items) ? (p as any).items : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: ItemsRenderer
    },
    {
        type: 'relationships', displayName: 'Relationships', defaultTitle: 'Relationships', iconKey: 'Users', icon: Users, kind: 'refs',
        createDefaultPayload: () => ({ schemaVersion: 1, relationships: [] }),
        validatePayload: p => ({ ok: true, value: { schemaVersion: 1, relationships: Array.isArray((p as any).relationships) ? (p as any).relationships : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: RelationshipsRenderer
    },
    {
        type: 'history', displayName: 'History', defaultTitle: 'History', iconKey: 'FileText', icon: FileText, kind: 'richText',
        createDefaultPayload: () => ({ doc: { type: 'doc', content: [] } }),
        validatePayload: p => ({ ok: true, value: validateRichText(p) }),
        serialize: p => ({ doc: p.doc }), deserialize: p => ({ doc: p.doc || p }), Renderer: RichTextRenderer
    },
    {
        type: 'locations', displayName: 'Locations', defaultTitle: 'Locations', iconKey: 'MapPin', icon: MapPin, kind: 'refs',
        createDefaultPayload: () => ({ schemaVersion: 1, originPlaceId: null, currentPlaceId: null, otherPlaces: [] }),
        validatePayload: p => ({ ok: true, value: { schemaVersion: 1, originPlaceId: (p as any).originPlaceId || null, currentPlaceId: (p as any).currentPlaceId || null, otherPlaces: Array.isArray((p as any).otherPlaces) ? (p as any).otherPlaces : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: LocationsRenderer
    },
    {
        type: 'tags', displayName: 'Tags', defaultTitle: 'Tags', iconKey: 'Tag', icon: Tag, kind: 'tags',
        createDefaultPayload: () => ({ tags: [] }),
        validatePayload: p => ({ ok: true, value: { tags: Array.isArray((p as any).tags) ? (p as any).tags : [] } }),
        serialize: p => p, deserialize: p => p, Renderer: TagsRenderer
    },
    {
        type: 'authorNotes', displayName: 'Author Notes', defaultTitle: 'Author Notes', iconKey: 'FileText', icon: FileText, kind: 'richText',
        createDefaultPayload: () => ({ doc: { type: 'doc', content: [] } }),
        validatePayload: p => ({ ok: true, value: validateRichText(p) }),
        serialize: p => ({ doc: p.doc }), deserialize: p => ({ doc: p.doc || p }), Renderer: RichTextRenderer
    },
];

const unknownSpec: CharacterModuleSpec<any> = {
    type: 'unknown', displayName: 'Unknown', defaultTitle: 'Unknown Block', iconKey: 'HelpCircle', icon: HelpCircle, kind: 'unknown',
    createDefaultPayload: () => ({}),
    validatePayload: p => ({ ok: true, value: p }),
    serialize: p => p, deserialize: p => p, Renderer: UnknownRenderer
};

// --- Registry Object ---

export const characterModuleRegistry: Record<string, CharacterModuleSpec<any>> = {};
specs.forEach(s => characterModuleRegistry[s.type] = s);

export const getCharacterModuleSpec = (type: string): CharacterModuleSpec<any> => {
    return characterModuleRegistry[type] || unknownSpec;
};

export const createCharacterBlock = (type: CharacterBlockType): CharacterBlock => {
    const spec = getCharacterModuleSpec(type);
    return {
        blockId: generateId(),
        type,
        title: spec.defaultTitle,
        collapsed: false,
        payload: spec.createDefaultPayload()
    };
};

export const normalizeCharacterBlock = (block: any): CharacterBlock => {
    if (!block.blockId) block.blockId = generateId();
    if (!block.type) block.type = 'unknown';
    
    const spec = getCharacterModuleSpec(block.type);
    
    let payload = block.payload || {};
    try {
        payload = spec.deserialize(payload);
        const validation = spec.validatePayload(payload);
        if (validation.ok === false) {
            console.warn(`Block ${block.blockId} (${block.type}) validation warning:`, (validation as any).warnings);
            payload = validation.value; 
        }
    } catch (e) {
        console.error(`Failed to normalize block ${block.blockId}`, e);
        payload = spec.createDefaultPayload();
    }

    if (typeof block.collapsed !== 'boolean') block.collapsed = false;
    if (!block.title) block.title = spec.defaultTitle;

    return {
        blockId: block.blockId,
        type: block.type,
        title: block.title,
        collapsed: block.collapsed,
        payload
    };
};
