
import { Workspace, Note, Folder, NoteStatus, NotificationLogItem, GlossaryTerm, ID, DiskNote, IndexEntry, NoteBlock, IndexData, UIState } from '../types';
import { getHandle, setHandle } from './idb';
import { VaultAdapter, FileSystemAccessAdapter, IndexedDbAdapter, DirEntry } from './adapters';
import { join, dirname, basename } from './path';

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
    STARMAPS: 'starmaps.json',
    SETTINGS: 'settings.json',
    HOTKEYS: 'hotkeys.json',
    WORKSPACE: 'workspace.json',
    WIDGETS: 'widgets.json',
    PINNED: 'pinned.json', // Deprecated in favor of index but file might exist
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
            tags: [] // Future tag system
        },
        properties: {
            custom: note.metadata?.data || {},
            system: {} 
        },
        content: {
            format: 'blocks',
            // Simple mapping: 1 paragraph block for textarea content
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
            folderId: 'unknown', // Resolved from index/folder map
            createdAt: diskNote.meta.createdAt,
            updatedAt: diskNote.meta.updatedAt,
            content: diskNote.content.blocks.map(b => b.text).join('\n\n'), 
            pinned: diskNote.meta.pinned || false,
            excerpt: generateExcerpt(diskNote.content.blocks.map(b => b.text).join(' ')),
            unresolvedSources: [],
            tag_ids: [],
            metadata: { kind: 'general', data: diskNote.properties.custom },
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

    // Debounced Note Save: Updates File AND Index
    private debouncedSaveNote = debounce(async (note: Note) => {
        if (!this.adapter || !this.workspaceCache) return;
        
        // 1. Resolve Folder Info
        const folder = this.workspaceCache.folders[note.folderId];
        const folderName = folder ? folder.name : SYSTEM_DIRS.INBOX;
        await this.adapter.mkdir(folderName, { recursive: true });

        // 2. Resolve Filename & Paths
        let fileName = generateFileName(note.title, note.id);
        const existingFileIndex = this.workspaceCache.indexes.note_files?.[note.id];
        
        if (existingFileIndex) {
            fileName = existingFileIndex.fileName;
            // Move file if folder changed
            if (existingFileIndex.folderPath !== folderName) {
                const oldPath = join(existingFileIndex.folderPath, fileName);
                const newPath = join(folderName, fileName);
                if (await this.adapter.exists(oldPath)) {
                    await this.adapter.move(oldPath, newPath);
                }
            }
        }
        
        const path = join(folderName, fileName);

        // 3. Write Note File (First, for safety)
        await this.adapter.writeFile(path, serializeNoteToJSON(note, folderName));
        
        // 4. Update Cache (which serves as In-Memory Index)
        if (!this.workspaceCache.indexes.note_files) this.workspaceCache.indexes.note_files = {};
        
        this.workspaceCache.indexes.note_files[note.id] = {
            fileName,
            folderPath: folderName
        };

        // Update the Note object in cache (it might be a shell, this ensures metadata is fresh)
        // Also ensure excerpt is fresh
        if (!note.excerpt) {
            note.excerpt = generateExcerpt(note.content || "");
        }
        this.workspaceCache.notes[note.id] = note;

        // 5. Trigger Index Save
        this.debouncedSaveIndex(this.workspaceCache);

    }, 800); // Slightly faster debounce for notes

    // Persist ONLY the index file
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

    // Separate debounce for other workspace metadata
    private debouncedSaveMetadata = debounce(async (ws: Workspace) => {
        if (!this.adapter) return;
        
        const writeMeta = async (file: string, data: any) => {
             await this.adapter!.writeFile(join(METADATA_DIR, file), JSON.stringify(data, null, 2));
        };

        await Promise.all([
            writeMeta(FILES.FOLDERS, ws.folders),
            writeMeta(FILES.TAGS, { tags: ws.tags, universe_tags: ws.universe_tags }),
            writeMeta(FILES.GLOSSARY, ws.glossary),
            writeMeta(FILES.TEMPLATES, ws.templates),
            writeMeta(FILES.STARMAPS, ws.map),
            writeMeta(FILES.SETTINGS, ws.user_preferences),
            writeMeta(FILES.NOTIFICATIONS, ws.notificationLog),
        ]);
        
        // Note: paneSystem and widgets logic moved to saveUIState. 
        // We do not save them here anymore to avoid conflicts with dedicated UI state file.
    }, 3000);

    // Dedicated UI State Saver
    public debouncedSaveUIState = debounce(async (uiState: UIState) => {
        if (!this.adapter) return;
        await this.adapter.mkdir(METADATA_DIR);
        const data = JSON.stringify(uiState, null, 2);
        await this.adapter.writeFile(join(METADATA_DIR, FILES.UI_STATE), data);
    }, 500);

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
        } catch (e) {
            console.error("Picker cancelled/failed", e);
            throw e;
        }
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
            templatesData, starmapsData, settingsData, workspaceData, 
            widgetsData, notificationsData
        ] = await Promise.all([
            readMeta(FILES.MANIFEST),
            readMeta(FILES.INDEX),
            readMeta(FILES.FOLDERS),
            readMeta(FILES.TAGS),
            readMeta(FILES.GLOSSARY),
            readMeta(FILES.TEMPLATES),
            readMeta(FILES.STARMAPS),
            readMeta(FILES.SETTINGS),
            readMeta(FILES.WORKSPACE),
            readMeta(FILES.WIDGETS),
            readMeta(FILES.NOTIFICATIONS),
        ]);

        const defaultFolders = {
            [SYSTEM_IDS.INBOX]: { id: SYSTEM_IDS.INBOX, name: SYSTEM_DIRS.INBOX, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 0 },
            [SYSTEM_IDS.UNRESOLVED]: { id: SYSTEM_IDS.UNRESOLVED, name: SYSTEM_DIRS.UNRESOLVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 1 },
            [SYSTEM_IDS.ARCHIVED]: { id: SYSTEM_IDS.ARCHIVED, name: SYSTEM_DIRS.ARCHIVED, type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 999 }
        };

        const ws: Workspace = {
            schema_version: "1.0",
            workspace_id: manifest?.vaultId || generateId(),
            name: "Cosmic Vault",
            notes: {},
            folders: { ...defaultFolders, ...(foldersData || {}) },
            collections: {},
            pinnedNoteIds: [], // Deprecated, derived from notes
            tags: tagsData?.tags || {},
            universe_tags: tagsData?.universe_tags || {},
            glossary: glossaryData || { terms: {}, extraction_queue: [] },
            templates: templatesData || { character_templates: {}, place_templates: {} },
            map: starmapsData || {
                id: generateId(),
                root_layer_id: "root",
                layers: { "root": { id: "root", scale: "cosmos", place_note_id: "", node_ids: [], zoom_targets: {}, created_at: new Date().toISOString() } },
                nodes: {}, edges: {}, ui: { active_layer_id: "root", selected_node_id: null }
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
            user_preferences: settingsData || { 
                ai: { proactive: true, allow_auto_edits: false, remember_preferences: true }, 
                tts: { mode: "selected_text_only" }, 
                ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true } 
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // --- Hydrate Workspace Notes from Index ---
        // If index is missing, we must recover/rebuild
        if (!indexData) {
            console.warn("Index missing. Triggering recovery...");
            // Returning empty workspace here, relying on UI to trigger rebuild if needed or auto-trigger?
            // For robustness, let's await rebuild immediately if it's safe, but UI feedback is better.
            // We'll return empty notes for now.
        } else {
            const entries = (indexData as IndexData).notes;
            
            // Map Index Entries to Shell Notes
            Object.values(entries).forEach((entry: IndexEntry) => {
                
                // Map Folder Path to ID
                // Simple heuristic: find folder by name. Ideally index stores folderId, but prompt schema didn't explicitly mandate it until Section A notes. 
                // We added folderId to IndexEntry interface to make this fast.
                let folderId = entry.folderId;
                if (!folderId) {
                    // Fallback lookup
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
                    content: "", // Lazy loaded
                    pinned: entry.pinned,
                    excerpt: entry.excerpt,
                    unresolvedSources: [],
                    tag_ids: []
                };

                ws.notes[note.id] = note;
                ws.indexes.title_to_note_id[note.title] = note.id;
                ws.indexes.note_files![note.id] = { fileName: entry.fileName, folderPath: entry.folderPath };
                
                if (note.pinned) ws.pinnedNoteIds.push(note.id); // Sync legacy array
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

        // Return cached content if already loaded (length check is heuristic, empty note might be valid)
        // Better: Check if we have flagged it as loaded? 
        // For MVP, if content is non-empty string, it's loaded. 
        if (note.content && note.content.length > 0) return note.content;
        
        // Use Index to find path
        const fileInfo = this.workspaceCache.indexes.note_files?.[noteId];
        if (!fileInfo) return ""; // Should exist if loaded from index

        const path = join(fileInfo.folderPath, fileInfo.fileName);

        try {
            const text = await this.adapter.readFile(path);
            if (typeof text === 'string') {
                const parsed = parseNoteFromJSON(text);
                if (parsed) {
                    note.content = parsed.content;
                    note.metadata = parsed.metadata;
                    // Keep metadata in sync just in case
                    note.universeTag = parsed.universeTag;
                    note.pinned = parsed.pinned;
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
        console.log("Rebuilding index...");

        const allEntries: Record<string, IndexEntry> = {};
        const processDir = async (path: string) => {
            const entries = await this.adapter!.listDir(path);
            for (const ent of entries) {
                if (ent.kind === 'dir' && ent.name !== METADATA_DIR) {
                    await processDir(ent.path);
                } else if (ent.kind === 'file' && ent.name.endsWith('.json')) {
                    // Try parse
                    try {
                        const text = await this.adapter!.readFile(ent.path);
                        if (typeof text === 'string') {
                            const parsed = parseNoteFromJSON(text);
                            if (parsed) {
                                // Re-establish metadata mapping
                                const folderPath = dirname(ent.path);
                                const folderName = basename(folderPath);
                                // Map folder name back to ID logic or system default
                                const folderObj = Object.values(ws.folders).find(f => f.name === folderName);
                                const folderId = folderObj ? folderObj.id : SYSTEM_IDS.INBOX;

                                const indexEntry: IndexEntry = {
                                    noteId: parsed.id,
                                    filePath: ent.path,
                                    folderPath: folderPath,
                                    fileName: ent.name,
                                    title: parsed.title,
                                    type: parsed.type,
                                    status: parsed.status,
                                    unresolved: parsed.unresolved,
                                    universeTag: parsed.universeTag,
                                    tags: [],
                                    pinned: parsed.pinned,
                                    createdAt: parsed.createdAt,
                                    updatedAt: parsed.updatedAt,
                                    excerpt: parsed.excerpt || "",
                                    folderId
                                };
                                allEntries[parsed.id] = indexEntry;
                                
                                // Update Workspace Cache Live
                                ws.notes[parsed.id] = parsed; // Loads content into memory immediately during rebuild
                                ws.indexes.note_files![parsed.id] = { fileName: ent.name, folderPath: folderPath };
                            }
                        }
                    } catch (e) { console.error("Skip bad file", ent.path); }
                }
            }
        };

        // Root folders scan
        await processDir(''); 
        
        const indexData: IndexData = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            notes: allEntries
        };
        
        await this.adapter.writeFile(join(METADATA_DIR, FILES.INDEX), JSON.stringify(indexData, null, 2));
    }

    async refresh(): Promise<Workspace> {
        // Reload manifest/index and return fresh workspace
        return this.loadWorkspace();
    }

    onNoteChange(note: Note) {
        if (this.workspaceCache) {
            this.workspaceCache.notes[note.id] = note;
            // Sync pinned array for legacy consumers
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
    }
}

export const vaultService = new VaultService();
