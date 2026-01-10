
import { Workspace, GlossaryTerm, PendingTerm, GlossaryData } from "../types";
import { vaultService, noteContentToPlainText } from "./vaultService";
import { logNotification } from "./storageService";

const generateId = (): string => crypto.randomUUID();

export const glossaryService = {
    
    // --- Indexing & Lookup ---
    
    resolveTerm(workspace: Workspace, query: string): GlossaryTerm | null {
        const normalized = query.toLowerCase().trim();
        const terms = Object.values(workspace.glossary.terms);
        
        // Exact Match
        const exact = terms.find(t => t.term.toLowerCase() === normalized);
        if (exact) return exact;

        // Alias Match
        const alias = terms.find(t => t.aliases.some(a => a.toLowerCase() === normalized));
        if (alias) return alias;

        return null;
    },

    // --- CRUD ---

    createTerm(workspace: Workspace, termText: string, definition?: any, universeTags: string[] = []): GlossaryTerm {
        const id = generateId();
        const now = Date.now();
        const term: GlossaryTerm = {
            id,
            term: termText.trim(),
            aliases: [],
            definitionDoc: definition || { type: 'doc', content: [] },
            definition_plain: definition ? noteContentToPlainText({ content: definition }) : "",
            universeTags,
            isCanon: true,
            linksTo: [],
            sourceRefs: [],
            createdAt: now,
            updatedAt: now
        };

        workspace.glossary.terms[id] = term;
        vaultService.saveGlossaryTerm(term);
        return term;
    },

    updateTerm(workspace: Workspace, term: GlossaryTerm): void {
        term.updatedAt = Date.now();
        term.definition_plain = noteContentToPlainText({ content: term.definitionDoc });
        workspace.glossary.terms[term.id] = term;
        vaultService.saveGlossaryTerm(term);
    },

    deleteTerm(workspace: Workspace, termId: string): void {
        if (workspace.glossary.terms[termId]) {
            delete workspace.glossary.terms[termId];
            vaultService.deleteGlossaryTerm(termId);
        }
    },

    // --- Pending Workflow ---

    addPending(workspace: Workspace, termText: string, sourceNoteId?: string, tags?: string[]): void {
        const normalized = termText.trim().toLowerCase();
        
        // Check Exists
        if (this.resolveTerm(workspace, normalized)) return;
        
        // Check Ignored
        if (workspace.glossary.ignoreList?.includes(normalized)) return;

        // Check Already Pending
        if (workspace.glossary.pending.some(p => p.term.toLowerCase() === normalized)) return;

        const pending: PendingTerm = {
            id: generateId(),
            term: termText.trim(),
            sourceNoteId,
            detectedAt: Date.now(),
            tags
        };

        workspace.glossary.pending = [pending, ...workspace.glossary.pending];
        logNotification(workspace, 'info', `New glossary candidate: ${termText}`, sourceNoteId);
        vaultService.savePendingTerm(pending);
    },

    approvePending(workspace: Workspace, pendingId: string): GlossaryTerm | null {
        const index = workspace.glossary.pending.findIndex(p => p.id === pendingId);
        if (index === -1) return null;

        const pending = workspace.glossary.pending[index];
        workspace.glossary.pending.splice(index, 1);
        vaultService.deletePendingTerm(pendingId);

        // Create Real Term
        const term = this.createTerm(workspace, pending.term, undefined, pending.tags);
        
        return term;
    },

    ignorePending(workspace: Workspace, pendingId: string): void {
        const index = workspace.glossary.pending.findIndex(p => p.id === pendingId);
        if (index === -1) return;

        const pending = workspace.glossary.pending[index];
        workspace.glossary.pending.splice(index, 1);
        vaultService.deletePendingTerm(pendingId);
        
        if (!workspace.glossary.ignoreList) workspace.glossary.ignoreList = [];
        workspace.glossary.ignoreList.push(pending.term.toLowerCase());
        
        // Ignoring is a metadata update (glossary object level or settings), 
        // for now we don't strictly persist ignore list as separate file in new architecture
        // unless we add saveMetadataNow for glossary.json removal.
        // For now, let's just trigger workspace change save which handles index/meta.
        vaultService.onWorkspaceChange(workspace);
    }
};
