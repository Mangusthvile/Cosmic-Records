// --- Wiki Link Parser & Utilities ---

export type Token = 
    | { kind: 'text', value: string }
    | { kind: 'link', title: string, display?: string, raw: string };

/**
 * Parses content into tokens of Text or Link.
 * Supports [[Title]] and [[Title]](Display)
 */
export const parseWikiLinks = (text: string): Token[] => {
    // Regex matches [[Title]] optionally followed by (Display)
    // Group 1: Title
    // Group 2: Display Text (optional)
    const regex = /\[\[(.*?)\]\](?:\((.*?)\))?/g;
    let lastIndex = 0;
    const tokens: Token[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before link
        if (match.index > lastIndex) {
            tokens.push({ kind: 'text', value: text.substring(lastIndex, match.index) });
        }

        const raw = match[0];
        const title = match[1]; 
        const display = match[2]; 

        tokens.push({ 
            kind: 'link', 
            title: title.trim(), 
            display: display ? display.trim() : undefined,
            raw 
        });

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        tokens.push({ kind: 'text', value: text.substring(lastIndex) });
    }

    return tokens;
};

/**
 * Safely rewrites links in content when a target note title changes.
 * Preserves display text and surrounding content exactly.
 */
export const rewriteLinks = (content: string, oldTitle: string, newTitle: string): string => {
    const tokens = parseWikiLinks(content);
    return tokens.map(t => {
        if (t.kind === 'text') return t.value;
        if (t.kind === 'link' && t.title === oldTitle) {
            // Rewrite
            if (t.display) return `[[${newTitle}]](${t.display})`;
            return `[[${newTitle}]]`;
        }
        return t.raw;
    }).join('');
};

/**
 * Extracts all unique link titles from content.
 */
export const extractLinkTitles = (content: string): string[] => {
    const tokens = parseWikiLinks(content);
    const titles = new Set<string>();
    tokens.forEach(t => {
        if (t.kind === 'link') titles.add(t.title);
    });
    return Array.from(titles);
};
