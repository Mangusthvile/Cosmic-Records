
import { 
    Workspace, Note, DiskNote, IndexEntry, IndexData, UIState, UnresolvedOrigin,
    SettingsData, TemplatesData, HotkeysData, MapsData, CollectionsData, NoteTypeDefinition,
    GlossaryTerm, GlossaryData, PendingTerm
} from '../types';
import { getHandle, setHandle } from './idb';
import { VaultAdapter, FileSystemAccessAdapter, IndexedDbAdapter } from './adapters';
import { join, dirname, basename } from './path';
import { logNotification } from './storageService';
import { extractOutboundLinks } from './linkService';

// --- Constants ---
const VAULT_HANDLE_KEY = 'cosmic_vault_handle';
const METADATA_DIR = '.cosmicrecords';
const BACKUP_DIR = '.cosmicrecords/backup';
const ATTACHMENTS_DIR = 'Attachments';

// Glossary Paths
const GLOSSARY_BASE_DIR = '.cosmicrecords/glossary';
const GLOSSARY_TERMS_DIR = '.cosmicrecords/glossary/terms';
const GLOSSARY_PENDING_DIR = '.cosmicrecords/glossary/pending';
const GLOSSARY_INDEX_FILE = '.cosmicrecords/glossary_index.json';

// Metadata Filenames
const FILES = {
    MANIFEST: 'manifest.json',
    INDEX: 'index.json',
    FOLDERS: 'folders.json',
    TAGS: 'tags.json',
    TEMPLATES: 'templates.json',
    // GLOSSARY: 'glossary.json', // Deprecated in favor of directory
    SETTINGS: 'settings.json',
    HOTKEYS: 'hotkeys.json',
    MAPS: 'maps.json',
    COLLECTIONS: 'collections.json',
    WORKSPACE: 'workspace.json',
    WIDGETS: 'widgets.json',
    PINNED: 'pinned.json',
    NOTIFICATIONS: 'notifications.json',
    UI_STATE: 'uiState.json'
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

// --- Defaults Generators ---

const createDefaultSettings = (): SettingsData => ({
    schemaVersion: 1,
    updatedAt: Date.now(),
    ui: { theme: 'darkCosmos', reduceMotion: false },
    universeTags: { tags: ['Cosmos'], defaultTag: null },
    notes: { defaultFolderId: 'inbox', defaultStatus: 'Draft', renameUpdatesWikiLinks: true },
    validation: { strictMode: false, rules: [] }
});

const createDefaultTemplates = (): TemplatesData => {
    // Updated note types including Canvas
    const types: NoteTypeDefinition[] = [
        { typeId: 'General', name: 'General Note', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'FileText', description: 'A blank canvas for any content.' },
        { typeId: 'Character', name: 'Character', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'User', description: 'A person, creature, or entity.' },
        { typeId: 'Place', name: 'Place', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Map', description: 'A location, planet, or region.' },
        { typeId: 'Item', name: 'Item', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Box', description: 'An object, artifact, or technology.' },
        { typeId: 'Event', name: 'Event', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Calendar', description: 'A historical or timeline event.' },
        { typeId: 'Lore', name: 'Lore', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Scroll', description: 'History, religion, or culture.' },
        { typeId: 'Canvas', name: 'Canvas', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Layout', description: 'A spatial board for visual organization.' },
    ];
    return {
        schemaVersion: 1,
        updatedAt: Date.now(),
        noteTypes: types,
        lastUsed: { typeId: 'General' }
    };
};

const createDefaultHotkeys = (): HotkeysData => ({
    schemaVersion: 1,
    updatedAt: Date.now(),
    bindings: [
        { command: "note.save", keys: "Mod+S", enabled: true, label: "Save Note" },
        { command: "note.new", keys: "Mod+N", enabled: true, label: "New Note" },
        { command: "tab.close", keys: "Mod+W", enabled: true, label: "Close Tab" },
        { command: "tab.next", keys: "Ctrl+Tab", enabled: true, label: "Next Tab" },
        { command: "pane.splitVertical", keys: "Alt+Shift+2", enabled: true, label: "Split Vertical" },
        { command: "pane.focusLeft", keys: "Alt+ArrowLeft", enabled: true, label: "Focus Left" },
        { command: "pane.focusRight", keys: "Alt+ArrowRight", enabled: true, label: "Focus Right" },
        { command: "editor.find", keys: "Mod+F", enabled: true, label: "Find in Note" },
        { command: "editor.findNext", keys: "F3", enabled: true, label: "Find Next" },
        { command: "editor.findPrev", keys: "Shift+F3", enabled: true, label: "Find Previous" },
    ]
});

const createDefaultMaps = (): MapsData => ({
    schemaVersion: 1,
    updatedAt: Date.now(),
    maps: {
        'main': {
            mapId: 'main',
            name: 'Main Star Map',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            viewState: { zoom: 1, panX: 0, panY: 0 },
            nodes: [],
            areas: []
        }
    }
});

const createDefaultCollections = (): CollectionsData => ({
    schemaVersion: 1,
    updatedAt: Date.now(),
    collections: {}
});

const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const debounce = (func: Function, wait: number) => {
    let timeout: any;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
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
    if (node.type === 'internalLink' && node.attrs) {
        out.push(node.attrs.display || node.attrs.fallbackTitle || "Link");
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };

  walk(doc);
  return out.join(" "); 
};

const generateExcerpt = (content: any, length = 150): string => {
    const text = noteContentToPlainText({ content });
    return text.trim().substring(0, length);
};

const slugify = (text: string): string => {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
        .substring(0, 60);
};

const generateFileName = (title: string, id: string): string => {
    const slug = slugify(title) || 'untitled';
    const shortId = id.substring(0, 8);
    return `${slug}--${shortId}.json`;
};

// --- Serialization Logic ---

const serializeNoteToJSON = (note: Note, folderPath: string): string => {
    const diskNote: DiskNote = {
        schemaVersion: 2, 
        noteId: note.id,
        meta: {
            title: note.title,
            type: note.type,
            status: note.status,
            unresolved: note.unresolved,
            universeTag: note.universeTag,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            folderPath: folderPath,
            pinned: note.pinned,
            tags: [] 
        },
        properties: {
            custom: note.metadata?.data || {},
            system: note.system || {} 
        },
        content: {
            format: 'tiptap',
            version: 2,
            doc: note.content?.doc || note.content || { type: 'doc', content: [] }
        },
        modules: [], 
        links: {
            outgoing: [],
            incoming: []
        }
    };
    return JSON.stringify(diskNote, null, 2);
};

const parseNoteFromJSON = (jsonString: string): Note | null => {
    try {
        const diskNote = JSON.parse(jsonString) as DiskNote;
        let content: any = { type: 'doc', content: [] };
        
        if ((diskNote.content as any).format === 'blocks') {
            content = { 
                type: 'doc', 
                content: (diskNote.content as any).blocks.map((b: any) => ({
                    type: 'paragraph', content: [{ type: 'text', text: b.text }]
                }))
            };
        } else if (diskNote.content.format === 'tiptap') {
            content = diskNote.content.doc;
        }

        return {
            id: diskNote.noteId,
            title: diskNote.meta.title,
            type: diskNote.meta.type || "General",
            status: diskNote.meta.status || "Draft",
            unresolved: diskNote.meta.unresolved || false,
            universeTag: diskNote.meta.universeTag || null,
            folderId: 'unknown', 
            createdAt: diskNote.meta.createdAt,
            updatedAt: diskNote.meta.updatedAt,
            content: content,
            pinned: diskNote.meta.pinned || false,
            excerpt: generateExcerpt({ content: { doc: content } }),
            unresolvedSources: [],
            tag_ids: [],
            metadata: { kind: 'general', data: diskNote.properties.custom },
            system: diskNote.properties.system || {},
            aiInterview: undefined,
            content_plain: generateExcerpt({ content: { doc: content } }, 99999),
            outbound_note_ids: [] 
        };
    } catch (e) {
        console.error("Failed to parse note JSON", e);
        return null;
    }
};

// --- Glossary Serialization ---

const serializeGlossaryTerm = (term: GlossaryTerm): string => {
    const disk = {
        termId: term.id,
        primaryName: term.term,
        aliases: term.aliases,
        definitionRichText: term.definitionDoc,
        universeScopes: term.universeTags,
        createdAt: term.createdAt,
        updatedAt: term.updatedAt,
        canonical: true 
    };
    return JSON.stringify(disk, null, 2);
};

const parseGlossaryTerm = (json: string): GlossaryTerm => {
    const disk = JSON.parse(json);
    return {
        id: disk.termId,
        term: disk.primaryName,
        aliases: disk.aliases || [],
        definitionDoc: disk.definitionRichText || { type: 'doc', content: [] },
        definition_plain: noteContentToPlainText({ content: disk.definitionRichText }),
        universeTags: disk.universeScopes || [],
        isCanon: true,
        linksTo: [],
        sourceRefs: [],
        createdAt: disk.createdAt || Date.now(),
        updatedAt: disk.updatedAt || Date.now()
    };
};

// --- Main Service ---

export class VaultService {
    private adapter: VaultAdapter | null = null;
    private workspaceCache: Workspace | null = null;
    private writeMutex: Map<string, Promise<void>> = new Map();

    // --- Attachments ---
    
    async saveAttachment(noteId: string, file: File): Promise<string> {
        if (!this.adapter) throw new Error("Vault not ready");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dir = join(ATTACHMENTS_DIR, noteId);
        const path = join(dir, safeName);
        await this.adapter.mkdir(dir, { recursive: true });
        const buffer = await file.arrayBuffer();
        await this.adapter.writeFile(path, new Uint8Array(buffer));
        return path;
    }

    async getAttachmentUrl(path: string): Promise<string | null> {
        if (!this.adapter) return null;
        try {
            const data = await this.adapter.readFile(path, 'binary');
            const blob = new Blob([data as Uint8Array]);
            return URL.createObjectURL(blob);
        } catch (e) { return null; }
    }

    // --- Durability Helpers ---

    private async acquireLock(path: string): Promise<() => void> {
        while (this.writeMutex.has(path)) { await this.writeMutex.get(path); }
        let resolveLock: () => void = () => {};
        const lockPromise = new Promise<void>(resolve => { resolveLock = resolve; });
        this.writeMutex.set(path, lockPromise);
        return () => { this.writeMutex.delete(path); resolveLock(); };
    }

    private async safeReadJson<T>(filePath: string, fallback: T): Promise<T> {
        if (!this.adapter) return fallback;
        const release = await this.acquireLock(filePath);
        try {
            if (!(await this.adapter.exists(filePath))) return fallback;
            const content = await this.adapter.readFile(filePath);
            if (typeof content !== 'string' || content.trim() === '') return fallback;
            return JSON.parse(content) as T;
        } catch (e) { return fallback; } finally { release(); }
    }

    private async safeWriteJson(filePath: string, data: any) {
        if (!this.adapter) return;
        const release = await this.acquireLock(filePath);
        try {
            const content = JSON.stringify(data, null, 2);
            const tempPath = filePath + '.tmp';
            await this.adapter.writeFile(tempPath, content);
            if (await this.adapter.exists(filePath)) await this.adapter.delete(filePath);
            await this.adapter.move(tempPath, filePath);
        } finally { release(); }
    }

    // Debounced Config Savers
    public debouncedSaveSettings = debounce(async (data: SettingsData) => {
        data.updatedAt = Date.now();
        await this.safeWriteJson(join(METADATA_DIR, FILES.SETTINGS), data);
    }, 500);

    public debouncedSaveTemplates = debounce(async (data: TemplatesData) => {
        data.updatedAt = Date.now();
        await this.safeWriteJson(join(METADATA_DIR, FILES.TEMPLATES), data);
    }, 500);

    public debouncedSaveHotkeys = debounce(async (data: HotkeysData) => {
        data.updatedAt = Date.now();
        await this.safeWriteJson(join(METADATA_DIR, FILES.HOTKEYS), data);
    }, 500);

    public debouncedSaveMaps = debounce(async (data: MapsData) => {
        data.updatedAt = Date.now();
        await this.safeWriteJson(join(METADATA_DIR, FILES.MAPS), data);
    }, 500);

    public debouncedSaveCollections = debounce(async (data: CollectionsData) => {
        data.updatedAt = Date.now();
        await this.safeWriteJson(join(METADATA_DIR, FILES.COLLECTIONS), data);
    }, 500);

    // Debounced Note Save
    public debouncedSaveNote = debounce(async (note: Note) => {
        if (!this.adapter || !this.workspaceCache) return;
        
        const folder = this.workspaceCache.folders[note.folderId];
        const folderName = folder ? folder.name : SYSTEM_DIRS.INBOX;
        await this.adapter.mkdir(folderName, { recursive: true });

        let fileName = generateFileName(note.title, note.id);
        const existingFileIndex = this.workspaceCache.indexes.note_files?.[note.id];
        
        if (existingFileIndex) {
            fileName = existingFileIndex.fileName;
            if (existingFileIndex.folderPath !== folderName) {
                const oldPath = join(existingFileIndex.folderPath, fileName);
                const newPath = join(folderName, fileName);
                if (await this.adapter.exists(oldPath)) {
                    await this.adapter.move(oldPath, newPath);
                }
            }
        }
        
        const path = join(folderName, fileName);
        await this.safeWriteJson(path, JSON.parse(serializeNoteToJSON(note, folderName))); 
        
        if (!this.workspaceCache.indexes.note_files) this.workspaceCache.indexes.note_files = {};
        this.workspaceCache.indexes.note_files[note.id] = { fileName, folderPath: folderName };

        if (!note.excerpt) note.excerpt = generateExcerpt(note.content);
        this.workspaceCache.notes[note.id] = note;

        this.debouncedSaveIndex(this.workspaceCache);
    }, 800); 

    // Index Save
    private debouncedSaveIndex = debounce(async (ws: Workspace) => {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);

        const indexData: IndexData = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            notes: {}
        };

        Object.values(ws.notes).forEach(note => {
            const fileInfo = ws.indexes.note_files?.[note.id];
            const folder = ws.folders[note.folderId];
            const folderPath = folder ? folder.name : (fileInfo?.folderPath || SYSTEM_DIRS.INBOX);
            const fileName = fileInfo?.fileName || generateFileName(note.title, note.id);

            const entry: IndexEntry = {
                noteId: note.id,
                filePath: join(folderPath, fileName),
                folderPath,
                fileName,
                title: note.title,
                type: note.type,
                status: note.status,
                unresolved: note.unresolved,
                universeTag: note.universeTag,
                tags: [],
                pinned: note.pinned,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                excerpt: note.excerpt || "",
                folderId: note.folderId,
                outboundLinks: note.outbound_note_ids 
            };
            indexData.notes[note.id] = entry;
        });

        await this.safeWriteJson(join(METADATA_DIR, FILES.INDEX), indexData);
    }, 2000); 

    // Glossary Index Save
    private debouncedSaveGlossaryIndex = debounce(async (ws: Workspace) => {
        if (!this.adapter) return;
        const index: Record<string, string> = {};
        
        Object.values(ws.glossary.terms).forEach(term => {
            const id = term.id;
            const norm = term.term.trim().toLowerCase();
            index[norm] = id;
            term.aliases.forEach(alias => {
                index[alias.trim().toLowerCase()] = id;
            });
        });
        
        await this.safeWriteJson(GLOSSARY_INDEX_FILE, index);
    }, 1000);

    private async saveMetadataInternal(ws: Workspace) {
        if (!this.adapter) return;
        await Promise.all([
            this.safeWriteJson(join(METADATA_DIR, FILES.FOLDERS), ws.folders),
            // this.safeWriteJson(join(METADATA_DIR, FILES.GLOSSARY), ws.glossary), // REMOVED: Now file-based
            this.safeWriteJson(join(METADATA_DIR, FILES.NOTIFICATIONS), ws.notificationLog),
        ]);
    }

    private debouncedSaveMetadata = debounce((ws: Workspace) => this.saveMetadataInternal(ws), 3000);

    public async saveMetadataNow(ws: Workspace) {
        await this.saveMetadataInternal(ws);
    }

    public debouncedSaveUIState = debounce(async (uiState: UIState) => {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);
        await this.safeWriteJson(join(METADATA_DIR, FILES.UI_STATE), uiState);
    }, 500);

    // --- Glossary Persistence ---

    async loadGlossary(): Promise<{ terms: Record<string, GlossaryTerm>, pending: PendingTerm[] }> {
        const result = { terms: {} as Record<string, GlossaryTerm>, pending: [] as PendingTerm[] };
        if (!this.adapter) return result;

        // Ensure Dirs
        await this.adapter.mkdir(GLOSSARY_TERMS_DIR, { recursive: true });
        await this.adapter.mkdir(GLOSSARY_PENDING_DIR, { recursive: true });

        // Load Terms
        const termFiles = await this.adapter.listDir(GLOSSARY_TERMS_DIR);
        for (const file of termFiles) {
            if (file.kind === 'file' && file.name.endsWith('.json')) {
                try {
                    const content = await this.adapter.readFile(file.path);
                    const term = parseGlossaryTerm(content as string);
                    result.terms[term.id] = term;
                } catch(e) { console.warn(`Failed to load term ${file.name}`, e); }
            }
        }

        // Load Pending
        const pendingFiles = await this.adapter.listDir(GLOSSARY_PENDING_DIR);
        for (const file of pendingFiles) {
            if (file.kind === 'file' && file.name.endsWith('.json')) {
                try {
                    const content = await this.adapter.readFile(file.path);
                    const pending = JSON.parse(content as string) as PendingTerm;
                    result.pending.push(pending);
                } catch(e) { /* ignore */ }
            }
        }

        return result;
    }

    async saveGlossaryTerm(term: GlossaryTerm) {
        if (!this.adapter) return;
        await this.adapter.mkdir(GLOSSARY_TERMS_DIR, { recursive: true });
        const path = join(GLOSSARY_TERMS_DIR, `${term.id}.json`);
        await this.safeWriteJson(path, JSON.parse(serializeGlossaryTerm(term)));
        
        if (this.workspaceCache) {
             this.debouncedSaveGlossaryIndex(this.workspaceCache);
        }
    }

    async deleteGlossaryTerm(termId: string) {
        if (!this.adapter) return;
        const path = join(GLOSSARY_TERMS_DIR, `${termId}.json`);
        await this.adapter.delete(path);
        
        if (this.workspaceCache) {
             this.debouncedSaveGlossaryIndex(this.workspaceCache);
        }
    }

    async savePendingTerm(pending: PendingTerm) {
        if (!this.adapter) return;
        await this.adapter.mkdir(GLOSSARY_PENDING_DIR, { recursive: true });
        const path = join(GLOSSARY_PENDING_DIR, `${pending.id}.json`);
        await this.safeWriteJson(path, pending);
    }

    async deletePendingTerm(pendingId: string) {
        if (!this.adapter) return;
        const path = join(GLOSSARY_PENDING_DIR, `${pendingId}.json`);
        await this.adapter.delete(path);
    }

    // --- Operations ---
    
    async createDirectory(path: string): Promise<boolean> {
        if (!this.adapter) return false;
        try {
            await this.adapter.mkdir(path, { recursive: true });
            return true;
        } catch (e) { return false; }
    }

    async renameFolderOnDisk(folderId: string, newName: string): Promise<boolean> {
        if (!this.workspaceCache || !this.adapter) return false;
        const folder = this.workspaceCache.folders[folderId];
        if (!folder || folder.type === 'system') return false;

        const oldName = folder.name;
        try {
            if (await this.adapter.exists(oldName)) {
                await this.adapter.renameDir(oldName, newName);
            } else {
                await this.adapter.mkdir(newName);
            }
            
            folder.name = newName;
            folder.updatedAt = Date.now();
            
            const notesInFolder = Object.values(this.workspaceCache.notes).filter(n => n.folderId === folderId);
            notesInFolder.forEach(n => {
                const fileInfo = this.workspaceCache!.indexes.note_files?.[n.id];
                if (fileInfo) fileInfo.folderPath = newName;
            });

            this.debouncedSaveMetadata(this.workspaceCache);
            this.debouncedSaveIndex(this.workspaceCache);
            return true;
        } catch (e) { return false; }
    }

    // --- Init & Load ---

    async initialize(): Promise<'active' | 'no-vault'> {
        try {
            const handle = await getHandle(VAULT_HANDLE_KEY);
            if (handle) {
                this.adapter = new FileSystemAccessAdapter(handle);
                await this.adapter.init();
                return 'active'; 
            }
        } catch (e) { console.error("Vault init error", e); }
        return 'no-vault';
    }

    async openPicker(): Promise<void> {
        try {
            const win = window as any;
            if (!win.showDirectoryPicker) throw new Error("FS API not supported");
            const handle = await win.showDirectoryPicker();
            if (handle) {
                await setHandle(VAULT_HANDLE_KEY, handle);
                this.adapter = new FileSystemAccessAdapter(handle);
                await this.adapter.init();
                await this.ensureScaffold();
            }
        } catch (e) { throw e; }
    }

    async useDemo(): Promise<void> {
        this.adapter = new IndexedDbAdapter();
        await this.adapter.init();
        await this.ensureScaffold();
    }

    private async ensureScaffold() {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);
        await this.adapter.mkdir(BACKUP_DIR);
        await this.adapter.mkdir(SYSTEM_DIRS.INBOX);
        await this.adapter.mkdir(SYSTEM_DIRS.UNRESOLVED);
        await this.adapter.mkdir(SYSTEM_DIRS.ARCHIVED);
        await this.adapter.mkdir(ATTACHMENTS_DIR);
        await this.adapter.mkdir(GLOSSARY_TERMS_DIR, { recursive: true });
        await this.adapter.mkdir(GLOSSARY_PENDING_DIR, { recursive: true });

        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.MANIFEST)))) {
             await this.safeWriteJson(join(METADATA_DIR, FILES.MANIFEST), {
                schemaVersion: 1,
                vaultId: generateId(),
                createdAt: Date.now(),
                app: { name: "Cosmic Records", formatVersion: 1 }
            });
        }
        
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.SETTINGS)))) await this.safeWriteJson(join(METADATA_DIR, FILES.SETTINGS), createDefaultSettings());
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.TEMPLATES)))) await this.safeWriteJson(join(METADATA_DIR, FILES.TEMPLATES), createDefaultTemplates());
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.HOTKEYS)))) await this.safeWriteJson(join(METADATA_DIR, FILES.HOTKEYS), createDefaultHotkeys());
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.MAPS)))) await this.safeWriteJson(join(METADATA_DIR, FILES.MAPS), createDefaultMaps());
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.COLLECTIONS)))) await this.safeWriteJson(join(METADATA_DIR, FILES.COLLECTIONS), createDefaultCollections());
    }

    async loadWorkspace(): Promise<Workspace> {
        if (!this.adapter) throw new Error("No vault open");

        const [
            manifest, indexData, foldersData, tagsData, 
            settingsData, templatesData, hotkeysData, mapsData, collectionsData,
            notificationsData
        ] = await Promise.all([
            this.safeReadJson<any>(join(METADATA_DIR, FILES.MANIFEST), {}),
            this.safeReadJson<IndexData>(join(METADATA_DIR, FILES.INDEX), { schemaVersion: 1, updatedAt: 0, notes: {} }),
            this.safeReadJson<any>(join(METADATA_DIR, FILES.FOLDERS), {}),
            this.safeReadJson<any>(join(METADATA_DIR, FILES.TAGS), { tags: {} }),
            this.safeReadJson<SettingsData>(join(METADATA_DIR, FILES.SETTINGS), createDefaultSettings()),
            this.safeReadJson<TemplatesData>(join(METADATA_DIR, FILES.TEMPLATES), createDefaultTemplates()),
            this.safeReadJson<HotkeysData>(join(METADATA_DIR, FILES.HOTKEYS), createDefaultHotkeys()),
            this.safeReadJson<MapsData>(join(METADATA_DIR, FILES.MAPS), createDefaultMaps()),
            this.safeReadJson<CollectionsData>(join(METADATA_DIR, FILES.COLLECTIONS), createDefaultCollections()),
            this.safeReadJson<any>(join(METADATA_DIR, FILES.NOTIFICATIONS), []),
        ]);

        const defaultFolders = {
            [SYSTEM_IDS.INBOX]: { id: SYSTEM_IDS.INBOX, name: SYSTEM_DIRS.INBOX, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 0 },
            [SYSTEM_IDS.UNRESOLVED]: { id: SYSTEM_IDS.UNRESOLVED, name: SYSTEM_DIRS.UNRESOLVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 1 },
            [SYSTEM_IDS.ARCHIVED]: { id: SYSTEM_IDS.ARCHIVED, name: SYSTEM_DIRS.ARCHIVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 999 }
        };

        // Load Glossary
        const glossaryData = await this.loadGlossary();

        const ws: Workspace = {
            schema_version: "1.0",
            workspace_id: manifest?.vaultId || generateId(),
            name: "Cosmic Vault",
            notes: {},
            folders: { ...defaultFolders, ...(foldersData || {}) },
            collections: collectionsData?.collections || {},
            pinnedNoteIds: [], 
            
            settings: settingsData,
            templates: templatesData,
            hotkeys: hotkeysData,
            maps: mapsData,

            tags: tagsData?.tags || {},
            glossary: {
                terms: glossaryData.terms,
                pending: glossaryData.pending,
                ignoreList: [] // Persist ignore list in separate file if needed, skipping for MVP
            },
            
            indexes: {
                title_to_note_id: {},
                unresolved_note_ids: [],
                outdated_note_ids: [],
                backlinks: {},
                note_files: {}
            },
            notifications: {},
            notificationLog: notificationsData || [],
            user_preferences: { ai: { proactive: true, allow_auto_edits: false, remember_preferences: true }, tts: { mode: "selected_text_only" }, ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true } }, 

            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Build Note Index
        if (indexData && indexData.notes) {
            const entries = indexData.notes;
            Object.values(entries).forEach((entry: IndexEntry) => {
                let folderId = entry.folderId;
                if (!folderId) {
                    const f = Object.values(ws.folders).find(f => f.name === entry.folderPath || f.name === dirname(entry.filePath));
                    folderId = f ? f.id : SYSTEM_IDS.INBOX;
                }

                const note: Note = {
                    id: entry.noteId,
                    title: entry.title,
                    type: entry.type,
                    status: entry.status,
                    unresolved: entry.unresolved,
                    universeTag: entry.universeTag,
                    folderId: folderId,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    content: { type: 'doc', content: [] }, 
                    pinned: entry.pinned,
                    excerpt: entry.excerpt,
                    unresolvedSources: [],
                    tag_ids: [],
                    content_plain: entry.excerpt, 
                    outbound_note_ids: entry.outboundLinks || []
                };
                
                ws.notes[note.id] = note;
                ws.indexes.title_to_note_id[note.title] = note.id;
                ws.indexes.note_files![note.id] = { fileName: entry.fileName, folderPath: entry.folderPath };
                
                if (entry.outboundLinks) {
                    entry.outboundLinks.forEach(targetId => {
                        if (!ws.indexes.backlinks[targetId]) ws.indexes.backlinks[targetId] = [];
                        if (!ws.indexes.backlinks[targetId].includes(note.id)) {
                            ws.indexes.backlinks[targetId].push(note.id);
                        }
                    });
                }
                
                if (note.pinned) ws.pinnedNoteIds.push(note.id);
                if (note.unresolved) ws.indexes.unresolved_note_ids.push(note.id);
                if (note.status === 'Outdated') ws.indexes.outdated_note_ids.push(note.id);
            });
        }
        
        // Rebuild Glossary Index
        this.debouncedSaveGlossaryIndex(ws);

        return ws;
    }

    async loadUIState(): Promise<UIState | null> {
        return this.safeReadJson<UIState>(join(METADATA_DIR, FILES.UI_STATE), null as any);
    }

    async ensureNoteContent(noteId: string): Promise<any> {
        if (!this.workspaceCache) return null;
        const note = this.workspaceCache.notes[noteId];
        if (!note) return null;
        if (note.content && note.content.content && note.content.content.length > 0) return note.content;

        const fileInfo = this.workspaceCache.indexes.note_files?.[noteId];
        if (!fileInfo) return note.content;

        const path = join(fileInfo.folderPath, fileInfo.fileName);
        try {
            const raw = await this.adapter?.readFile(path);
            if (typeof raw === 'string') {
                const parsed = parseNoteFromJSON(raw);
                if (parsed) {
                    note.content = parsed.content;
                    this.workspaceCache.notes[noteId] = note;
                }
            }
        } catch(e) { /* ignore */ }
        return note.content;
    }

    async rebuildIndex(): Promise<void> {
        if (!this.adapter || !this.workspaceCache) return;
        
        const indexData: IndexData = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            notes: {}
        };
        
        const notes: Record<string, Note> = {};
        const noteFiles: Record<string, { fileName: string, folderPath: string }> = {};
        const titleMap: Record<string, string> = {};
        const backlinks: Record<string, string[]> = {};

        const scan = async (dir: string) => {
            const entries = await this.adapter!.listDir(dir);
            for(const e of entries) {
                if (e.kind === 'dir' && e.name !== METADATA_DIR && e.name !== ATTACHMENTS_DIR) {
                    await scan(e.path);
                } else if (e.kind === 'file' && e.name.endsWith('.json')) {
                    try {
                        const content = await this.adapter!.readFile(e.path);
                        const note = parseNoteFromJSON(content as string);
                        if (note) {
                            notes[note.id] = note;
                            noteFiles[note.id] = { fileName: e.name, folderPath: dir };
                            titleMap[note.title] = note.id;

                            const folder = Object.values(this.workspaceCache!.folders).find(f => f.name === dir);
                            note.folderId = folder ? folder.id : 'inbox';

                            const outbound = extractOutboundLinks(note.content);
                            note.outbound_note_ids = outbound;
                            outbound.forEach(tid => {
                                if (!backlinks[tid]) backlinks[tid] = [];
                                backlinks[tid].push(note.id);
                            });

                            indexData.notes[note.id] = {
                                noteId: note.id,
                                filePath: e.path,
                                folderPath: dir,
                                fileName: e.name,
                                title: note.title,
                                type: note.type,
                                status: note.status,
                                unresolved: note.unresolved,
                                universeTag: note.universeTag,
                                tags: [],
                                pinned: note.pinned,
                                createdAt: note.createdAt,
                                updatedAt: note.updatedAt,
                                excerpt: note.excerpt || "",
                                folderId: note.folderId,
                                outboundLinks: outbound
                            };
                        }
                    } catch (err) { /* ignore */ }
                }
            }
        };

        await scan('.');

        this.workspaceCache.notes = notes;
        this.workspaceCache.indexes.note_files = noteFiles;
        this.workspaceCache.indexes.title_to_note_id = titleMap;
        this.workspaceCache.indexes.backlinks = backlinks;
        this.workspaceCache.indexes.unresolved_note_ids = Object.values(notes).filter(n => n.unresolved).map(n => n.id);

        await this.safeWriteJson(join(METADATA_DIR, FILES.INDEX), indexData);
        
        // Rebuild Glossary (Simple scan)
        const glossaryData = await this.loadGlossary();
        this.workspaceCache.glossary = { 
            terms: glossaryData.terms, 
            pending: glossaryData.pending,
            ignoreList: this.workspaceCache.glossary.ignoreList
        };
        this.debouncedSaveGlossaryIndex(this.workspaceCache);
    }

    async resyncVault(mode: 'fast' | 'full'): Promise<void> {
        await this.rebuildIndex();
    }

    onNoteChange(note: Note) {
        if (this.workspaceCache) {
            this.workspaceCache.notes[note.id] = note;
            if (note.pinned && !this.workspaceCache.pinnedNoteIds.includes(note.id)) {
                this.workspaceCache.pinnedNoteIds.push(note.id);
            } else if (!note.pinned && this.workspaceCache.pinnedNoteIds.includes(note.id)) {
                this.workspaceCache.pinnedNoteIds = this.workspaceCache.pinnedNoteIds.filter(id => id !== note.id);
            }
        }
        this.debouncedSaveNote(note);
    }

    onWorkspaceChange(ws: Workspace) {
        this.workspaceCache = ws;
        this.debouncedSaveMetadata(ws);
        this.debouncedSaveIndex(ws);
        this.debouncedSaveSettings(ws.settings);
        this.debouncedSaveTemplates(ws.templates);
        this.debouncedSaveHotkeys(ws.hotkeys);
        this.debouncedSaveMaps(ws.maps);
        this.debouncedSaveCollections({ schemaVersion: 1, updatedAt: Date.now(), collections: ws.collections });
        this.debouncedSaveGlossaryIndex(ws);
    }
}

export const vaultService = new VaultService();
