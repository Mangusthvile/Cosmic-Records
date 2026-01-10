
import React from 'react';
import { Input, Panel } from '../../ui/Primitives';
import { Plus, X, Globe, User, Shield, Activity, MapPin, Clock } from 'lucide-react';

// --- Types ---
export interface ModuleProps {
    data: any;
    onChange: (newData: any) => void;
    readOnly?: boolean;
    isOverride?: boolean;
}

// --- Helper Components ---
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col gap-1 mb-3">
        <label className="text-[10px] uppercase font-bold text-text2 tracking-widest">{label}</label>
        {children}
    </div>
);

const TagsInput: React.FC<{ value: string[]; onChange: (val: string[]) => void }> = ({ value = [], onChange }) => {
    const [input, setInput] = React.useState('');
    const add = () => {
        if (input.trim() && !value.includes(input.trim())) {
            onChange([...value, input.trim()]);
            setInput('');
        }
    };
    return (
        <div className="flex flex-wrap gap-2 items-center p-2 bg-bg border border-border rounded min-h-[38px]">
            {value.map(t => (
                <span key={t} className="flex items-center gap-1 bg-panel2 border border-border px-2 py-0.5 rounded text-xs text-text2">
                    {t} <button onClick={() => onChange(value.filter(x => x !== t))}><X size={10}/></button>
                </span>
            ))}
            <input 
                className="bg-transparent border-none outline-none text-xs text-text flex-1 min-w-[80px]"
                placeholder="+ Add tag..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                onBlur={add}
            />
        </div>
    );
};

const TextArea: React.FC<any> = (props) => (
    <textarea className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text resize-y min-h-[80px] focus:outline-none focus:border-accent" {...props} />
);

// --- Modules ---

const SummaryModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div>
        <Field label="Short Summary">
            <Input value={data.shortSummary || ''} onChange={e => onChange({...data, shortSummary: e.target.value})} placeholder="One line description..." />
        </Field>
        <Field label="Full Description">
            <TextArea value={data.longSummary || ''} onChange={(e: any) => onChange({...data, longSummary: e.target.value})} placeholder="Detailed summary..." />
        </Field>
    </div>
);

const IdentityModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Full Name"><Input value={data.fullName || ''} onChange={e => onChange({...data, fullName: e.target.value})} /></Field></div>
        <Field label="Species"><Input value={data.species || ''} onChange={e => onChange({...data, species: e.target.value})} /></Field>
        <Field label="Age"><Input value={data.age || ''} onChange={e => onChange({...data, age: e.target.value})} /></Field>
        <Field label="Role / Class"><Input value={data.roleOrClass || ''} onChange={e => onChange({...data, roleOrClass: e.target.value})} /></Field>
        <Field label="Status"><Input value={data.statusNote || ''} onChange={e => onChange({...data, statusNote: e.target.value})} placeholder="e.g. Active, Deceased" /></Field>
        <div className="col-span-2">
            <Field label="Aliases"><TagsInput value={data.aliases || []} onChange={v => onChange({...data, aliases: v})} /></Field>
        </div>
        <div className="col-span-2">
            <Field label="Affiliations"><TagsInput value={data.affiliations || []} onChange={v => onChange({...data, affiliations: v})} /></Field>
        </div>
    </div>
);

const AppearanceModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div className="grid grid-cols-2 gap-4">
        <Field label="Height"><Input value={data.height || ''} onChange={e => onChange({...data, height: e.target.value})} /></Field>
        <Field label="Build"><Input value={data.build || ''} onChange={e => onChange({...data, build: e.target.value})} /></Field>
        <Field label="Hair"><Input value={data.hair || ''} onChange={e => onChange({...data, hair: e.target.value})} /></Field>
        <Field label="Eyes"><Input value={data.eyes || ''} onChange={e => onChange({...data, eyes: e.target.value})} /></Field>
        <div className="col-span-2"><Field label="Distinguishing Marks"><TagsInput value={data.distinguishingMarks || []} onChange={v => onChange({...data, distinguishingMarks: v})} /></Field></div>
        <div className="col-span-2"><Field label="Description"><TextArea value={data.description || ''} onChange={(e: any) => onChange({...data, description: e.target.value})} /></Field></div>
    </div>
);

const PersonalityModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div>
        <Field label="Traits"><TagsInput value={data.traits || []} onChange={v => onChange({...data, traits: v})} /></Field>
        <div className="grid grid-cols-2 gap-4">
            <Field label="Virtues"><TagsInput value={data.virtues || []} onChange={v => onChange({...data, virtues: v})} /></Field>
            <Field label="Flaws"><TagsInput value={data.flaws || []} onChange={v => onChange({...data, flaws: v})} /></Field>
        </div>
        <Field label="Demeanor"><TextArea value={data.demeanor || ''} onChange={(e: any) => onChange({...data, demeanor: e.target.value})} /></Field>
    </div>
);

const AbilitiesModule: React.FC<ModuleProps> = ({ data, onChange }) => {
    const entries = data.abilities || [];
    const add = () => onChange({ ...data, abilities: [...entries, { name: '', type: '', description: '' }] });
    const update = (idx: number, field: string, val: any) => {
        const next = [...entries];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ ...data, abilities: next });
    };
    const remove = (idx: number) => onChange({ ...data, abilities: entries.filter((_: any, i: number) => i !== idx) });

    return (
        <div>
            {entries.map((item: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-bg border border-border rounded relative group">
                    <button onClick={() => remove(i)} className="absolute top-2 right-2 text-text2 hover:text-danger opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    <div className="flex gap-2 mb-2 pr-6">
                        <Input className="flex-1 font-bold" placeholder="Ability Name" value={item.name} onChange={e => update(i, 'name', e.target.value)} />
                        <Input className="w-1/3 text-xs" placeholder="Type" value={item.type} onChange={e => update(i, 'type', e.target.value)} />
                    </div>
                    <TextArea placeholder="Description..." value={item.description} onChange={(e: any) => update(i, 'description', e.target.value)} className="min-h-[50px] text-xs" />
                </div>
            ))}
            <button onClick={add} className="w-full py-1 border border-dashed border-border rounded text-xs text-text2 hover:text-accent hover:border-accent flex items-center justify-center gap-1">
                <Plus size={12} /> Add Ability
            </button>
            <div className="mt-4"><Field label="Power System Notes"><TextArea value={data.powerSystemNotes || ''} onChange={(e: any) => onChange({...data, powerSystemNotes: e.target.value})} /></Field></div>
        </div>
    );
};

const RelationshipsModule: React.FC<ModuleProps> = ({ data, onChange }) => {
    const entries = data.relationships || [];
    const add = () => onChange({ ...data, relationships: [...entries, { nameFallback: '', relationshipType: '', notes: '' }] });
    const update = (idx: number, field: string, val: any) => {
        const next = [...entries];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ ...data, relationships: next });
    };
    const remove = (idx: number) => onChange({ ...data, relationships: entries.filter((_: any, i: number) => i !== idx) });

    return (
        <div>
            {entries.map((item: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-bg border border-border rounded relative group">
                    <button onClick={() => remove(i)} className="absolute top-2 right-2 text-text2 hover:text-danger opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    <div className="flex gap-2 mb-2 pr-6">
                        <Input className="flex-1 font-bold" placeholder="Character Name" value={item.nameFallback} onChange={e => update(i, 'nameFallback', e.target.value)} />
                        <Input className="w-1/3 text-xs" placeholder="Relation" value={item.relationshipType} onChange={e => update(i, 'relationshipType', e.target.value)} />
                    </div>
                    <TextArea placeholder="Notes..." value={item.notes} onChange={(e: any) => update(i, 'notes', e.target.value)} className="min-h-[40px] text-xs" />
                </div>
            ))}
            <button onClick={add} className="w-full py-1 border border-dashed border-border rounded text-xs text-text2 hover:text-accent hover:border-accent flex items-center justify-center gap-1">
                <Plus size={12} /> Add Relationship
            </button>
        </div>
    );
};

const ItemsModule: React.FC<ModuleProps> = ({ data, onChange }) => {
    const entries = data.items || [];
    const add = () => onChange({ ...data, items: [...entries, { name: '', description: '', isEquipped: false }] });
    const update = (idx: number, field: string, val: any) => {
        const next = [...entries];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ ...data, items: next });
    };
    const remove = (idx: number) => onChange({ ...data, items: entries.filter((_: any, i: number) => i !== idx) });

    return (
        <div>
            {entries.map((item: any, i: number) => (
                <div key={i} className="mb-1 flex items-center gap-2 p-2 bg-bg border border-border rounded group">
                    <input type="checkbox" checked={item.isEquipped} onChange={e => update(i, 'isEquipped', e.target.checked)} title="Equipped" />
                    <Input className="flex-1 text-sm h-7" placeholder="Item Name" value={item.name} onChange={e => update(i, 'name', e.target.value)} />
                    <Input className="flex-1 text-xs h-7 text-text2" placeholder="Description" value={item.description} onChange={e => update(i, 'description', e.target.value)} />
                    <button onClick={() => remove(i)} className="text-text2 hover:text-danger opacity-0 group-hover:opacity-100"><X size={12} /></button>
                </div>
            ))}
            <button onClick={add} className="w-full py-1 border border-dashed border-border rounded text-xs text-text2 hover:text-accent hover:border-accent flex items-center justify-center gap-1 mt-2">
                <Plus size={12} /> Add Item
            </button>
        </div>
    );
};

const HistoryModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div>
        <Field label="Background"><TextArea value={data.background || ''} onChange={(e: any) => onChange({...data, background: e.target.value})} /></Field>
        <Field label="Key Events">
            <div className="space-y-2">
                {(data.keyEvents || []).map((ev: any, i: number) => (
                    <div key={i} className="p-2 bg-bg border border-border rounded text-xs">
                        <div className="font-bold flex justify-between">{ev.title} <span className="font-mono font-normal opacity-50">{ev.dateText}</span></div>
                        <div className="opacity-70 mt-1">{ev.description}</div>
                    </div>
                ))}
                <div className="text-[10px] text-text2 italic text-center">Event list editing usually handled via dedicated Event notes in Milestone 7. For now, use Background field.</div>
            </div>
        </Field>
    </div>
);

const LocationsModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div className="grid grid-cols-2 gap-4">
        <Field label="Origin"><Input value={data.originPlace?.nameFallback || ''} onChange={e => onChange({...data, originPlace: { ...data.originPlace, nameFallback: e.target.value }})} placeholder="Place name" /></Field>
        <Field label="Current Location"><Input value={data.currentPlace?.nameFallback || ''} onChange={e => onChange({...data, currentPlace: { ...data.currentPlace, nameFallback: e.target.value }})} placeholder="Place name" /></Field>
        <div className="col-span-2"><Field label="Travel Notes"><TextArea value={data.travelNotes || ''} onChange={(e: any) => onChange({...data, travelNotes: e.target.value})} /></Field></div>
    </div>
);

const GenericModule: React.FC<ModuleProps> = ({ data, onChange }) => (
    <div className="text-xs text-muted italic">Generic Data: {JSON.stringify(data)}</div>
);

export const MODULE_REGISTRY: Record<string, React.FC<ModuleProps>> = {
    'summary': SummaryModule,
    'identity': IdentityModule,
    'appearance': AppearanceModule,
    'personality': PersonalityModule,
    'abilities': AbilitiesModule,
    'relationships': RelationshipsModule,
    'items': ItemsModule,
    'history': HistoryModule,
    'locations': LocationsModule,
    'generic': GenericModule
};
