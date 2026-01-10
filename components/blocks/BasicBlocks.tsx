import React from 'react';
import { CharacterBlock } from '../../types';
import HybridEditor from '../editor/HybridEditor';
import { Input } from '../ui/Primitives';

interface BlockProps {
    block: CharacterBlock;
    onChange: (payload: any) => void;
    workspace: any;
    onOpenNote: (id: string) => void;
}

export const TextBlock: React.FC<BlockProps> = ({ block, onChange, workspace, onOpenNote }) => {
    return (
        <div className="min-h-[100px] border border-border rounded bg-bg p-2">
            <HybridEditor 
                doc={block.payload.doc || { type: 'doc', content: [] }}
                noteId={`block-${block.blockId}`} 
                onDocChange={(doc) => onChange({ doc })}
                workspace={workspace}
                onOpenNote={onOpenNote}
                linkMode='note'
            />
        </div>
    );
};

export const KeyValueBlock: React.FC<BlockProps> = ({ block, onChange }) => {
    const pairs = block.payload.pairs || [];
    
    const updatePair = (idx: number, key: string, value: string) => {
        const newPairs = [...pairs];
        newPairs[idx] = { key, value };
        onChange({ pairs: newPairs });
    };

    const addPair = () => onChange({ pairs: [...pairs, { key: '', value: '' }] });

    return (
        <div className="space-y-2">
            {pairs.map((p: any, i: number) => (
                <div key={i} className="flex gap-2">
                    <Input placeholder="Key" value={p.key} onChange={e => updatePair(i, e.target.value, p.value)} className="w-1/3" />
                    <Input placeholder="Value" value={p.value} onChange={e => updatePair(i, p.key, e.target.value)} className="flex-1" />
                </div>
            ))}
            <button onClick={addPair} className="text-xs text-accent hover:underline">+ Add Field</button>
        </div>
    );
};