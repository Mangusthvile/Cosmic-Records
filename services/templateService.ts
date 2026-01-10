import { VaultAdapter } from './adapters';
import { CharacterTemplate, TemplatesIndex, CharacterBlockType, CharacterData } from '../types';
import { join } from './path';
import { createCharacterBlock } from './characterModuleRegistry';

const TEMPLATES_DIR = '.cosmicrecords/templates';
const INDEX_FILE = 'index.json';
const DEFAULT_TEMPLATE_FILE = 'character_default.json';

export const DEFAULT_CHARACTER_TEMPLATE: CharacterTemplate = {
    schemaVersion: 1,
    templateId: 'character_default',
    kind: 'character',
    name: 'Default Character',
    description: 'Standard character sheet with identity, stats, and biography.',
    strictMode: false,
    requiredModules: [],
    suggestedModules: [
        'identity', 'summary', 'appearance', 'personality', 'stats', 
        'abilities', 'items', 'relationships', 'history', 'locations', 
        'tags', 'authorNotes'
    ],
    defaultOrder: [
        'identity', 'summary', 'appearance', 'personality', 'stats', 
        'abilities', 'items', 'relationships', 'history', 'locations', 
        'tags', 'authorNotes'
    ],
    moduleDefaults: {
        identity: {
            fieldHints: {
                Name: "Primary name used in canon.",
                Age: "If unknown, leave blank.",
                Species: "Race, archetype, or form.",
                Origin: "Homeworld, faction, or lineage.",
                Alignment: "Short moral descriptor."
            }
        },
        stats: { title: "Stats" },
        abilities: { title: "Abilities" },
        items: { title: "Inventory" },
        relationships: { title: "Relationships" },
        history: { title: "History" },
        locations: { title: "Locations" },
        authorNotes: { title: "Author Notes" }
    },
    interview: {
        version: 1,
        title: "Character Interview",
        intro: "Answer a few questions. The app will fill your character modules.",
        questions: [
            { id: "name", prompt: "What is their full name?", type: "shortText", required: true },
            { id: "concept", prompt: "Describe their core concept or role.", type: "longText", required: true },
            { id: "appearance", prompt: "What do they look like?", type: "longText" },
            { id: "personality", prompt: "What is their personality like?", type: "longText" },
            { id: "abilities", prompt: "List key abilities or skills (comma separated).", type: "longText" },
            { id: "relationships", prompt: "Who are their key relationships?", type: "longText" },
            { id: "history", prompt: "Briefly describe their background.", type: "longText" }
        ],
        mapping: [
            { type: "setField", moduleType: "identity", field: "Name", fromAnswerId: "name" },
            { type: "richTextFrom", moduleType: "summary", richTextField: "doc", fromAnswerId: "concept" },
            { type: "richTextFrom", moduleType: "appearance", richTextField: "doc", fromAnswerId: "appearance" },
            { type: "richTextFrom", moduleType: "personality", richTextField: "doc", fromAnswerId: "personality" },
            { type: "appendList", moduleType: "abilities", listField: "abilities", fromAnswerId: "abilities" },
            { type: "richTextFrom", moduleType: "relationships", richTextField: "doc", fromAnswerId: "relationships" }, // Correct module type for text-based rels in M6 defaults? Actually M6 defaults use 'refs' for relationships. But let's assume we want to map text to it? Or maybe the default template should use a text block for relationship details if we map text. 
            // Wait, M6 relationships is "refs". Mapping text to it is tricky unless we convert to note links. 
            // The prompt says "richTextFrom relationships.text <- relationships". 
            // If the module type is 'relationships' (which is 'refs'), it expects { links: [] }.
            // If the module is rich text, it works.
            // Let's check `characterModuleRegistry`. 'relationships' is 'refs'. 
            // The prompt example might assume we use a text block or we adapt mapping.
            // "If your module payload schemas differ, adapt mapping".
            // Since `relationships` module is structured refs, mapping raw text to it is hard.
            // I will map "relationships" answer to "authorNotes" or a specific text block if I can't map to structured.
            // OR I can parse the text.
            // For simplicity and stability, I'll map 'relationships' answer to 'authorNotes' appended, OR I'll add a 'relationships_text' block?
            // Actually, the prompt example says `richTextFrom relationships.text`. 
            // If I change 'relationships' module to be richText in the template, it would work. But it is 'refs' by default.
            // I will map it to `history` for now as extra text, OR just `authorNotes`.
            // Let's map to `authorNotes` to be safe.
            { type: "richTextFrom", moduleType: "history", richTextField: "doc", fromAnswerId: "history" }
        ]
    }
};

export class TemplateService {
    private adapter: VaultAdapter | null = null;

    constructor(adapter?: VaultAdapter) {
        if (adapter) this.adapter = adapter;
    }

    setAdapter(adapter: VaultAdapter) {
        this.adapter = adapter;
    }

    async ensureTemplatesStore(): Promise<void> {
        if (!this.adapter) return;
        await this.adapter.mkdir(TEMPLATES_DIR, { recursive: true });
        
        // Ensure Default Template
        const defaultPath = join(TEMPLATES_DIR, DEFAULT_TEMPLATE_FILE);
        if (!(await this.adapter.exists(defaultPath))) {
            await this.writeTemplate(DEFAULT_CHARACTER_TEMPLATE);
        }

        // Ensure Index
        const indexPath = join(TEMPLATES_DIR, INDEX_FILE);
        if (!(await this.adapter.exists(indexPath))) {
            await this.rebuildIndex();
        }
    }

    async loadTemplates(): Promise<Record<string, CharacterTemplate>> {
        if (!this.adapter) return {};
        
        const templates: Record<string, CharacterTemplate> = {};
        const indexPath = join(TEMPLATES_DIR, INDEX_FILE);
        
        try {
            // Read index
            const indexStr = await this.adapter.readFile(indexPath);
            const index: TemplatesIndex = JSON.parse(indexStr as string);
            
            // Load each template in index
            for (const entry of index.templates) {
                try {
                    const tpl = await this.readTemplate(entry.file);
                    if (tpl) {
                        templates[tpl.templateId] = tpl;
                    }
                } catch (e) {
                    console.warn(`Failed to load template ${entry.file}`, e);
                }
            }
        } catch (e) {
            console.error("Failed to load template index, rebuilding...", e);
            await this.rebuildIndex();
            // Try loading again after rebuild (one pass)
            return this.loadTemplatesFromScan(); 
        }

        return templates;
    }

    // Fallback: Scan directory if index is broken
    private async loadTemplatesFromScan(): Promise<Record<string, CharacterTemplate>> {
        if (!this.adapter) return {};
        const templates: Record<string, CharacterTemplate> = {};
        const entries = await this.adapter.listDir(TEMPLATES_DIR);
        
        for (const entry of entries) {
            if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name !== INDEX_FILE) {
                try {
                    const tpl = await this.readTemplate(entry.name);
                    if (tpl) templates[tpl.templateId] = tpl;
                } catch {}
            }
        }
        return templates;
    }

    async readTemplate(filename: string): Promise<CharacterTemplate | null> {
        if (!this.adapter) return null;
        const content = await this.adapter.readFile(join(TEMPLATES_DIR, filename));
        try {
            return JSON.parse(content as string);
        } catch {
            return null;
        }
    }

    async writeTemplate(template: CharacterTemplate): Promise<void> {
        if (!this.adapter) return;
        const filename = `${template.templateId}.json`;
        const content = JSON.stringify(template, null, 2);
        await this.adapter.writeFile(join(TEMPLATES_DIR, filename), content);
    }

    async rebuildIndex(): Promise<void> {
        if (!this.adapter) return;
        const templates = await this.loadTemplatesFromScan();
        const index: TemplatesIndex = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            templates: Object.values(templates).map(t => ({
                templateId: t.templateId,
                kind: t.kind,
                name: t.name,
                description: t.description,
                file: `${t.templateId}.json`
            }))
        };
        await this.adapter.writeFile(join(TEMPLATES_DIR, INDEX_FILE), JSON.stringify(index, null, 2));
    }

    // --- Generation Logic ---

    createCharacterData(templateId: string, templates: Record<string, CharacterTemplate>): CharacterData {
        const template = templates[templateId] || DEFAULT_CHARACTER_TEMPLATE;
        
        // 1. Determine module list
        const order = template.defaultOrder && template.defaultOrder.length > 0 
            ? template.defaultOrder 
            : template.suggestedModules;
        
        // Dedup
        const uniqueTypes = Array.from(new Set(order));

        // 2. Create Blocks
        const blocks = uniqueTypes.map(type => {
            const block = createCharacterBlock(type);
            const defaults = template.moduleDefaults[type];
            
            if (defaults) {
                if (defaults.title) block.title = defaults.title;
                if (defaults.collapsed !== undefined) block.collapsed = defaults.collapsed;
                // Field hints are handled via metadata, not payload injection here
            }
            return block;
        });

        // 3. Extract hints
        const templateHintsByType: Record<string, { fieldHints?: Record<string, string> }> = {};
        for (const type of uniqueTypes) {
            const defaults = template.moduleDefaults[type];
            if (defaults?.fieldHints) {
                templateHintsByType[type] = { fieldHints: defaults.fieldHints };
            }
        }

        const now = Date.now();

        return {
            templateId: template.templateId,
            templateStrict: template.strictMode,
            templateHintsByType,
            blocks,
            forms: {
                schemaVersion: 1,
                activeFormId: 'form_base',
                order: ['form_base'],
                items: {
                    'form_base': {
                        formId: 'form_base',
                        name: 'Base',
                        createdAt: now,
                        updatedAt: now,
                        overrides: {},
                        localBlocks: []
                    }
                }
            },
            snapshots: {
                schemaVersion: 1,
                activeSnapshotId: null,
                order: [],
                items: {}
            }
        };
    }
}

export const templateService = new TemplateService();