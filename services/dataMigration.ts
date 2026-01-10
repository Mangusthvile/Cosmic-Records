
import { Workspace, Note, CharacterData, CharacterForm, ModuleInstance, PrimitiveModuleType, CharacterBlockType, RecordKind } from '../types';
import { parseWikiLinks } from './linkService';
import { ensureUnresolvedNote } from './storageService';
import { createCharacterBlock, normalizeCharacterBlock } from './modularModuleRegistry';
import { ensureFormsStructure } from './modularResolution';

// --- Helper: Convert legacy string/v1 to v2 doc with InternalLinks ---

export const migrateContent = (note: Note, workspace: Workspace): { doc: any, changed: boolean } => {
    const content = note.content;
    let doc = { type: 'doc', content: [] as any[] };
    let changed = false;

    // Case 1: String content (Legacy)
    if (typeof content === 'string') {
        const paragraphs = content.split('\n');
        doc.content = paragraphs.map(line => {
            const tokens = parseWikiLinks(line);
            const contentNodes: any[] = [];
            
            tokens.forEach(token => {
                if (token.kind === 'text') {
                    if (token.value) contentNodes.push({ type: 'text', text: token.value });
                } else if (token.kind === 'link') {
                    const targetId = resolveOrCreateIndex(token.title, workspace, note.id);
                    contentNodes.push({
                        type: 'internalLink',
                        attrs: {
                            targetId: targetId,
                            display: token.display,
                            fallbackTitle: token.title
                        }
                    });
                }
            });

            if (contentNodes.length === 0) {
                return { type: 'paragraph' };
            }
            
            const textContent = line;
            if (textContent.startsWith('# ')) {
                return { type: 'heading', attrs: { level: 1 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('## ')) {
                return { type: 'heading', attrs: { level: 2 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('### ')) {
                return { type: 'heading', attrs: { level: 3 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('- ')) {
                return { type: 'paragraph', content: contentNodes };
            }

            return { type: 'paragraph', content: contentNodes };
        });
        changed = true;
    } 
    // Case 2: TipTap JSON v1 (Legacy Doc)
    else if (typeof content === 'object' && (!content.version || content.version < 2)) {
        doc = JSON.parse(JSON.stringify(content.doc || content));
        const traverse = (node: any) => {
            if (node.content) {
                node.content = node.content.flatMap((child: any) => {
                    if (child.type === 'text' && child.text && child.text.includes('[[')) {
                        const tokens = parseWikiLinks(child.text);
                        return tokens.map(token => {
                            if (token.kind === 'text') return { type: 'text', text: token.value, marks: child.marks };
                            const targetId = resolveOrCreateIndex(token.title, workspace, note.id);
                            return {
                                type: 'internalLink',
                                attrs: {
                                    targetId,
                                    display: token.display,
                                    fallbackTitle: token.title
                                },
                                marks: child.marks 
                            };
                        });
                    }
                    traverse(child);
                    return [child];
                });
            }
        };
        traverse(doc);
        changed = true; 
    } 
    // Case 3: V2 or newer
    else {
        doc = content.doc ?? content;
        changed = false;
    }

    return { doc, changed };
};

const resolveOrCreateIndex = (title: string, workspace: Workspace, sourceId: string): string => {
    const existingId = workspace.indexes.title_to_note_id[title];
    if (existingId) return existingId;
    return ensureUnresolvedNote(workspace, title, sourceId);
};

const fixHeadingContent = (node: any) => {
    if (node.type === 'text') {
        return { ...node, text: node.text.replace(/^#+\s/, '') };
    }
    return node;
};

// --- Milestone 6: Character Data Migration ---

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultCharacterData = (): CharacterData => ({
    templateId: 'character_default',
    blocks: [
        createCharacterBlock('identity'),
        createCharacterBlock('summary'),
        createCharacterBlock('appearance'),
        createCharacterBlock('personality'),
        createCharacterBlock('stats'),
        createCharacterBlock('abilities'),
        createCharacterBlock('items'),
        createCharacterBlock('relationships'),
        createCharacterBlock('history'),
        createCharacterBlock('locations'),
        createCharacterBlock('tags'),
        createCharacterBlock('authorNotes')
    ],
    forms: {
        schemaVersion: 1,
        activeFormId: 'base',
        order: ['base'],
        items: {
            'base': {
                formId: 'base',
                name: 'Base',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                overrides: {},
                localBlocks: []
            }
        }
    },
    snapshots: {
        schemaVersion: 1,
        activeSnapshotId: null,
        order: [],
        items: {}
    }
});

export const ensureCharacterData = (note: Note): { data: CharacterData, changed: boolean } => {
    let changed = false;
    let data = note.metadata?.characterData;

    // If missing completely, initialize
    if (!data) {
        data = createDefaultCharacterData();
        changed = true;
    } else {
        // 1. Migrate blocks
        if (!data.blocks) { data.blocks = []; changed = true; }
        
        data.blocks = data.blocks.map(b => {
            const normalized = normalizeCharacterBlock(b);
            if (JSON.stringify(normalized) !== JSON.stringify(b)) {
                changed = true;
                return normalized;
            }
            return b;
        });

        // 2. Ensure Forms Structure (Step 6 Migration)
        const structured = ensureFormsStructure(data);
        if (JSON.stringify(structured) !== JSON.stringify(data)) {
            data = structured;
            changed = true;
        }
    }

    return { data, changed };
};

export const validateCharacterNote = (note: Note): Note => {
    if (note.type !== 'modular' || note.recordKind !== 'character') return note;

    const { data, changed } = ensureCharacterData(note);
    
    if (changed) {
        return {
            ...note,
            metadata: {
                ...note.metadata,
                kind: 'character', 
                characterData: data
            }
        };
    }
    
    return note;
};

// --- Milestone 7: Modular Migration ---

const convertBlockToModule = (block: any): ModuleInstance => {
    let type: PrimitiveModuleType = 'custom';
    let presetId: string | null = block.type;
    let payload = block.payload || {};

    // Mapping Logic
    switch (block.type as CharacterBlockType) {
        case 'identity':
            type = 'fields';
            presetId = 'identity';
            // Payload is already { fields: [...] } which matches FieldsPayload
            break;
        case 'summary':
        case 'appearance':
        case 'personality':
        case 'history':
        case 'authorNotes':
            type = 'richText';
            presetId = block.type;
            // Payload is { doc: ... }
            break;
        case 'stats':
            type = 'fields'; // Stats mapped to fields for now
            presetId = 'stats';
            // StatsPayload is { stats: [{name, value}] }
            // FieldsPayload is { fields: [{key, value}] }
            if (payload.stats) {
                payload = { fields: payload.stats.map((s: any) => ({ id: generateId(), key: s.name, value: String(s.value) })) };
            }
            break;
        case 'abilities':
            type = 'table'; // Abilities as table
            presetId = 'abilities';
            // AbilitiesPayload: { abilities: [{name, type, descriptionDoc, tags}] }
            // TablePayload: { columns, rows }
            if (payload.abilities) {
                payload = { 
                    columns: ['Name', 'Type', 'Tags', 'Description'], 
                    rows: payload.abilities.map((a: any) => ({
                        id: generateId(),
                        Name: a.name,
                        Type: a.type,
                        Tags: a.tags?.join(', '),
                        Description: a.descriptionDoc
                    }))
                };
            }
            break;
        case 'items':
            type = 'table';
            presetId = 'items';
            // ItemsPayload: { items: [{name, qty, notes, isEquipped}] }
            if (payload.items) {
                payload = {
                    columns: ['Qty', 'Name', 'Notes'],
                    rows: payload.items.map((i: any) => ({
                        id: generateId(),
                        Qty: i.qty,
                        Name: i.name,
                        Notes: i.notes
                    }))
                };
            }
            break;
        case 'relationships':
            type = 'links'; // Mapped to links? Or Custom 'refs'?
            // Prompt says 'links': { links: Array<{ targetNoteId, label, relation }> }
            // RelationshipsPayload: { relationships: [{ targetCharacterId, type, notesDoc }] }
            type = 'links';
            presetId = 'relationships';
            if (payload.relationships) {
                payload = {
                    links: payload.relationships.map((r: any) => ({
                        targetNoteId: r.targetCharacterId,
                        relation: r.type,
                        label: '' // Resolved later? Or store nameFallback
                    }))
                };
            }
            break;
        case 'locations':
            type = 'custom'; // Too specific for simple links right now
            presetId = 'locations';
            break;
        case 'tags':
            type = 'tags';
            presetId = 'tags';
            break;
        default:
            type = 'custom';
            presetId = block.type;
    }

    return {
        moduleId: block.blockId || generateId(),
        type,
        title: block.title || presetId || 'Module',
        collapsed: block.collapsed || false,
        presetId,
        payload
    };
};

export const migrateNoteToModular = (note: any): Note => {
    const migrated = { ...note };
    
    // 1. Detect Legacy Type
    // If type was "Character", "Place", etc.
    const typeStr = note.meta?.type || note.type;
    
    if (['Character', 'Place', 'Item', 'Event', 'Lore'].includes(typeStr)) {
        migrated.type = 'modular';
        migrated.recordKind = typeStr.toLowerCase() as RecordKind;
    } else if (typeStr === 'General' || !typeStr) {
        migrated.type = 'general';
    } else if (typeStr === 'Canvas') {
        migrated.type = 'canvas';
    } else {
        // Assume general or keep as is if already modular
        if (migrated.type !== 'modular') migrated.type = 'general';
    }

    // 2. Migrate Modules (Character)
    if (migrated.recordKind === 'character' && !migrated.modules) {
        const charData = note.metadata?.characterData || note.characterData;
        if (charData && charData.blocks) {
            migrated.modules = charData.blocks.map(convertBlockToModule);
            // Default layout
            migrated.layout = migrated.modules.map((m: any, i: number) => ({ moduleId: m.moduleId, x: 0, y: i, w: 12, h: 1 }));
            migrated.templateId = charData.templateId;
        }
    }

    // 3. Initialize Place Data
    if (migrated.recordKind === 'place' && !migrated.placeData) {
        migrated.placeData = { parentPlaceId: null };
        migrated.eras = { order: [], byId: {} };
    }

    // 4. Ensure Template ID
    if (migrated.type === 'modular' && !migrated.templateId) {
        migrated.templateId = 'blank'; 
    }

    return migrated as Note;
};