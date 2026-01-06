import React, { useState } from 'react';
import { Workspace, Folder } from '../types';
import { Folder as FolderIcon, X, Check } from 'lucide-react';

interface MoveNoteModalProps {
    workspace: Workspace;
    noteId: string;
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetFolderId: string) => void;
}

const MoveNoteModal: React.FC<MoveNoteModalProps> = ({ workspace, noteId, isOpen, onClose, onMove }) => {
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    if (!isOpen) return null;

    const note = workspace.notes[noteId];
    if (!note) return null;

    // Helper to flatten folder tree for picker
    const getFlattenedFolders = (parentId: string | null = null, depth = 0): { folder: Folder, depth: number }[] => {
        const children = (Object.values(workspace.folders) as Folder[])
            .filter(f => f.parentId === parentId)
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        
        let result: { folder: Folder, depth: number }[] = [];
        children.forEach(child => {
            result.push({ folder: child, depth });
            result.push(...getFlattenedFolders(child.id, depth + 1));
        });
        return result;
    };

    const flatFolders = getFlattenedFolders(null);
    const systemFolders = ['inbox', 'unresolved', 'archived'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[400px] bg-panel border border-border rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-surface/50">
                    <h3 className="text-sm font-bold text-foreground">Move "{note.title}"</h3>
                    <button onClick={onClose}><X size={16} className="text-muted hover:text-foreground"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {flatFolders.map(({ folder, depth }) => {
                         const isSystem = systemFolders.includes(folder.id);
                         const isCurrent = note.folderId === folder.id;
                         
                         return (
                             <button
                                key={folder.id}
                                onClick={() => !isCurrent && setSelectedFolderId(folder.id)}
                                disabled={isCurrent}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors
                                    ${selectedFolderId === folder.id ? 'bg-accent/20 text-accent border border-accent/50' : 'hover:bg-[var(--c-hover)] text-muted'}
                                    ${isCurrent ? 'opacity-50 cursor-default' : 'cursor-pointer'}
                                `}
                                style={{ paddingLeft: `${(depth * 12) + 12}px` }}
                             >
                                 <FolderIcon size={14} className={isSystem ? 'text-warning' : 'text-accent'} />
                                 <span className={isSystem ? 'italic' : ''}>{folder.name}</span>
                                 {isCurrent && <span className="ml-auto text-[10px] uppercase text-faint">Current</span>}
                                 {selectedFolderId === folder.id && <Check size={14} className="ml-auto" />}
                             </button>
                         );
                    })}
                </div>

                <div className="p-4 border-t border-border bg-surface/30 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground">Cancel</button>
                    <button 
                        onClick={() => selectedFolderId && onMove(selectedFolderId)}
                        disabled={!selectedFolderId}
                        className="bg-accent text-white px-4 py-1.5 rounded text-xs font-bold disabled:opacity-50 shadow-glow"
                    >
                        Move Here
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveNoteModal;