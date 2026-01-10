import { TextBlock, KeyValueBlock } from './BasicBlocks';
import { FileText, List } from 'lucide-react';

export const BlockRegistry = {
    'text': {
        component: TextBlock,
        icon: FileText,
        label: 'Text Block',
        createPayload: () => ({ doc: { type: 'doc', content: [] } })
    },
    'keyValue': {
        component: KeyValueBlock,
        icon: List,
        label: 'Key Value',
        createPayload: () => ({ pairs: [{ key: '', value: '' }] })
    }
};

export type BlockType = keyof typeof BlockRegistry;