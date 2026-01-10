
import { CharacterBlock, CharacterBlockType, CharacterData, CharacterTemplate, Workspace, InterviewMappingRule } from '../types';
import { createCharacterBlock } from './modularModuleRegistry';
import { templateService, DEFAULT_CHARACTER_TEMPLATE } from './templateService';
import { createNote } from './storageService';

export interface CreationOptions {
    title?: string;
    folderId: string;
    universeTag: string | null;
    templateId: string;
    method: 'blank' | 'interview';
    answers?: Record<string, any>;
}

export class CharacterCreationService {
    
    createCharacterNote(workspace: Workspace, options: CreationOptions) {
        // 1. Resolve Template
        const template = workspace.characterTemplates[options.templateId] || DEFAULT_CHARACTER_TEMPLATE;

        // 2. Determine Title
        let title = options.title;
        if (!title && options.method === 'interview' && options.answers) {
            // Find "name" answer if exists (using common id convention or mapping logic?)
            // Convention: question id "name"
            if (options.answers['name']) {
                title = options.answers['name'];
            }
        }
        if (!title) title = "Untitled Character";

        // 3. Create Note Shell
        // We use storageService.createNote but bypass its default characterData generation
        // by modifying it afterwards, or we pass a flag. 
        // Better: reuse createNote but immediately overwrite metadata.characterData
        const note = createNote(workspace, {
            title,
            type: 'Character',
            status: 'Draft',
            folderId: options.folderId,
            universeTag: options.universeTag
        });

        // 4. Generate Character Data
        const characterData = this.generateCharacterData(template, options.method, options.answers);
        
        note.metadata = {
            ...note.metadata,
            characterData,
            kind: 'character'
        };

        return note;
    }

    private generateCharacterData(template: CharacterTemplate, method: 'blank' | 'interview', answers?: Record<string, any>): CharacterData {
        // Base Data from Template Service
        const data = templateService.createCharacterData(template.templateId, { [template.templateId]: template });

        // If Interview, apply mapping
        if (method === 'interview' && answers && template.interview) {
            this.applyMapping(data, answers, template.interview.mapping);
        }

        return data;
    }

    private applyMapping(data: CharacterData, answers: Record<string, any>, rules: InterviewMappingRule[]) {
        rules.forEach(rule => {
            const answerVal = answers[rule.fromAnswerId];
            if (!answerVal) return;

            // Find target block(s)
            // Strategy: Find first block of moduleType. 
            const block = data.blocks.find(b => b.type === rule.moduleType);
            if (!block) return;

            switch (rule.type) {
                case 'setField':
                    if (rule.field && block.payload.fields) {
                        // KeyValue block payload: fields: [{key, value}]
                        // We need to find the entry with key == field
                        const fieldEntry = block.payload.fields.find((f: any) => f.key.toLowerCase() === rule.field?.toLowerCase());
                        if (fieldEntry) {
                            fieldEntry.value = String(answerVal);
                        } else {
                            // Append if missing? Or ignore? Prompt implies 'set'.
                            // Let's append if key missing is safe for KeyValue blocks
                            block.payload.fields.push({ 
                                id: crypto.randomUUID(), 
                                key: rule.field, 
                                value: String(answerVal) 
                            });
                        }
                    }
                    break;

                case 'richTextFrom':
                    if (block.payload.doc) {
                        // Replace content with simple paragraph
                        // TipTap JSON structure
                        block.payload.doc = {
                            type: 'doc',
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: String(answerVal) }]
                            }]
                        };
                    }
                    break;

                case 'appendList':
                    if (rule.listField && block.payload[rule.listField] && Array.isArray(block.payload[rule.listField])) {
                        // Assume list of simple objects or strings?
                        // For 'abilities', payload is { abilities: [{ name, descriptionDoc... }] }
                        // For 'items', payload is { items: [{ name, qty... }] }
                        // The answerVal is likely comma separated string
                        const items = String(answerVal).split(',').map(s => s.trim()).filter(Boolean);
                        
                        items.forEach(itemStr => {
                            if (rule.moduleType === 'abilities') {
                                block.payload.abilities.push({ name: itemStr, descriptionDoc: { type: 'doc', content: [] } });
                            } else if (rule.moduleType === 'items') {
                                block.payload.items.push({ name: itemStr, qty: 1 });
                            }
                        });
                    }
                    break;
            }
        });
    }
}

export const characterCreationService = new CharacterCreationService();