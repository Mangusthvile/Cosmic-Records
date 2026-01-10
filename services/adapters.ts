import { getHandle, setHandle, getEntry, putEntry, deleteEntry, getAllEntries } from './idb';
import { normalize, dirname, join, basename } from './path';

export interface DirEntry {
  name: string;
  path: string;
  kind: "file" | "dir";
  size?: number;
  modifiedAt?: number;
}

export interface WriteOptions {
    create?: boolean;
    overwrite?: boolean;
    encoding?: "utf8" | "binary";
}

export interface MkdirOptions {
    recursive?: boolean;
}

export interface VaultAdapter {
    id: string;
    type: 'file' | 'local';
    
    init(): Promise<void>;
    
    readFile(path: string, encoding?: "utf8" | "binary"): Promise<Uint8Array | string>;
    writeFile(path: string, data: Uint8Array | string, options?: WriteOptions): Promise<void>;
    
    listDir(path: string): Promise<DirEntry[]>;
    mkdir(path: string, options?: MkdirOptions): Promise<void>;
    
    move(from: string, to: string): Promise<void>;
    renameDir(oldPath: string, newPath: string): Promise<void>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
}

// --- File System Access API Adapter ---

export class FileSystemAccessAdapter implements VaultAdapter {
    id = 'fs-vault';
    type = 'file' as const;
    private root: FileSystemDirectoryHandle | null = null;
    
    constructor(handle?: FileSystemDirectoryHandle) {
        if (handle) this.root = handle;
    }

    async init() {
        if (!this.root) throw new Error("Root handle missing");
        const perm = await (this.root as any).queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
             const request = await (this.root as any).requestPermission({ mode: 'readwrite' });
             if (request !== 'granted') throw new Error("Permission denied");
        }
    }

    private async resolveHandle(path: string, create: boolean = false, kind: 'file' | 'dir' = 'file'): Promise<FileSystemHandle | undefined> {
        if (!this.root) throw new Error("Not initialized");
        
        // Normalize: treat "." and "" as root
        const normalizedPath = (path === '.' || path === '') ? '' : normalize(path);
        const parts = normalizedPath.split('/').filter(p => p.length > 0);
        
        if (parts.length === 0) return this.root; // Root

        let current: FileSystemDirectoryHandle = this.root;
        
        // Traverse dirs
        for (let i = 0; i < parts.length - 1; i++) {
            try {
                current = await current.getDirectoryHandle(parts[i], { create: create });
            } catch {
                return undefined;
            }
        }

        const leafName = parts[parts.length - 1];
        try {
            if (kind === 'dir') {
                return await current.getDirectoryHandle(leafName, { create });
            } else {
                return await current.getFileHandle(leafName, { create });
            }
        } catch {
            return undefined;
        }
    }

    async readFile(path: string, encoding: "utf8" | "binary" = "utf8"): Promise<Uint8Array | string> {
        const handle = await this.resolveHandle(path, false, 'file') as FileSystemFileHandle;
        if (!handle) throw new Error(`File not found: ${path}`);
        const file = await handle.getFile();
        if (encoding === 'binary') {
            return new Uint8Array(await file.arrayBuffer());
        }
        return await file.text();
    }

    async writeFile(path: string, data: Uint8Array | string, options: WriteOptions = { create: true, overwrite: true }): Promise<void> {
        const handle = await this.resolveHandle(path, options.create, 'file') as FileSystemFileHandle;
        if (!handle) throw new Error(`Could not write to: ${path}`);
        
        const writable = await handle.createWritable();
        if (typeof data === 'string') {
            await writable.write(data);
        } else {
            const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            await writable.write(buffer);
        }
        await writable.close();
    }

    async listDir(path: string): Promise<DirEntry[]> {
        // Fix: Explicitly handle root path normalization for resolveHandle
        const handle = await this.resolveHandle(path, false, 'dir') as FileSystemDirectoryHandle;
        if (!handle) throw new Error(`Directory not found: ${path}`);
        
        const entries: DirEntry[] = [];
        // @ts-ignore
        for await (const [name, entry] of handle.entries()) {
            const file = entry.kind === 'file' ? await (entry as FileSystemFileHandle).getFile() : null;
            // Join path carefully. If root, just use name.
            const entryPath = (path === '' || path === '.') ? name : join(path, name);
            
            entries.push({
                name: name,
                path: entryPath,
                kind: entry.kind === 'directory' ? 'dir' : 'file',
                size: file ? file.size : undefined,
                modifiedAt: file ? file.lastModified : undefined
            });
        }
        return entries;
    }

    async mkdir(path: string, options: MkdirOptions = { recursive: true }): Promise<void> {
        await this.resolveHandle(path, true, 'dir');
    }

    async move(from: string, to: string): Promise<void> {
        const srcHandle = await this.resolveHandle(from, false, 'file') as FileSystemFileHandle;
        if (!srcHandle) throw new Error(`Source not found: ${from}`);
        
        const file = await srcHandle.getFile();
        const data = await file.arrayBuffer();
        
        await this.writeFile(to, new Uint8Array(data));
        await this.delete(from);
    }

    async renameDir(oldPath: string, newPath: string): Promise<void> {
        const copyRecursive = async (src: string, dest: string) => {
            await this.mkdir(dest);
            const entries = await this.listDir(src);
            for (const entry of entries) {
                const destPath = join(dest, entry.name);
                if (entry.kind === 'file') {
                    await this.move(entry.path, destPath);
                } else {
                    await copyRecursive(entry.path, destPath);
                }
            }
        };

        if (!(await this.exists(oldPath))) throw new Error(`Source dir not found: ${oldPath}`);
        if (await this.exists(newPath)) throw new Error(`Destination dir already exists: ${newPath}`);

        await copyRecursive(oldPath, newPath);
        await this.delete(oldPath);
    }

    async delete(path: string): Promise<void> {
        const parentPath = dirname(path);
        const name = basename(path);
        const parentHandle = await this.resolveHandle(parentPath, false, 'dir') as FileSystemDirectoryHandle;
        if (parentHandle) {
             await parentHandle.removeEntry(name, { recursive: true });
        }
    }

    async exists(path: string): Promise<boolean> {
        const handle = await this.resolveHandle(path, false, 'file') || await this.resolveHandle(path, false, 'dir');
        return !!handle;
    }
}

// --- IndexedDB Adapter ---

export class IndexedDbAdapter implements VaultAdapter {
    id = 'idb-vault';
    type = 'local' as const;

    async init() { }

    async readFile(path: string, encoding: "utf8" | "binary" = "utf8"): Promise<Uint8Array | string> {
        const entry = await getEntry(normalize(path));
        if (!entry || entry.kind !== 'file') throw new Error(`File not found: ${path}`);
        return entry.data;
    }

    async writeFile(path: string, data: Uint8Array | string, options: WriteOptions = { create: true }): Promise<void> {
        const normPath = normalize(path);
        const exists = await getEntry(normPath);
        if (!exists && !options.create) throw new Error("File does not exist and create is false");
        
        await putEntry({
            path: normPath,
            kind: 'file',
            data: data,
            modifiedAt: Date.now()
        });
        
        const parent = dirname(normPath);
        if (parent && parent !== '.') {
            await this.mkdir(parent, { recursive: true });
        }
    }

    async listDir(path: string): Promise<DirEntry[]> {
        const normPath = (path === '.' || path === '') ? '' : normalize(path);
        const all = await getAllEntries();
        const prefix = normPath ? normPath + '/' : '';
        
        const children: DirEntry[] = [];
        const seen = new Set<string>();

        for (const entry of all) {
            if (entry.path.startsWith(prefix) && entry.path !== normPath) {
                const relative = entry.path.substring(prefix.length);
                const slashIndex = relative.indexOf('/');
                
                if (slashIndex === -1) {
                    children.push({
                        name: relative,
                        path: entry.path,
                        kind: entry.kind,
                        modifiedAt: entry.modifiedAt,
                        size: entry.data ? entry.data.length : 0
                    });
                } else {
                    const dirName = relative.substring(0, slashIndex);
                    if (!seen.has(dirName)) {
                        if (!children.some(c => c.name === dirName)) {
                             children.push({ name: dirName, path: prefix + dirName, kind: 'dir' });
                        }
                        seen.add(dirName);
                    }
                }
            }
        }
        return children;
    }

    async mkdir(path: string, options: MkdirOptions = { recursive: true }): Promise<void> {
        const normPath = normalize(path);
        if (!normPath || normPath === '.') return;
        
        const exists = await getEntry(normPath);
        if (!exists) {
            await putEntry({ path: normPath, kind: 'dir', modifiedAt: Date.now() });
        }
        
        if (options.recursive) {
            const parent = dirname(normPath);
            if (parent && parent !== normPath) {
                await this.mkdir(parent, options);
            }
        }
    }

    async move(from: string, to: string): Promise<void> {
        const entry = await getEntry(normalize(from));
        if (!entry) throw new Error(`Source not found: ${from}`);
        
        if (entry.kind === 'file') {
            await putEntry({ ...entry, path: normalize(to) });
            await deleteEntry(normalize(from));
        } else {
            throw new Error("Use renameDir for directories");
        }
    }

    async renameDir(oldPath: string, newPath: string): Promise<void> {
        const all = await getAllEntries();
        const prefix = normalize(oldPath) + '/';
        const newPrefix = normalize(newPath) + '/';

        const destExists = await getEntry(normalize(newPath));
        if (destExists) throw new Error("Destination directory exists");

        for (const e of all) {
            if (e.path.startsWith(prefix)) {
                const suffix = e.path.substring(prefix.length);
                const target = newPrefix + suffix;
                await putEntry({ ...e, path: target });
                await deleteEntry(e.path);
            }
        }
        
        const dirEntry = await getEntry(normalize(oldPath));
        if (dirEntry) {
            await putEntry({ ...dirEntry, path: normalize(newPath) });
            await deleteEntry(normalize(oldPath));
        } else {
             await putEntry({ path: normalize(newPath), kind: 'dir', modifiedAt: Date.now() });
        }
    }

    async delete(path: string): Promise<void> {
        const norm = normalize(path);
        const entry = await getEntry(norm);
        if (!entry) return;

        if (entry.kind === 'file') {
            await deleteEntry(norm);
        } else {
            const all = await getAllEntries();
            const prefix = norm + '/';
            for (const e of all) {
                if (e.path.startsWith(prefix)) {
                    await deleteEntry(e.path);
                }
            }
            await deleteEntry(norm);
        }
    }

    async exists(path: string): Promise<boolean> {
        return !!(await getEntry(normalize(path)));
    }
}