
import React from 'react';
import { Workspace, MapData } from '../../types';
import { Plus, Globe, Map as MapIcon, Layers } from 'lucide-react';
import { IconButton, Separator } from '../ui/Primitives';
import { createMap } from '../../services/storageService';

interface StarMapNavigationProps {
    workspace: Workspace;
    onOpenMap: (mapId: string) => void;
    onUpdateWorkspace: (ws: Workspace) => void;
}

const StarMapNavigation: React.FC<StarMapNavigationProps> = ({ workspace, onOpenMap, onUpdateWorkspace }) => {
    const maps = Object.values(workspace.maps.maps);

    const handleCreateMap = () => {
        const name = prompt("New Map Name:");
        if (name) {
            const id = createMap(workspace, name);
            onUpdateWorkspace({ ...workspace });
            onOpenMap(id);
        }
    };

    return (
        <div className="flex flex-col h-full bg-panel">
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={handleCreateMap} title="New Map"><Plus size={16}/></IconButton>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text2">Star Maps</div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                <div>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-text2 tracking-widest">Available Maps</div>
                    <div className="space-y-1 mt-1">
                        {maps.map(map => (
                            <div 
                                key={map.mapId}
                                onClick={() => onOpenMap(map.mapId)}
                                className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-panel2 text-text transition-colors border border-transparent hover:border-border"
                            >
                                <Globe size={14} className="text-accent opacity-70" />
                                <span className="text-xs font-medium truncate">{map.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                <div>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-text2 tracking-widest">Toolbox</div>
                    <div className="p-3 text-xs text-text2 italic bg-panel2 rounded border border-border mt-1">
                        Map tools coming soon (Shapes, Nodes, Auto-layout).
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StarMapNavigation;
