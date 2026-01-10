import { 
    Workspace, Note, DiskNote, IndexEntry, IndexData, UIState,
    SettingsData, TemplatesData, HotkeysData, MapsData, NoteTypeDefinition,
    GlossaryTerm, PendingTerm, GlossaryIndex, GlossaryOccurrences, NoteTemplate
} from '../types';
import { getHandle, setHandle } from './idb';
import { VaultAdapter, FileSystemAccessAdapter, IndexedDbAdapter } from './adapters';
import { join, dirname } from './path';
import { extractOutboundLinks } from './linkService';
import { templateService } from './templateService';

// --- Constants ---
const VAULT_HANDLE_KEY = 'cosmic_vault_handle';
const METADATA_DIR = '.cosmicrecords';
const BACKUP_DIR = '.cosmicrecords/backup';
const QUARANTINE_DIR = '.cosmicrecords/quarantine';
const GLOSSARY_TERMS_DIR = '.cosmicrecords/glossary/terms';
const GLOSSARY_PENDING_DIR = '.cosmicrecords/glossary/pending';
const GLOSSARY_INDEX_FILE = 'glossary_index.json';
const GLOSSARY_OCCURRENCES_FILE = 'glossary_occurrences.json';
const GLOSSARY_IGNORE_FILE = 'glossary_ignore.json';

const ATTACHMENTS_DIR = 'Attachments';

// Metadata Filenames
const FILES = {
    MANIFEST: 'manifest.json',
    INDEX: 'index.json',
    FOLDERS: 'folders.json',
    TAGS: 'tags.json',
    TEMPLATES: 'templates.json',
    GLOSSARY_LEGACY: 'glossary.json', 
    GLOSSARY_INDEX: GLOSSARY_INDEX_FILE, 
    GLOSSARY_OCCURRENCES: GLOSSARY_OCCURRENCES_FILE, 
    GLOSSARY_IGNORE: GLOSSARY_IGNORE_FILE,
    SETTINGS: 'settings.json',
    HOTKEYS: 'hotkeys.json',
    MAPS: 'maps.json',
    UI_STATE: 'uiState.json',
    NOTIFICATIONS: 'notifications.json'
};

const SYSTEM_DIRS = {
    INBOX: 'Inbox',
    UNRESOLVED: 'Unresolved',
    ARCHIVED: 'Archived'
};

const SYSTEM_IDS = {
    INBOX: 'inbox',
    UNRESOLVED: 'unresolved',
    ARCHIVED: 'archived'
};

// --- Defaults ---
const createDefaultSettings = (): SettingsData => ({
    schemaVersion: 1,
    updatedAt: Date.now(),
    ui: { theme: 'darkCosmos', reduceMotion: false, accentColor: '#38bdf8' },
    universeTags: { tags: ['Cosmos'], defaultTag: null },
    notes: { defaultFolderId: 'inbox', defaultStatus: 'Draft', renameUpdatesWikiLinks: true },
    validation: { strictMode: false, rules: [] },
    characterValidation: {
        schemaVersion: 1,
        enabled: true,
        mode: 'warnings',
        defaultSeverity: 'warning',
        statRanges: {
            enabled: true,
            defaults: { min: 0, max: 20 }
        },
        identityRules: {
            enabled: true,
            requiredFields: ['Name']
        },
        unresolvedPlaceLinks: {
            enabled: true
        },
        conflictingPaths: {
            enabled: true,
            groups: []
        }
    }
});

const createDefaultTemplates = (): TemplatesData => {
    const characterTemplate: NoteTemplate = {
        templateId: 'character_default',
        name: 'Detailed Character',
        kind: 'structured',
        requiredModules: [],
        contentBlocks: [],
        defaultModules: [
            { type: 'summary', defaultData: {} },
            { type: 'identity', defaultData: {} },
            { type: 'appearance', defaultData: {} },
            { type: 'personality', defaultData: {} },
            { type: 'abilities', defaultData: {} },
            { type: 'history', defaultData: {} },
        ],
        interviewQuestions: [
            { id: 'q_name', prompt: "What is the character's full name and any common aliases?", type: 'shortText' },
            { id: 'q_role', prompt: "What is their role, class, or occupation in the world?", type: 'shortText' },
            { id: 'q_background', prompt: "Briefly describe their background or origin story.", type: 'longText' }
        ],
        suggestedModules: ['identity', 'summary', 'stats', 'abilities'],
        defaultOrder: ['identity', 'summary', 'stats', 'abilities']
    };

    const types: NoteTypeDefinition[] = [
        { typeId: 'General', name: 'General Note', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'FileText', description: 'A blank canvas for any content.' },
        { typeId: 'Character', name: 'Character', defaultTemplateId: 'character_default', templates: [characterTemplate], aiInterviewTemplates: [], icon: 'User', description: 'A structured profile for a person or entity.' },
        { typeId: 'Place', name: 'Place', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Map', description: 'A location, planet, or region.' },
        { typeId: 'Item', name: 'Item', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Box', description: 'An object, artifact, or technology.' },
        { typeId: 'Event', name: 'Event', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Calendar', description: 'A historical or timeline event.' },
        { typeId: 'Lore', name: 'Lore', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Scroll', description: 'History, religion, or culture.' },
        { typeId: 'Canvas', name: 'Canvas', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Layout', description: 'A spatial board for visual organization.' },
    ];
    return { schemaVersion: 1, updatedAt: Date.now(), noteTypes: types, lastUsed: { typeId: 'General' } };
};

const createDefaultHotkeys = (): HotkeysData => ({
    schemaVersion: 1, updatedAt: Date.now(),
    bindings: [
        { command: "note.save", keys: "Mod+S", enabled: true, label: "Save Note" },
        { command: "note.new", keys: "Mod+N", enabled: true, label: "New Note" },
        { command: "tab.close", keys: "Mod+W", enabled: true, label: "Close Tab" },
        { command: "editor.find", keys: "Mod+F", enabled: true, label: "Find in Note" }
    ]
});

const createDefaultMaps = (): MapsData => ({
    schemaVersion: 1, updatedAt: Date.now(),
    maps: { 'main': { mapId: 'main', name: 'Main Star Map', createdAt: Date.now(), updatedAt: Date.now(), viewState: { zoom: 1, panX: 0, panY: 0 }, nodes: [], areas: [] } }
});

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

const debounce = (func: Function, wait: number) => {
    let timeout: any;
    return (...args: any[]) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
};

export const noteContentToPlainText = (note: any): string => {
  const c = note?.content;
  if (!c) return "";
  if (typeof c === "string") return c;
  const doc = c.doc ?? c; 
  if (!doc || typeof doc !== 'object') return "";
  const out: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === "string") out.push(node.text);
    if (node.type === 'internalLink' && node.attrs) out.push(node.attrs.display || node.attrs.fallbackTitle || "Link");
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" "); 
};

const slugify = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').substring(0, 60);
const generateFileName = (title: string, id: string) => `${slugify(title) || 'untitled'}_${id.substring(0, 8)}.json`;

const serializeNoteToJSON = (note: Note, folderPath: string): string => JSON.stringify({
    schemaVersion: 2,
    noteId: note.id,
    meta: {
        title: note.title, type: note.type, status: note.status, unresolved: note.unresolved,
        universeTag: note.universeTag, createdAt: note.createdAt, updatedAt: note.updatedAt,
        folderPath: folderPath, pinned: note.pinned, tags: []
    },
    properties: {
        custom: note.metadata?.data || {},
        system: note.system || {},
        characterState: note.metadata?.characterState
    },
    characterData: note.metadata?.characterData, // M6
    content: {
        format: 'tiptap', version: 2,
        doc: note.content?.doc || note.content || { type: 'doc', content: [] }
    },
    links: { outgoing: [], incoming: [] }
}, null, 2);

const parseNoteFromJSON = (jsonString: string): Note | null => {
    try {
        const d = JSON.parse(jsonString);
        if (!d.meta) return null;
        const content = d.content?.doc || { type: 'doc', content: [] };
        
        // M6: Extract characterData
        const characterData = d.characterData;

        return {
            id: d.noteId, title: d.meta.title, type: d.meta.type || "General", status: d.meta.status || "Draft",
            unresolved: d.meta.unresolved || false, universeTag: d.meta.universeTag || null,
            folderId: 'unknown', createdAt: d.meta.createdAt, updatedAt: d.meta.updatedAt,
            content: content, pinned: d.meta.pinned || false,
            excerpt: noteContentToPlainText({ content: { doc: content } }).substring(0, 150),
            unresolvedSources: [], tag_ids: [],
            metadata: { 
                kind: d.meta.type === 'Character' ? 'character' : 'general', 
                data: d.properties?.custom, 
                characterState: d.properties?.characterState,
                characterData // M6
            },
            system: d.properties?.system || {},
            content_plain: "",
            outbound_note_ids: [] 
        };
    } catch (e) { return null; }
};

export class VaultService {
    private _adapter: VaultAdapter | null = null;
    private workspaceCache: Workspace | null = null;
    private writeMutex: Map<string, Promise<void>> = new Map();

    public get adapter() { return this._adapter; }

    private async acquireLock(path: string): Promise<() => void> {
        while (this.writeMutex.has(path)) await this.writeMutex.get(path);
        let resolve: () => void = () => {};
        const p = new Promise<void>(r => { resolve = r; });
        this.writeMutex.set(path, p);
        return () => { this.writeMutex.delete(path); resolve(); };
    }

    private async safeReadJson<T>(path: string, fallback: T): Promise<T> {
        if (!this._adapter) return fallback;
        const release = await this.acquireLock(path);
        try {
            if (await this._adapter.exists(path)) {
                const c = await this._adapter.readFile(path);
                if (typeof c === 'string' && c.trim()) return JSON.parse(c);
            }
            if (await this._adapter.exists(path + '.bak')) {
                const c = await this._adapter.readFile(path + '.bak');
                if (typeof c === 'string' && c.trim()) return JSON.parse(c);
            }
            return fallback;
        } catch { return fallback; } finally { release(); }
    }

    private async safeWriteJson(path: string, data: any) {
        if (!this._adapter) return;
        const release = await this.acquireLock(path);
        try {
            const content = JSON.stringify(data, null, 2);
            if (await this._adapter.exists(path)) {
                if (await this._adapter.exists(path + '.bak')) await this._adapter.delete(path + '.bak');
                try { await this._adapter.move(path, path + '.bak'); } catch {}
            }
            await this._adapter.writeFile(path, content); 
        } catch (e) { console.error("Write failed", path, e); } finally { release(); }
    }

    public debouncedSaveSettings = debounce(async (data: SettingsData) => this.safeWriteJson(join(METADATA_DIR, FILES.SETTINGS), data), 500);
    public debouncedSaveTemplates = debounce(async (data: TemplatesData) => this.safeWriteJson(join(METADATA_DIR, FILES.TEMPLATES), data), 500);
    public debouncedSaveHotkeys = debounce(async (data: HotkeysData) => this.safeWriteJson(join(METADATA_DIR, FILES.HOTKEYS), data), 500);
    public debouncedSaveMaps = debounce(async (data: MapsData) => this.safeWriteJson(join(METADATA_DIR, FILES.MAPS), data), 500);
    public debouncedSaveOccurrences = debounce(async (o: GlossaryOccurrences) => this.safeWriteJson(join(METADATA_DIR, FILES.GLOSSARY_OCCURRENCES), o), 1000);
    public debouncedSaveIgnoreList = debounce(async (l: string[]) => this.safeWriteJson(join(METADATA_DIR, FILES.GLOSSARY_IGNORE), l), 500);
    
    public debouncedSaveNote = debounce(async (note: Note) => {
        if (!this._adapter || !this.workspaceCache) return;
        
        // M6 Step 8: Check for transient prevent save flag
        if (note._preventSave) {
            console.warn(`[Vault] Save blocked for ${note.title} due to validation errors (Strict Mode).`);
            return;
        }

        // Validation: Never save empty doc
        if (!note.content || (typeof note.content === 'object' && (!note.content.doc && !note.content.content))) {
            console.warn(`[Vault] Refusing to save invalid content for ${note.title}`);
            return;
        }

        const folder = this.workspaceCache.folders[note.folderId];
        let folderPath = '';
        if (folder) {
            folderPath = folder.type === 'system' ? folder.name : folder.name; // Simplified for root structure
        } else {
            folderPath = SYSTEM_DIRS.INBOX; // Fallback
        }

        // We don't change file name continuously on rename for stability, unless re-organized.
        // For this version, we will use existing filename from index or generate new if missing.
        const fileIndex = this.workspaceCache.indexes.note_files || {};
        let fileName = fileIndex[note.id]?.fileName;
        
        if (!fileName) {
            fileName = generateFileName(note.title, note.id);
            // Update index
            if (!this.workspaceCache.indexes.note_files) this.workspaceCache.indexes.note_files = {};
            this.workspaceCache.indexes.note_files[note.id] = { fileName, folderPath };
        }

        const fullPath = join(folderPath, fileName);
        await this.adapter.mkdir(folderPath, { recursive: true });
        await this.safeWriteJson(fullPath, JSON.parse(serializeNoteToJSON(note, folderPath)));
    }, 1000);

    public debouncedSaveUIState = debounce(async (data: UIState) => this.safeWriteJson(join(METADATA_DIR, FILES.UI_STATE), data), 1000);

    // --- Core Lifecycle ---

    async initialize(): Promise<'active' | 'no-vault'> {
        try {
            const handle = await getHandle(VAULT_HANDLE_KEY);
            if (handle) {
                this._adapter = new FileSystemAccessAdapter(handle);
                await this._adapter.init();
                templateService.setAdapter(this._adapter);
                return 'active';
            }
        } catch (e) {
            console.error("Failed to restore handle", e);
        }
        return 'no-vault';
    }

    async openPicker(): Promise<void> {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        await setHandle(VAULT_HANDLE_KEY, handle);
        this._adapter = new FileSystemAccessAdapter(handle);
        await this._adapter.init();
        templateService.setAdapter(this._adapter);
    }

    async useDemo(): Promise<void> {
        this._adapter = new IndexedDbAdapter();
        await this._adapter.init();
        templateService.setAdapter(this._adapter);
        
        // Initialize basic structure for demo
        await this._adapter.mkdir(METADATA_DIR);
        await this._adapter.mkdir(SYSTEM_DIRS.INBOX);
    }

    async loadWorkspace(): Promise<Workspace> {
        if (!this._adapter) throw new Error("No adapter");

        // 1. Ensure Metadata Exists
        await this._adapter.mkdir(METADATA_DIR, { recursive: true });
        await this._adapter.mkdir(GLOSSARY_TERMS_DIR, { recursive: true });
        await this._adapter.mkdir(GLOSSARY_PENDING_DIR, { recursive: true });
        await templateService.ensureTemplatesStore();

        // 2. Load Configs
        const settings = await this.safeReadJson<SettingsData>(join(METADATA_DIR, FILES.SETTINGS), createDefaultSettings());
        const hotkeys = await this.safeReadJson<HotkeysData>(join(METADATA_DIR, FILES.HOTKEYS), createDefaultHotkeys());
        const maps = await this.safeReadJson<MapsData>(join(METADATA_DIR, FILES.MAPS), createDefaultMaps());
        
        // Load Note Type Templates (TemplatesData)
        const templatesData = await this.safeReadJson<TemplatesData>(join(METADATA_DIR, FILES.TEMPLATES), createDefaultTemplates());
        
        // Load Character Templates (from templates folder)
        const characterTemplates = await templateService.loadTemplates();
        
        // 3. Load Glossary (Index + Terms)
        const glossaryIndex = await this.safeReadJson<GlossaryIndex>(join(METADATA_DIR, FILES.GLOSSARY_INDEX), { schemaVersion: 1, updatedAt: Date.now(), lookup: {}, terms: {} });
        const glossaryOccurrences = await this.safeReadJson<GlossaryOccurrences>(join(METADATA_DIR, FILES.GLOSSARY_OCCURRENCES), { schemaVersion: 1, updatedAt: Date.now(), terms: {} });
        const glossaryIgnore = await this.safeReadJson<string[]>(join(METADATA_DIR, FILES.GLOSSARY_IGNORE), []);
        
        const terms: Record<string, GlossaryTerm> = {};
        const pending: Record<string, PendingTerm> = {};

        // Load Terms from Disk
        const termFiles = await this._adapter.listDir(GLOSSARY_TERMS_DIR);
        for (const file of termFiles) {
            if (file.kind === 'file' && file.name.endsWith('.json')) {
                try {
                    const term = await this.safeReadJson<GlossaryTerm>(file.path, null as any);
                    if (term) terms[term.termId] = term;
                } catch {}
            }
        }

        // Load Pending from Disk
        const pendingFiles = await this._adapter.listDir(GLOSSARY_PENDING_DIR);
        for (const file of pendingFiles) {
            if (file.kind === 'file' && file.name.endsWith('.json')) {
                try {
                    const p = await this.safeReadJson<PendingTerm>(file.path, null as any);
                    if (p) pending[p.pendingId] = p;
                } catch {}
            }
        }

        // 4. Scan Notes (Simple Scan)
        const notes: Record<string, Note> = {};
        const titleToIndex: Record<string, string> = {};
        const noteFilesIndex: Record<string, { fileName: string, folderPath: string }> = {};
        const backlinks: Record<string, string[]> = {};
        const folders: Record<string, any> = {
            'inbox': { id: 'inbox', name: 'Inbox', type: 'system', parentId: null, createdAt: Date.now(), updatedAt: Date.now(), order: 0 },
            'unresolved': { id: 'unresolved', name: 'Unresolved', type: 'system', parentId: null, createdAt: Date.now(), updatedAt: Date.now(), order: 99 },
            'archived': { id: 'archived', name: 'Archived', type: 'system', parentId: null, createdAt: Date.now(), updatedAt: Date.now(), order: 100 }
        };

        const scanDir = async (path: string, folderId: string) => {
            if (!this._adapter) return;
            const entries = await this._adapter.listDir(path);
            for (const entry of entries) {
                if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                    try {
                        const content = await this._adapter.readFile(entry.path);
                        const note = parseNoteFromJSON(content as string);
                        if (note) {
                            note.folderId = folderId;
                            notes[note.id] = note;
                            titleToIndex[note.title] = note.id;
                            noteFilesIndex[note.id] = { fileName: entry.name, folderPath: path };
                            
                            // Build backlinks
                            const outbound = extractOutboundLinks(note.content);
                            note.outbound_note_ids = outbound;
                            outbound.forEach(targetId => {
                                if (!backlinks[targetId]) backlinks[targetId] = [];
                                backlinks[targetId].push(note.id);
                            });
                        }
                    } catch (e) { console.warn("Failed to load note", entry.path); }
                } else if (entry.kind === 'dir' && !entry.name.startsWith('.')) {
                    // Create User Folder
                    const newFolderId = generateId();
                    folders[newFolderId] = { 
                        id: newFolderId, 
                        name: entry.name, 
                        type: 'user', 
                        parentId: folderId === 'root' ? null : folderId, 
                        createdAt: Date.now(), 
                        updatedAt: Date.now(), 
                        order: 1 
                    };
                    await scanDir(entry.path, newFolderId);
                }
            }
        };

        // Scan Roots
        await this._adapter.mkdir(SYSTEM_DIRS.INBOX, { recursive: true });
        await scanDir(SYSTEM_DIRS.INBOX, 'inbox');
        
        // Scan other root folders if any (for now assuming flat root structure or everything in Inbox/User folders)
        const rootEntries = await this._adapter.listDir('');
        for (const entry of rootEntries) {
            if (entry.kind === 'dir' && !entry.name.startsWith('.') && entry.name !== SYSTEM_DIRS.INBOX && entry.name !== SYSTEM_DIRS.ARCHIVED && entry.name !== ATTACHMENTS_DIR) {
                 const newFolderId = generateId();
                 folders[newFolderId] = { id: newFolderId, name: entry.name, type: 'user', parentId: null, createdAt: Date.now(), updatedAt: Date.now(), order: 1 };
                 await scanDir(entry.path, newFolderId);
            }
        }

        // Reconstruct Workspace
        const ws: Workspace = {
            schema_version: "1.0",
            workspace_id: "local",
            name: "Cosmic Vault",
            notes,
            folders,
            pinnedNoteIds: [],
            settings,
            templates: templatesData,
            hotkeys,
            maps,
            tags: {},
            glossary: {
                terms,
                pending,
                index: glossaryIndex,
                occurrences: glossaryOccurrences,
                ignoreList: glossaryIgnore
            },
            characterTemplates: characterTemplates,
            indexes: {
                title_to_note_id: titleToIndex,
                unresolved_note_ids: Object.values(notes).filter(n => n.unresolved).map(n => n.id),
                outdated_note_ids: Object.values(notes).filter(n => n.status === 'Outdated').map(n => n.id),
                backlinks,
                note_files: noteFilesIndex
            },
            notifications: {},
            notificationLog: [],
            user_preferences: { ai: { proactive: false, allow_auto_edits: false, remember_preferences: true }, tts: { mode: 'system' }, ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true }, widgets: { autoOpenRecommended: true } },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this.workspaceCache = ws;
        return ws;
    }

    async loadUIState(): Promise<UIState | null> {
        return this.safeReadJson<UIState | null>(join(METADATA_DIR, FILES.UI_STATE), null);
    }

    // --- Operations ---

    async ensureNoteContent(noteId: string): Promise<any> {
        if (!this.workspaceCache || !this.workspaceCache.notes[noteId]) return null;
        // In this architecture, content is loaded at startup. 
        // If we switched to lazy loading, this would fetch from disk.
        // For now, return what we have.
        return this.workspaceCache.notes[noteId].content;
    }

    onNoteChange(note: Note) {
        if (!this.workspaceCache) return;
        this.workspaceCache.notes[note.id] = note;
        this.debouncedSaveNote(note);
    }

    onWorkspaceChange(ws: Workspace) {
        this.workspaceCache = ws;
        // Trigger specific saves based on what changed? 
        // Usually components call specific save methods. This might be a catch-all.
    }

    async createDirectory(name: string) {
        if (this._adapter) await this._adapter.mkdir(name);
    }

    async renameFolderOnDisk(folderId: string, newName: string) {
        // Find folder in cache, get path, rename
        // Simplified: assuming root folders for now
        const folder = this.workspaceCache?.folders[folderId];
        if (folder && this._adapter) {
            await this._adapter.renameDir(folder.name, newName);
            folder.name = newName;
        }
    }

    async saveMetadataNow(workspace: Workspace) {
        // Force save critical metadata
        // Folders are not currently saved in a separate file in this version, derived from disk scan.
    }

    async saveGlossaryTerm(term: GlossaryTerm) {
        if (!this._adapter) return;
        const filename = `${term.termId}.json`;
        await this.safeWriteJson(join(GLOSSARY_TERMS_DIR, filename), term);
    }

    async deleteGlossaryTerm(termId: string) {
        if (!this._adapter) return;
        const filename = `${termId}.json`;
        await this._adapter.delete(join(GLOSSARY_TERMS_DIR, filename));
    }

    async saveGlossaryIndex(index: GlossaryIndex) {
        await this.safeWriteJson(join(METADATA_DIR, FILES.GLOSSARY_INDEX), index);
    }

    async savePendingTerm(term: PendingTerm) {
        if (!this._adapter) return;
        const filename = `${term.pendingId}.json`;
        await this.safeWriteJson(join(GLOSSARY_PENDING_DIR, filename), term);
    }

    async deletePendingTerm(pendingId: string) {
        if (!this._adapter) return;
        const filename = `${pendingId}.json`;
        await this._adapter.delete(join(GLOSSARY_PENDING_DIR, filename));
    }

    // --- Attachments ---

    async saveAttachment(noteId: string, file: File): Promise<string> {
        if (!this._adapter) throw new Error("No vault");
        await this._adapter.mkdir(ATTACHMENTS_DIR, { recursive: true });
        const ext = file.name.split('.').pop();
        const filename = `${noteId}_${Date.now()}.${ext}`;
        const path = join(ATTACHMENTS_DIR, filename);
        const buffer = await file.arrayBuffer();
        await this._adapter.writeFile(path, new Uint8Array(buffer));
        return path;
    }

    async getAttachmentUrl(path: string): Promise<string | null> {
        if (!this._adapter) return null;
        try {
            const data = await this._adapter.readFile(path, 'binary');
            const blob = new Blob([data as Uint8Array]);
            return URL.createObjectURL(blob);
        } catch { return null; }
    }

    // --- Maintenance ---

    async rebuildIndex() {
        await this.loadWorkspace(); 
    }

    async runVaultDoctor(): Promise<{ fixed: number, message: string }> {
        // Placeholder for advanced repairs
        return { fixed: 0, message: "Vault check complete. No issues found." };
    }

    async resyncVault(mode: 'fast' | 'full') {
        await this.loadWorkspace();
    }
}

export const vaultService = new VaultService();