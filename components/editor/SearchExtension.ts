import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface SearchOptions {
  searchTerm: string;
  results: { from: number; to: number }[];
  index: number;
}

export const SearchExtension = Extension.create<SearchOptions>({
  name: 'search',

  addOptions() {
    return {
      searchTerm: '',
      results: [],
      index: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ state, dispatch }) => {
        if (dispatch) {
          const tr = state.tr.setMeta('search', { searchTerm });
          dispatch(tr);
        }
        return true;
      },
      clearSearch: () => ({ state, dispatch }) => {
        if (dispatch) {
          dispatch(state.tr.setMeta('search', { searchTerm: '' }));
        }
        return true;
      },
      findNext: () => ({ state, dispatch }) => {
        const pluginState = SearchPluginKey.getState(state);
        if (!pluginState || !pluginState.results.length) return false;

        const nextIndex = (pluginState.index + 1) % pluginState.results.length;
        
        if (dispatch) {
            const tr = state.tr.setMeta('search', { index: nextIndex });
            const result = pluginState.results[nextIndex];
            
            // Move selection and scroll
            if (result && result.from <= state.doc.content.size) {
                tr.setSelection(TextSelection.near(state.doc.resolve(result.from)));
                tr.scrollIntoView();
            }
            dispatch(tr);
        }
        return true;
      },
      findPrevious: () => ({ state, dispatch }) => {
        const pluginState = SearchPluginKey.getState(state);
        if (!pluginState || !pluginState.results.length) return false;

        const prevIndex = (pluginState.index - 1 + pluginState.results.length) % pluginState.results.length;

        if (dispatch) {
            const tr = state.tr.setMeta('search', { index: prevIndex });
            const result = pluginState.results[prevIndex];
            
            if (result && result.from <= state.doc.content.size) {
                tr.setSelection(TextSelection.near(state.doc.resolve(result.from)));
                tr.scrollIntoView();
            }
            dispatch(tr);
        }
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: SearchPluginKey,
        state: {
          init() {
            return { searchTerm: '', results: [], index: 0, decorations: DecorationSet.empty };
          },
          apply(tr, oldState) {
            const meta = tr.getMeta('search');
            let { searchTerm, results, index } = oldState;
            let docChanged = tr.docChanged;

            // Update search term
            if (meta && 'searchTerm' in meta) {
              searchTerm = meta.searchTerm;
              index = 0; // Reset index on new search
              docChanged = true; // Force re-scan
            }

            // Update index navigation
            if (meta && 'index' in meta) {
                index = meta.index;
            }

            // If doc changed or search term changed, re-scan
            if (docChanged) {
              if (!searchTerm) {
                results = [];
                index = 0;
              } else {
                results = [];
                const regex = new RegExp(escapeRegExp(searchTerm), 'gi'); // Case-insensitive
                tr.doc.descendants((node, pos) => {
                  if (node.isText) {
                    const text = node.text || '';
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        results.push({
                            from: pos + match.index,
                            to: pos + match.index + match[0].length
                        });
                    }
                  }
                });
              }
            }

            // Build decorations
            const decos: Decoration[] = results.map((r: any, i: number) => {
                const className = i === index ? 'search-result-current' : 'search-result';
                return Decoration.inline(r.from, r.to, { class: className });
            });

            return {
                searchTerm,
                results,
                index: (results.length > 0 && index >= results.length) ? 0 : index, // Safety clamp
                decorations: DecorationSet.create(tr.doc, decos)
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations;
          },
        },
      }),
    ];
  },
});

export const SearchPluginKey = new PluginKey('search');

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}