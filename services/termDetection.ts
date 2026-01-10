
// Deterministic Term Extraction Service

const STOPWORDS = new Set([
    'the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 'into', 'time', 'has', 'look', 'two', 'more', 'write', 'go', 'see', 'number', 'no', 'way', 'could', 'people', 'my', 'than', 'first', 'water', 'been', 'call', 'who', 'oil', 'its', 'now', 'find'
]);

// Duplicate of storageService normalizeKey to avoid circular dependency
const normalize = (str: string): string => {
    return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '');
};

const isValidCandidate = (text: string): boolean => {
    if (text.length < 3) return false;
    const norm = normalize(text);
    if (!norm || norm.length < 3) return false;
    if (/^\d+$/.test(norm)) return false; // purely numeric
    if (STOPWORDS.has(norm)) return false; // single stopword
    return true;
};

export interface DetectedTerm {
    term: string;
    context: string;
    rule: string;
}

export const extractCandidateTerms = (text: string): DetectedTerm[] => {
    const candidates: Map<string, DetectedTerm> = new Map();
    const normalizedMap = new Set<string>();

    const addCandidate = (term: string, index: number, rule: string) => {
        const cleaned = term.trim().replace(/^['"(\[]+|['")\]]+$/g, ''); // Trim quotes/brackets
        if (!isValidCandidate(cleaned)) return;
        
        const norm = normalize(cleaned);
        if (normalizedMap.has(norm)) return; // Dedupe in this run

        const start = Math.max(0, index - 40);
        const end = Math.min(text.length, index + term.length + 40);
        const context = "..." + text.substring(start, end).replace(/\n/g, ' ') + "...";

        candidates.set(norm, { term: cleaned, context, rule });
        normalizedMap.add(norm);
    };

    // 1. Capitalized Phrases (2-5 words)
    // Matches sequences of capitalized words.
    // e.g. "The Dark Tower", "Agent 47"
    // Removed unsupported possessive quantifier (*+)
    const capPhraseRegex = /\b[A-Z][a-zA-Z0-9'-]*(?:\s+[A-Z][a-zA-Z0-9'-]*){1,4}\b/g;
    let match;
    while ((match = capPhraseRegex.exec(text)) !== null) {
        addCandidate(match[0], match.index, 'capitalized');
    }

    // 2. Bracketed/Quoted (short)
    // "Term" or [Term] or 'Term'
    const quoteRegex = /(?:"|'|\[)([a-zA-Z0-9\s-]{3,30})(?:"|'|\])/g;
    while ((match = quoteRegex.exec(text)) !== null) {
        // Exclude things that look like sentences (contain dot)
        if (!match[1].includes('.')) {
             addCandidate(match[1], match.index, 'bracketed');
        }
    }

    // 3. Repeated Rare Words (Simple check: Capitalized single words appearing > 2 times)
    // This is more expensive to track frequency, skipping for MVP deterministic pass 
    // to keep save fast. Capitalized phrases cover most "Proper Noun" cases.

    return Array.from(candidates.values());
};

// Milestone 5 Step 7: Occurrence Scanning
export const scanTextForGlossaryTerms = (text: string, lookup: Record<string, string>): Map<string, string[]> => {
    // Result: TermId -> Array of Snippets
    const results = new Map<string, string[]>();
    if (!text || !lookup) return results;

    // Tokenize roughly by words (preserving whitespace for reconstruction isn't strictly necessary for n-grams, but indices help)
    // We'll use a regex to find word starts
    const wordRegex = /[\w-']+/g;
    const words: { text: string, index: number, end: number }[] = [];
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
        words.push({ text: match[0], index: match.index, end: match.index + match[0].length });
    }

    // Limit scanning to avoid freezing large docs
    const MAX_CHECKS = 20000; 
    let checks = 0;

    // Greedy strategy: Match longest possible phrase starting at 'i'
    // If match found, skip 'i' to end of match to avoid overlapping sub-matches (e.g. "Space Marine" vs "Space")
    
    let i = 0;
    while (i < words.length) {
        let longestMatch: { termId: string, length: number } | null = null;
        
        // Try phrases length 5 down to 1
        for (let len = 5; len >= 1; len--) {
            if (i + len > words.length) continue;
            
            checks++;
            if (checks > MAX_CHECKS) break;

            // Construct phrase from words[i] to words[i+len-1]
            // We need the raw text to ensure normalization works correctly
            const startWord = words[i];
            const endWord = words[i + len - 1];
            const rawPhrase = text.substring(startWord.index, endWord.end);
            const key = normalize(rawPhrase);

            if (lookup[key]) {
                longestMatch = { termId: lookup[key], length: len };
                break; // Found longest for this start position
            }
        }

        if (longestMatch) {
            const { termId, length } = longestMatch;
            const startIdx = words[i].index;
            const endIdx = words[i + length - 1].end;
            
            // Extract snippet
            const snipStart = Math.max(0, startIdx - 60);
            const snipEnd = Math.min(text.length, endIdx + 60);
            let snippet = text.substring(snipStart, snipEnd).replace(/\s+/g, ' ').trim();
            if (snipStart > 0) snippet = '...' + snippet;
            if (snipEnd < text.length) snippet = snippet + '...';

            if (!results.has(termId)) {
                results.set(termId, []);
            }
            const currentSnippets = results.get(termId)!;
            // Limit snippets per term per note
            if (currentSnippets.length < 3) {
                currentSnippets.push(snippet);
            }

            // Advance past this phrase
            i += length;
        } else {
            i++;
        }

        if (checks > MAX_CHECKS) break;
    }

    return results;
};
