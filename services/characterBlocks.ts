import { CharacterBlock, CharacterBlockType, KeyValueBlockPayload, StatGridBlockPayload, TextBlockPayload, MeterBlockPayload } from '../types';

export const CHARACTER_BLOCK_TYPES: CharacterBlockType[] = ['text', 'keyValue', 'statGrid', 'meter'];

export interface BlockDefinition {
    type: CharacterBlockType;
    displayName: string;
    iconKey: string;
    defaultTitle: string;
    createPayload: () => any;
}

const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

export const BLOCK_REGISTRY: Partial<Record<CharacterBlockType, BlockDefinition>> = {
    text: {
        type: 'text',
        displayName: 'Text Area',
        iconKey: 'FileText',
        defaultTitle: 'Notes',
        createPayload: (): TextBlockPayload => ({
            doc: { type: 'doc', content: [] }
        })
    },
    keyValue: {
        type: 'keyValue',
        displayName: 'Key-Value List',
        iconKey: 'List',
        defaultTitle: 'Details',
        createPayload: (): KeyValueBlockPayload => ({
            fields: []
        })
    },
    statGrid: {
        type: 'statGrid',
        displayName: 'Stat Grid',
        iconKey: 'Grid',
        defaultTitle: 'Stats',
        createPayload: (): StatGridBlockPayload => ({
            columns: ['Value'],
            rows: []
        })
    },
    meter: {
        type: 'meter',
        displayName: 'Meter',
        iconKey: 'Activity',
        defaultTitle: 'Status',
        createPayload: (): MeterBlockPayload => ({
            items: []
        })
    },
    unknown: {
        type: 'unknown',
        displayName: 'Unknown',
        iconKey: 'HelpCircle',
        defaultTitle: 'Unknown Block',
        createPayload: () => ({})
    }
};

export const createDefaultBlock = (type: CharacterBlockType, title?: string, payloadOverride?: any): CharacterBlock => {
    const def = BLOCK_REGISTRY[type] || BLOCK_REGISTRY.unknown;
    if (!def) {
        // Fallback if somehow unknown is missing or type not found
        return {
            blockId: generateId(),
            type: 'unknown',
            title: title || 'Unknown Block',
            collapsed: false,
            payload: {}
        };
    }
    return {
        blockId: generateId(),
        type: type,
        title: title || def.defaultTitle,
        collapsed: false,
        payload: payloadOverride || def.createPayload()
    };
};

export const normalizeBlock = (block: any): CharacterBlock => {
    if (!block.blockId) block.blockId = generateId();
    if (!block.type) block.type = 'unknown';
    
    // Ensure payload exists
    if (!block.payload) {
        const def = BLOCK_REGISTRY[block.type as CharacterBlockType] || BLOCK_REGISTRY.unknown;
        block.payload = def ? def.createPayload() : {};
    }
    
    if (typeof block.collapsed !== 'boolean') block.collapsed = false;
    if (!block.title) block.title = 'Untitled Block';

    return block as CharacterBlock;
};