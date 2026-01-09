
import { 
    Workspace, Note, Folder, NoteStatus, NotificationLogItem, ID, DiskNote, IndexEntry, NoteBlock, IndexData, UIState, UnresolvedOrigin,
    SettingsData, TemplatesData, HotkeysData, MapsData, NoteTypeDefinition, KeyBinding
} from '../types';
import { getHandle, setHandle } from './idb';
import { VaultAdapter, FileSystemAccessAdapter, IndexedDbAdapter, DirEntry } from './adapters';
import { join, dirname, basename } from './path';
import { logNotification } from './storageService';
import { extractLinkTitles } from './linkService';

// --- Constants ---
const VAULT_HANDLE_KEY = 'cosmic_vault_handle';
const METADATA_DIR = '.cosmicrecords';

// Metadata Filenames
const FILES = {
    MANIFEST: 'manifest.json',
    INDEX: 'index.json',
    FOLDERS: 'folders.json',
    TAGS: 'tags.json',
    TEMPLATES: 'templates.json',
    GLOSSARY: 'glossary.json',
    SETTINGS: 'settings.json',
    HOTKEYS: 'hotkeys.json',
    MAPS: 'maps.json',
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
    // Porting hardcoded list from NoteCreationModal
    const types: NoteTypeDefinition[] = [
        { typeId: 'General', name: 'General Note', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'FileText', description: 'A blank canvas for any content.' },
        { typeId: 'Character', name: 'Character', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'User', description: 'A person, creature, or entity.' },
        { typeId: 'Place', name: 'Place', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Map', description: 'A location, planet, or region.' },
        { typeId: 'Item', name: 'Item', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Box', description: 'An object, artifact, or technology.' },
        { typeId: 'Event', name: 'Event', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Calendar', description: 'A historical or timeline event.' },
        { typeId: 'Lore', name: 'Lore', defaultTemplateId: 'blank', templates: [{ templateId: 'blank', name: 'Blank', kind: 'blank', contentBlocks: [] }], aiInterviewTemplates: [], icon: 'Scroll', description: 'History, religion, or culture.' },
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

const generateExcerpt = (content: string, length = 150): string => {
    return content.replace(/[#*`\[\]()]/g, '').replace(/\s+/g, ' ').trim().substring(0, length);
};

// --- Helpers: Filenames ---

const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .substring(0, 60);        // Max length
};

const generateFileName = (title: string, id: string): string => {
    const slug = slugify(title) || 'untitled';
    const shortId = id.substring(0, 8);
    return `${slug}--${shortId}.json`;
};

// --- Serialization Logic ---

const serializeNoteToJSON = (note: Note, folderPath: string): string => {
    const diskNote: DiskNote = {
        schemaVersion: 1,
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
            format: 'blocks',
            blocks: [{ 
                id: generateId(), 
                type: 'paragraph', 
                text: note.content || "" 
            }]
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
        
        return {
            id: diskNote.noteId,
            title: diskNote.meta.title,
            type: diskNote.meta.type,
            status: diskNote.meta.status,
            unresolved: diskNote.meta.unresolved,
            universeTag: diskNote.meta.universeTag,
            folderId: 'unknown', 
            createdAt: diskNote.meta.createdAt,
            updatedAt: diskNote.meta.updatedAt,
            content: diskNote.content.blocks.map(b => b.text).join('\n\n'), 
            pinned: diskNote.meta.pinned || false,
            excerpt: generateExcerpt(diskNote.content.blocks.map(b => b.text).join(' ')),
            unresolvedSources: [],
            tag_ids: [],
            metadata: { kind: 'general', data: diskNote.properties.custom },
            system: diskNote.properties.system || {},
            aiInterview: undefined
        };
    } catch (e) {
        console.error("Failed to parse note JSON", e);
        return null;
    }
};

// --- Main Service ---

export class VaultService {
    private adapter: VaultAdapter | null = null;
    private workspaceCache: Workspace | null = null;
    private creationMutex: Map<string, Promise<void>> = new Map();

    // Debounced Config Savers
    public debouncedSaveSettings = debounce(async (data: SettingsData) => {
        if (!this.adapter) return;
        data.updatedAt = Date.now();
        await this.adapter.writeFile(join(METADATA_DIR, FILES.SETTINGS), JSON.stringify(data, null, 2));
    }, 500);

    public debouncedSaveTemplates = debounce(async (data: TemplatesData) => {
        if (!this.adapter) return;
        data.updatedAt = Date.now();
        await this.adapter.writeFile(join(METADATA_DIR, FILES.TEMPLATES), JSON.stringify(data, null, 2));
    }, 500);

    public debouncedSaveHotkeys = debounce(async (data: HotkeysData) => {
        if (!this.adapter) return;
        data.updatedAt = Date.now();
        await this.adapter.writeFile(join(METADATA_DIR, FILES.HOTKEYS), JSON.stringify(data, null, 2));
    }, 500);

    public debouncedSaveMaps = debounce(async (data: MapsData) => {
        if (!this.adapter) return;
        data.updatedAt = Date.now();
        await this.adapter.writeFile(join(METADATA_DIR, FILES.MAPS), JSON.stringify(data, null, 2));
    }, 500);

    // Debounced Note Save
    private debouncedSaveNote = debounce(async (note: Note) => {
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
        await this.adapter.writeFile(path, serializeNoteToJSON(note, folderName));
        
        if (!this.workspaceCache.indexes.note_files) this.workspaceCache.indexes.note_files = {};
        this.workspaceCache.indexes.note_files[note.id] = { fileName, folderPath: folderName };

        if (!note.excerpt) note.excerpt = generateExcerpt(note.content || "");
        this.workspaceCache.notes[note.id] = note;

        if (note.content) {
            const links = extractLinkTitles(note.content);
            for (const linkTitle of links) {
                await this.createUnresolvedNote(linkTitle, note.id, note.title);
            }
        }

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
                folderId: note.folderId
            };
            indexData.notes[note.id] = entry;
        });

        await this.adapter.writeFile(join(METADATA_DIR, FILES.INDEX), JSON.stringify(indexData, null, 2));
    }, 2000); 

    // Metadata Save (Folders, Glossary, Legacy)
    private debouncedSaveMetadata = debounce(async (ws: Workspace) => {
        if (!this.adapter) return;
        const writeMeta = async (file: string, data: any) => {
             await this.adapter!.writeFile(join(METADATA_DIR, file), JSON.stringify(data, null, 2));
        };
        await Promise.all([
            writeMeta(FILES.FOLDERS, ws.folders),
            writeMeta(FILES.GLOSSARY, ws.glossary),
            writeMeta(FILES.NOTIFICATIONS, ws.notificationLog),
        ]);
    }, 3000);

    // UI State Save
    public debouncedSaveUIState = debounce(async (uiState: UIState) => {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);
        const data = JSON.stringify(uiState, null, 2);
        await this.adapter.writeFile(join(METADATA_DIR, FILES.UI_STATE), data);
    }, 500);

    // --- Unresolved Creation Logic ---

    private async createUnresolvedNote(targetTitle: string, sourceNoteId: string, sourceNoteTitle: string) {
        if (!this.workspaceCache || !this.adapter) return;

        const existingId = this.workspaceCache.indexes.title_to_note_id[targetTitle];
        if (existingId) {
            const existingNote = this.workspaceCache.notes[existingId];
            if (existingNote && existingNote.unresolved) {
                await this.ensureNoteContent(existingId);
                const origins = existingNote.system?.unresolvedOrigins || [];
                if (!origins.some((o: UnresolvedOrigin) => o.sourceNoteId === sourceNoteId)) {
                    existingNote.system = {
                        ...existingNote.system,
                        unresolvedOrigins: [...origins, { sourceNoteId, sourceNoteTitle, createdAt: Date.now() }]
                    };
                    existingNote.updatedAt = Date.now();
                    this.workspaceCache.notes[existingId] = existingNote;
                    await this.debouncedSaveNote(existingNote);
                    logNotification(this.workspaceCache, 'info', `Unresolved note "${targetTitle}" referenced again by "${sourceNoteTitle}"`, existingId);
                    this.debouncedSaveMetadata(this.workspaceCache); 
                }
            }
            return;
        }

        const key = targetTitle.toLowerCase();
        if (this.creationMutex.has(key)) return this.creationMutex.get(key);

        const creationTask = (async () => {
            try {
                if (this.workspaceCache?.indexes.title_to_note_id[targetTitle]) return;

                const newId = generateId();
                const now = Date.now();
                const folderName = SYSTEM_DIRS.UNRESOLVED;
                await this.adapter!.mkdir(folderName, { recursive: true });

                const newNote: Note = {
                    id: newId,
                    title: targetTitle,
                    type: "General",
                    status: "Draft",
                    unresolved: true,
                    unresolvedSources: [sourceNoteId],
                    universeTag: null,
                    folderId: SYSTEM_IDS.UNRESOLVED,
                    createdAt: now,
                    updatedAt: now,
                    content: `# ${targetTitle}\n\nUnresolved link created from [[${sourceNoteTitle}]].`,
                    excerpt: `Unresolved link created from ${sourceNoteTitle}.`,
                    pinned: false,
                    tag_ids: [],
                    metadata: { kind: 'general', data: {} },
                    system: { unresolvedOrigins: [{ sourceNoteId, sourceNoteTitle, createdAt: now }] }
                };

                const fileName = generateFileName(targetTitle, newId);
                const path = join(folderName, fileName);
                await this.adapter!.writeFile(path, serializeNoteToJSON(newNote, folderName));

                if (this.workspaceCache) {
                    this.workspaceCache.notes[newId] = newNote;
                    this.workspaceCache.indexes.title_to_note_id[targetTitle] = newId;
                    this.workspaceCache.indexes.unresolved_note_ids.push(newId);
                    
                    if (!this.workspaceCache.indexes.note_files) this.workspaceCache.indexes.note_files = {};
                    this.workspaceCache.indexes.note_files[newId] = { fileName, folderPath: folderName };

                    logNotification(this.workspaceCache, 'warning', `Created unresolved note: "${targetTitle}" from "${sourceNoteTitle}"`, newId);
                    
                    this.debouncedSaveIndex(this.workspaceCache);
                    this.debouncedSaveMetadata(this.workspaceCache);
                }

            } catch (e) {
                console.error(`Failed to create unresolved note: ${targetTitle}`, e);
            } finally {
                this.creationMutex.delete(key);
            }
        })();

        this.creationMutex.set(key, creationTask);
        await creationTask;
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
        } catch (e) { console.error("Picker cancelled/failed", e); throw e; }
    }

    async useDemo(): Promise<void> {
        this.adapter = new IndexedDbAdapter();
        await this.adapter.init();
        await this.ensureScaffold();
    }

    private async ensureScaffold() {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);
        await this.adapter.mkdir(SYSTEM_DIRS.INBOX);
        await this.adapter.mkdir(SYSTEM_DIRS.UNRESOLVED);
        await this.adapter.mkdir(SYSTEM_DIRS.ARCHIVED);

        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.MANIFEST)))) {
             await this.adapter.writeFile(join(METADATA_DIR, FILES.MANIFEST), JSON.stringify({
                schemaVersion: 1,
                vaultId: generateId(),
                createdAt: Date.now(),
                app: { name: "Cosmic Records", formatVersion: 1 }
            }, null, 2));
        }
        
        // Ensure Configs Exist
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.SETTINGS)))) {
            await this.adapter.writeFile(join(METADATA_DIR, FILES.SETTINGS), JSON.stringify(createDefaultSettings(), null, 2));
        }
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.TEMPLATES)))) {
            await this.adapter.writeFile(join(METADATA_DIR, FILES.TEMPLATES), JSON.stringify(createDefaultTemplates(), null, 2));
        }
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.HOTKEYS)))) {
            await this.adapter.writeFile(join(METADATA_DIR, FILES.HOTKEYS), JSON.stringify(createDefaultHotkeys(), null, 2));
        }
        if (!(await this.adapter.exists(join(METADATA_DIR, FILES.MAPS)))) {
            await this.adapter.writeFile(join(METADATA_DIR, FILES.MAPS), JSON.stringify(createDefaultMaps(), null, 2));
        }
    }

    async loadWorkspace(): Promise<Workspace> {
        if (!this.adapter) throw new Error("No vault open");

        const readMeta = async (file: string) => {
            try {
                const content = await this.adapter!.readFile(join(METADATA_DIR, file));
                return typeof content === 'string' ? JSON.parse(content) : null;
            } catch { return null; }
        };

        const [
            manifest, indexData, foldersData, tagsData, glossaryData, 
            settingsData, templatesData, hotkeysData, mapsData,
            notificationsData
        ] = await Promise.all([
            readMeta(FILES.MANIFEST),
            readMeta(FILES.INDEX),
            readMeta(FILES.FOLDERS),
            readMeta(FILES.TAGS),
            readMeta(FILES.GLOSSARY),
            readMeta(FILES.SETTINGS),
            readMeta(FILES.TEMPLATES),
            readMeta(FILES.HOTKEYS),
            readMeta(FILES.MAPS),
            readMeta(FILES.NOTIFICATIONS),
        ]);

        const defaultFolders = {
            [SYSTEM_IDS.INBOX]: { id: SYSTEM_IDS.INBOX, name: SYSTEM_DIRS.INBOX, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 0 },
            [SYSTEM_IDS.UNRESOLVED]: { id: SYSTEM_IDS.UNRESOLVED, name: SYSTEM_DIRS.UNRESOLVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 1 },
            [SYSTEM_IDS.ARCHIVED]: { id: SYSTEM_IDS.ARCHIVED, name: SYSTEM_DIRS.ARCHIVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 999 }
        };

        // Legacy settings fallback
        const prefs = settingsData?.ui || { theme: 'darkCosmos', reduceMotion: false };
        const userPrefs = { 
            ai: { proactive: true, allow_auto_edits: false, remember_preferences: true }, 
            tts: { mode: "selected_text_only" }, 
            ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true } 
        };

        const ws: Workspace = {
            schema_version: "1.0",
            workspace_id: manifest?.vaultId || generateId(),
            name: "Cosmic Vault",
            notes: {},
            folders: { ...defaultFolders, ...(foldersData || {}) },
            collections: {},
            pinnedNoteIds: [], 
            
            // New Configs (Source of Truth)
            settings: settingsData || createDefaultSettings(),
            templates: templatesData || createDefaultTemplates(),
            hotkeys: hotkeysData || createDefaultHotkeys(),
            maps: mapsData || createDefaultMaps(),

            // Legacy
            tags: tagsData?.tags || {},
            glossary: glossaryData || { terms: {}, extraction_queue: [] },
            
            indexes: {
                title_to_note_id: {},
                unresolved_note_ids: [],
                outdated_note_ids: [],
                backlinks: {},
                note_files: {}
            },
            notifications: {},
            notificationLog: notificationsData || [],
            user_preferences: userPrefs as any, 

            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // --- Hydrate Workspace Notes from Index ---
        if (indexData) {
            const entries = (indexData as IndexData).notes;
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
                    content: "", 
                    pinned: entry.pinned,
                    excerpt: entry.excerpt,
                    unresolvedSources: [],
                    tag_ids: []
                };

                ws.notes[note.id] = note;
                ws.indexes.title_to_note_id[note.title] = note.id;
                ws.indexes.note_files![note.id] = { fileName: entry.fileName, folderPath: entry.folderPath };
                
                if (note.pinned) ws.pinnedNoteIds.push(note.id);
                if (note.unresolved) ws.indexes.unresolved_note_ids.push(note.id);
                if (note.status === 'Outdated') ws.indexes.outdated_note_ids.push(note.id);
            });
        }

        return ws;
    }

    async loadUIState(): Promise<UIState | null> {
        if (!this.adapter) return null;
        try {
            const content = await this.adapter.readFile(join(METADATA_DIR, FILES.UI_STATE));
            return typeof content === 'string' ? JSON.parse(content) : null;
        } catch { return null; }
    }

    async ensureNoteContent(noteId: string): Promise<string> {
        if (!this.workspaceCache || !this.adapter) return "";
        const note = this.workspaceCache.notes[noteId];
        if (!note) return "";
        if (note.content && note.content.length > 0) return note.content;
        
        const fileInfo = this.workspaceCache.indexes.note_files?.[noteId];
        if (!fileInfo) return "";

        const path = join(fileInfo.folderPath, fileInfo.fileName);
        try {
            const text = await this.adapter.readFile(path);
            if (typeof text === 'string') {
                const parsed = parseNoteFromJSON(text);
                if (parsed) {
                    note.content = parsed.content;
                    note.metadata = parsed.metadata;
                    note.universeTag = parsed.universeTag;
                    note.pinned = parsed.pinned;
                    note.system = parsed.system; 
                    return parsed.content;
                }
            }
        } catch (e) {
            console.warn(`Could not read/parse note ${noteId} at ${path}`, e);
        }
        return "";
    }

    async rebuildIndex(ws: Workspace): Promise<void> {
        if (!this.adapter) return;
        // Rebuild logic placeholder
    }

    async refresh(): Promise<Workspace> {
        return this.loadWorkspace();
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
    }
}

export const vaultService = new VaultService();
