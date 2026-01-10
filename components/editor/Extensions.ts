
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import React from 'react';
import katex from 'katex';

// --- HEADING ID EXTENSION ---
export const HeadingId = Extension.create({
  name: 'headingId',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('id'),
            renderHTML: attributes => {
              if (!attributes.id) return {};
              return { id: attributes.id };
            },
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingId'),
        appendTransaction: (transactions, oldState, newState) => {
          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && !node.attrs.id) {
              const id = crypto.randomUUID();
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
              modified = true;
            }
          });

          if (modified) {
            return tr;
          }
          return null;
        },
      }),
    ];
  },
});

// --- MATH BLOCK EXTENSION ---
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math' })];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.classList.add('math-block');
      
      let currentNode = node;

      const render = () => {
        dom.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.padding = '8px';
        wrapper.style.cursor = 'pointer';
        
        try {
          katex.render(currentNode.attrs.latex, wrapper, { throwOnError: false, displayMode: true });
        } catch (e) {
          wrapper.innerText = "Invalid LaTeX";
        }
        
        dom.appendChild(wrapper);
      };

      dom.addEventListener('click', () => {
        const latex = prompt('Enter LaTeX:', currentNode.attrs.latex);
        if (latex !== null) {
            if (typeof getPos === 'function') {
                editor.view.dispatch(
                    editor.view.state.tr.setNodeMarkup(getPos(), undefined, { latex })
                );
            }
        }
      });

      render();

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'mathBlock') return false;
          currentNode = updatedNode;
          render();
          return true;
        },
      };
    };
  },
});

// --- TOGGLE EXTENSIONS (Details/Summary) ---

export const CollapsibleBlock = Node.create({
    name: 'collapsibleBlock',
    group: 'block',
    content: 'collapsibleSummary collapsibleContent',
    draggable: true,

    addAttributes() {
        return {
            open: {
                default: true,
                parseHTML: element => element.hasAttribute('open'),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'details.collapsible-block' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['details', mergeAttributes(HTMLAttributes, { class: 'collapsible-block' }), 0];
    },
});

export const CollapsibleSummary = Node.create({
    name: 'collapsibleSummary',
    group: 'block',
    content: 'inline*', // allows text
    parseHTML() {
        return [{ tag: 'summary' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['summary', HTMLAttributes, 0];
    },
});

export const CollapsibleContent = Node.create({
    name: 'collapsibleContent',
    group: 'block',
    content: 'block+', // nested blocks
    parseHTML() {
        return [{ tag: 'div.collapsible-content' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'collapsible-content' }), 0];
    },
});

export { GlossaryLink } from './GlossaryLink';
