import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, StateEffect, StateField, Text } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  keymap
} from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, CompletionContext, Completion, startCompletion } from '@codemirror/autocomplete';

// Widget that renders markdown as HTML
class RenderedMarkdownWidget extends WidgetType {
  constructor(readonly html: string) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = this.html;
    wrapper.className = 'cm-rendered-markdown';
    return wrapper;
  }

  eq(other: RenderedMarkdownWidget) {
    return other.html === this.html;
  }
}

// Lucide icon SVGs (inline to avoid React component in vanilla DOM widget)
const ROCKET_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`;

const CHECK_CIRCLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;

// Widget for blog block opening === with rocket publish icon
class BlogBlockHeaderWidget extends WidgetType {
  constructor(
    readonly blockStartLine: number,
    readonly hasPublish: boolean,
    readonly isPublished: boolean
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-blog-block-header';
    wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 12px; line-height: 1;';

    const label = document.createElement('span');
    label.textContent = 'blog post';
    label.style.cssText = 'font-size: 1.75em; font-weight: 700; color: #3f0c8d; line-height: 1;';
    wrapper.appendChild(label);

    if (this.hasPublish) {
      const iconBtn = document.createElement('button');
      iconBtn.className = 'cm-blog-publish-btn';

      if (this.isPublished) {
        iconBtn.innerHTML = CHECK_CIRCLE_ICON_SVG;
        iconBtn.title = 'Published';
        iconBtn.style.cssText = 'background: none; border: none; cursor: default; padding: 4px; border-radius: 4px; display: flex; align-items: center; color: #16a34a;';
      } else {
        iconBtn.innerHTML = ROCKET_ICON_SVG;
        iconBtn.title = 'Publish this blog post';
        iconBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; transition: background-color 0.15s; display: flex; align-items: center; color: #3f0c8d;';
        iconBtn.onmouseenter = () => { iconBtn.style.backgroundColor = '#f0f0f0'; };
        iconBtn.onmouseleave = () => { iconBtn.style.backgroundColor = 'transparent'; };

        const blockLine = this.blockStartLine;
        iconBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Dispatch custom event with block line number
          window.dispatchEvent(new CustomEvent('blog-publish-click', {
            detail: { blockLine }
          }));
        };
      }
      wrapper.appendChild(iconBtn);
    }

    return wrapper;
  }

  eq(other: BlogBlockHeaderWidget) {
    return other.blockStartLine === this.blockStartLine &&
           other.hasPublish === this.hasPublish &&
           other.isPublished === this.isPublished;
  }
}

// Simple markdown to HTML converter for inline elements
function renderMarkdownLine(text: string, insideBlogBlock = false): { html: string; isBlock: boolean } {
  let html = text;
  let isBlock = false;

  // Headers
  const headerMatch = text.match(/^(#{1,6})\s+(.*)$/);
  if (headerMatch) {
    const level = headerMatch[1].length;
    const content = renderInlineMarkdown(headerMatch[2]);
    const styles: Record<number, string> = {
      1: 'font-size: 1.75em; font-weight: 700; line-height: 1.2;',
      2: 'font-size: 1.5em; font-weight: 700; line-height: 1.25;',
      3: 'font-size: 1.25em; font-weight: 600; line-height: 1.3;',
      4: 'font-size: 1.1em; font-weight: 600; line-height: 1.4;',
      5: 'font-size: 1em; font-weight: 600; line-height: 1.4;',
      6: 'font-size: 0.9em; font-weight: 600; line-height: 1.4;'
    };
    html = `<span style="${styles[level]}">${content}</span>`;
    isBlock = true;
    return { html, isBlock };
  }

  // Horizontal rule - but NOT inside blog blocks (where --- is frontmatter delimiter)
  if (!insideBlogBlock && /^(-{3,}|\*{3,}|_{3,})$/.test(text.trim())) {
    html = '<hr style="margin: 8px 0; border: none; border-top: 1px solid #d1d5db;" />';
    isBlock = true;
    return { html, isBlock };
  }

  // Blockquote
  if (text.startsWith('> ')) {
    const content = renderInlineMarkdown(text.slice(2));
    html = `<span style="border-left: 4px solid #9ca3af; padding-left: 12px; font-style: italic; color: #6b7280;">${content}</span>`;
    isBlock = true;
    return { html, isBlock };
  }

  // Unordered list item
  const ulMatch = text.match(/^(\s*)[-*+]\s+(.*)$/);
  if (ulMatch) {
    const indent = ulMatch[1].length;
    const content = renderInlineMarkdown(ulMatch[2]);
    const marginLeft = indent * 8;
    html = `<span style="margin-left: ${marginLeft}px"><span style="margin-right: 8px;">•</span>${content}</span>`;
    isBlock = true;
    return { html, isBlock };
  }

  // Ordered list item
  const olMatch = text.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (olMatch) {
    const indent = olMatch[1].length;
    const num = olMatch[2];
    const content = renderInlineMarkdown(olMatch[3]);
    const marginLeft = indent * 8;
    html = `<span style="margin-left: ${marginLeft}px"><span style="margin-right: 8px;">${num}.</span>${content}</span>`;
    isBlock = true;
    return { html, isBlock };
  }

  // Task list item
  const taskMatch = text.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
  if (taskMatch) {
    const indent = taskMatch[1].length;
    const checked = taskMatch[2].toLowerCase() === 'x';
    const content = renderInlineMarkdown(taskMatch[3]);
    const marginLeft = indent * 8;
    const checkbox = checked
      ? '<span style="margin-right: 8px;">☑</span>'
      : '<span style="margin-right: 8px;">☐</span>';
    html = `<span style="margin-left: ${marginLeft}px">${checkbox}${content}</span>`;
    isBlock = true;
    return { html, isBlock };
  }

  // Code block fence (just show as-is, we handle multi-line elsewhere)
  if (text.startsWith('```')) {
    return { html: text, isBlock: false };
  }

  // Regular paragraph with inline formatting
  html = renderInlineMarkdown(text);
  return { html, isBlock: false };
}

// Render inline markdown elements
function renderInlineMarkdown(text: string): string {
  let html = text;

  // Escape HTML first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Images: ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width: 100%; height: auto; display: inline;" />'
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color: #7c3aed; text-decoration: underline;">$1</a>'
  );

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/(?<![_\w])_([^_]+)_(?![_\w])/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del style="text-decoration: line-through;">$1</del>');

  // Inline code: `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background-color: #e5e7eb; padding: 0 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>'
  );

  // Tags: #tag-name - make them clickable
  html = html.replace(
    /(^|\s)(#[a-zA-Z0-9_-]+)/g,
    '$1<span class="cm-tag-link" data-tag="$2">$2</span>'
  );

  return html;
}

// Effect to update the active line
const setActiveLine = StateEffect.define<number>();

// State field to track the active line number
const activeLineField = StateField.define<number>({
  create() {
    return -1;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setActiveLine)) {
        return effect.value;
      }
    }
    // Update based on selection
    if (tr.selection) {
      const line = tr.state.doc.lineAt(tr.selection.main.head);
      return line.number;
    }
    return value;
  }
});

// Create decorations for rendered markdown
function createDecorations(
  view: EditorView,
  onPublish?: (blogId: string, content: string) => void,
  blogs?: Array<{ id: string; name: string }>
): DecorationSet {
  const activeLine = view.state.field(activeLineField);
  const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const doc = view.state.doc;

  let inCodeBlock = false;
  let inBlogBlock = false;
  let blogBlockStartLine = -1;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const lineText = line.text;

    // Track blog block state
    if (lineText.trim() === '===') {
      if (!inBlogBlock) {
        // Opening ===
        inBlogBlock = true;
        blogBlockStartLine = i;

        // Look ahead to check if published: true exists in the block
        let isPublished = false;
        for (let j = i + 1; j <= doc.lines; j++) {
          const checkLine = doc.line(j).text.trim();
          if (checkLine === '===') break; // End of block
          if (checkLine.match(/^published:\s*true/)) {
            isPublished = true;
            console.log(`[createDecorations] Found published:true at line ${j}, isPublished=${isPublished}`);
            break;
          }
        }
        console.log(`[createDecorations] Block at line ${i}, isPublished=${isPublished}`);

        // Skip decoration if this is the active line
        if (i !== activeLine) {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.replace({
              widget: new BlogBlockHeaderWidget(i, Boolean(onPublish), isPublished)
            })
          });
        }
      } else {
        // Closing ===
        inBlogBlock = false;
        blogBlockStartLine = -1;

        // Skip decoration if this is the active line
        if (i !== activeLine) {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.replace({
              widget: new RenderedMarkdownWidget(
                `<span style="color: #9ca3af; font-size: 0.85em;">═══</span>`
              )
            })
          });
        }
      }
      continue;
    }

    // Skip the active line - show raw markdown there
    if (i === activeLine) {
      // Check if this line starts/ends a code block
      if (lineText.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }
      continue;
    }

    // Track code block state
    if (lineText.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      // Show code fence as-is but styled
      if (lineText.length > 0) {
        const lang = lineText.slice(3);
        const label = lang ? `Code (${lang})` : 'Code';
        decorations.push({
          from: line.from,
          to: line.to,
          decoration: Decoration.replace({
            widget: new RenderedMarkdownWidget(
              `<span style="color: #9ca3af; font-size: 0.75em;">${label}</span>`
            )
          })
        });
      }
      continue;
    }

    // Inside code block - show with code styling
    if (inCodeBlock) {
      if (lineText.length > 0) {
        const escaped = lineText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        decorations.push({
          from: line.from,
          to: line.to,
          decoration: Decoration.replace({
            widget: new RenderedMarkdownWidget(
              `<code style="background-color: #f3f4f6; padding: 0 4px; font-family: monospace; font-size: 0.9em; display: block;">${escaped}</code>`
            )
          })
        });
      }
      continue;
    }

    // Empty lines - skip
    if (lineText.trim() === '') {
      continue;
    }

    // Render the line (pass blog block state to disable HR inside blog blocks)
    const { html } = renderMarkdownLine(lineText, inBlogBlock);
    if (html !== lineText) {
      decorations.push({
        from: line.from,
        to: line.to,
        decoration: Decoration.replace({
          widget: new RenderedMarkdownWidget(html)
        })
      });
    }
  }

  return Decoration.set(
    decorations.map(d => d.decoration.range(d.from, d.to)),
    true
  );
}

// Factory to create the live preview plugin with access to publish callback
function createLivePreviewPlugin(
  onPublish?: (blogId: string, content: string) => void,
  blogs?: Array<{ id: string; name: string }>
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      lastActiveLine: number = -1;

      constructor(view: EditorView) {
        this.decorations = createDecorations(view, onPublish, blogs);
        this.lastActiveLine = view.state.field(activeLineField);
      }

      update(update: ViewUpdate) {
        const currentActiveLine = update.state.field(activeLineField);
        const activeLineChanged = currentActiveLine !== this.lastActiveLine;
        this.lastActiveLine = currentActiveLine;

        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          activeLineChanged
        ) {
          this.decorations = createDecorations(update.view, onPublish, blogs);
        }
      }
    },
    {
      decorations: v => v.decorations
    }
  );
}

// Editor theme
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    height: '100%'
  },
  '.cm-content': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
    padding: '40px 24px 24px 48px',
    lineHeight: '1.75'
  },
  '.cm-line': {
    padding: '2px 0'
  },
  '.cm-cursor': {
    borderLeftColor: '#737373',
    borderLeftWidth: '2px'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(115, 115, 115, 0.3) !important'
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(115, 115, 115, 0.3) !important'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)'
  },
  '.cm-rendered-markdown': {
    display: 'inline'
  },
  '.cm-scroller': {
    overflow: 'auto'
  },
  '.cm-tag-link': {
    color: '#7c3aed',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    transition: 'text-decoration-color 0.15s'
  },
  '.cm-tag-link:hover': {
    textDecorationColor: '#7c3aed'
  }
});

interface LiveMarkdownEditorProps {
  initialContent: string;
  filePath: string;
  onSave: (content: string) => Promise<void>;
  onTagClick?: (tag: string, newTab: boolean) => void;
  blogs?: Array<{ id: string; name: string }>;
  onPublishBlogBlock?: (blogId: string, content: string) => Promise<boolean>;
}

// Helper to check if a position is inside a === blog block
function isInsideBlogBlock(doc: Text, pos: number): boolean {
  const line = doc.lineAt(pos);
  let openingFound = false;

  // Search backwards for opening ===
  for (let i = line.number; i >= 1; i--) {
    const lineText = doc.line(i).text.trim();
    if (lineText === '===') {
      if (openingFound) {
        // Found another === before, so we're outside
        return false;
      }
      openingFound = true;
    }
  }

  if (!openingFound) return false;

  // Search forwards for closing ===
  for (let i = line.number; i <= doc.lines; i++) {
    const lineText = doc.line(i).text.trim();
    if (lineText === '===' && i !== line.number) {
      return true; // Found closing, we're inside
    }
  }

  // No closing found, still consider inside (block not closed yet)
  return true;
}

// Helper to find the blog block boundaries
function findBlogBlockBoundaries(doc: Text, pos: number): { start: number; end: number } | null {
  const line = doc.lineAt(pos);
  let startLine = -1;
  let endLine = -1;

  // Search backwards for opening ===
  for (let i = line.number; i >= 1; i--) {
    const lineText = doc.line(i).text.trim();
    if (lineText === '===') {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) return null;

  // Search forwards for closing ===
  for (let i = line.number; i <= doc.lines; i++) {
    const lineText = doc.line(i).text.trim();
    if (lineText === '===' && i !== startLine) {
      endLine = i;
      break;
    }
  }

  if (endLine === -1) return null;

  return { start: startLine, end: endLine };
}

export const LiveMarkdownEditor: React.FC<LiveMarkdownEditorProps> = ({
  initialContent,
  filePath,
  onSave,
  onTagClick,
  blogs = [],
  onPublishBlogBlock
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(initialContent);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Store blogs in a ref for use in extensions
  const blogsRef = useRef(blogs);
  blogsRef.current = blogs;

  // Generate blog block template
  const getBlogBlockTemplate = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return `---
blog: ""
title: ""
description: ""
publishDate: "${today}"
tags: [""]
---
`;
  }, []);

  // Blog autocomplete source
  const blogCompletionSource = useCallback((context: CompletionContext) => {
    // Check if we're in a blog: "" field
    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text;

    // Match blog: "..." pattern - cursor should be between quotes
    const blogMatch = lineText.match(/^blog:\s*"([^"]*)"?/);
    if (!blogMatch) return null;

    // Find quote positions
    const firstQuoteIndex = lineText.indexOf('"');
    const lastQuoteIndex = lineText.lastIndexOf('"');
    const cursorInLine = context.pos - line.from;

    // Check if cursor is between the quotes
    if (cursorInLine <= firstQuoteIndex || (lastQuoteIndex > firstQuoteIndex && cursorInLine > lastQuoteIndex)) {
      return null;
    }

    // Only provide completions inside blog block
    if (!isInsideBlogBlock(context.state.doc, context.pos)) return null;

    const from = line.from + firstQuoteIndex + 1;
    const to = context.pos;

    const options: Completion[] = blogsRef.current.map(blog => ({
      label: blog.name,
      type: 'text',
      apply: blog.name,
      detail: 'blog'
    }));

    if (options.length === 0) {
      return null;
    }

    return {
      from,
      to,
      options,
      validFor: /^[^"]*$/
    };
  }, []);

  // Debounced save
  const scheduleSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      if (viewRef.current) {
        const content = viewRef.current.state.doc.toString();
        if (content !== contentRef.current) {
          contentRef.current = content;
          onSave(content);
        }
      }
    }, 2000);
  }, [onSave]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          if (viewRef.current) {
            const content = viewRef.current.state.doc.toString();
            if (content !== contentRef.current) {
              contentRef.current = content;
              onSave(content);
            }
          }
          return true;
        }
      }
    ]);

    // Tab key handler for smart navigation in frontmatter
    const tabKeymap = keymap.of([
      {
        key: 'Tab',
        run: (view) => {
          const pos = view.state.selection.main.head;
          const doc = view.state.doc;

          // Check if we're inside a blog block
          if (!isInsideBlogBlock(doc, pos)) {
            return false; // Let default Tab behavior happen
          }

          const line = doc.lineAt(pos);
          const lineText = line.text;

          // Determine which field we're in and where to jump
          const boundaries = findBlogBlockBoundaries(doc, pos);
          if (!boundaries) return false;

          // Find all frontmatter field lines
          let blogLine = -1, titleLine = -1, descLine = -1, tagsLine = -1, closingDashLine = -1;
          for (let i = boundaries.start + 1; i < boundaries.end; i++) {
            const text = doc.line(i).text;
            if (text.startsWith('blog:')) blogLine = i;
            else if (text.startsWith('title:')) titleLine = i;
            else if (text.startsWith('description:')) descLine = i;
            else if (text.startsWith('tags:')) tagsLine = i;
            else if (text.trim() === '---' && i > boundaries.start + 1) closingDashLine = i;
          }

          // Determine current field and next target
          let targetLine = -1;
          if (lineText.startsWith('blog:')) {
            targetLine = titleLine;
          } else if (lineText.startsWith('title:')) {
            targetLine = descLine;
          } else if (lineText.startsWith('description:')) {
            targetLine = tagsLine;
          } else if (lineText.startsWith('tags:')) {
            // Jump to line after closing ---
            if (closingDashLine !== -1 && closingDashLine + 1 <= doc.lines) {
              const afterClosing = doc.line(closingDashLine + 1);
              view.dispatch({
                selection: { anchor: afterClosing.from }
              });
              return true;
            }
            return false;
          }

          if (targetLine !== -1) {
            const targetLineObj = doc.line(targetLine);
            const targetText = targetLineObj.text;
            // Find position inside quotes
            const quoteStart = targetText.indexOf('"');
            const quoteEnd = targetText.lastIndexOf('"');
            if (quoteStart !== -1 && quoteEnd > quoteStart) {
              const cursorPos = targetLineObj.from + quoteStart + 1;
              view.dispatch({
                selection: { anchor: cursorPos }
              });
              return true;
            }
          }

          return false;
        }
      }
    ]);

    // Keymap to detect === + Enter and insert template
    const blogBlockKeymap = keymap.of([
      {
        key: 'Enter',
        run: (view) => {
          const pos = view.state.selection.main.head;
          const doc = view.state.doc;
          const line = doc.lineAt(pos);
          const lineText = line.text.trim();

          if (lineText === '===') {
            // Insert the blog block template
            const template = getBlogBlockTemplate();
            const insertPos = line.to;

            // Insert template + closing ===
            const fullInsert = '\n' + template + '===';

            // Calculate cursor position inside blog: ""
            // Template starts with ---\nblog: ""
            // We want cursor between the quotes
            const blogFieldOffset = template.indexOf('blog: "') + 7;

            view.dispatch({
              changes: { from: insertPos, to: insertPos, insert: fullInsert },
              selection: { anchor: insertPos + 1 + blogFieldOffset }
            });

            return true;
          }
          return false; // Let default Enter behavior happen
        }
      }
    ]);

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        scheduleSave();
      }
      // Update active line on selection change
      if (update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        update.view.dispatch({
          effects: setActiveLine.of(line.number)
        });

        // Auto-trigger completion when cursor enters blog field
        const lineText = line.text;
        if (lineText.match(/^blog:\s*"/) && isInsideBlogBlock(update.state.doc, pos)) {
          // Small delay to let the cursor settle
          setTimeout(() => {
            startCompletion(update.view);
          }, 50);
        }
      }
    });

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        activeLineField,
        history(),
        blogBlockKeymap,  // Must be before defaultKeymap to intercept Enter
        tabKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        markdown(),
        autocompletion({
          override: [blogCompletionSource],
          activateOnTyping: true,
          defaultKeymap: true
        }),
        createLivePreviewPlugin(onPublishBlogBlock, blogs),
        editorTheme,
        updateListener,
        EditorView.lineWrapping
      ]
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;
    contentRef.current = initialContent;

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      view.destroy();
    };
  }, [getBlogBlockTemplate, blogCompletionSource, onPublishBlogBlock, blogs]);

  // Update content when file changes
  useEffect(() => {
    if (viewRef.current && initialContent !== contentRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== initialContent) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: initialContent
          }
        });
        contentRef.current = initialContent;
      }
    }
  }, [initialContent, filePath]);

  // Listen for publish button clicks from widget
  useEffect(() => {
    const handlePublishClick = async (e: Event) => {
      const customEvent = e as CustomEvent<{ blockLine: number }>;
      const { blockLine } = customEvent.detail;

      if (!viewRef.current || !onPublishBlogBlock) {
        return;
      }

      const doc = viewRef.current.state.doc;

      // Find the blog block boundaries
      const line = doc.line(blockLine);
      const boundaries = findBlogBlockBoundaries(doc, line.from);
      if (!boundaries) {
        alert('Could not find blog block boundaries');
        return;
      }

      // Extract content from the block
      let blockContent = '';
      let blogName = '';
      let hasPublished = false;

      for (let j = boundaries.start + 1; j < boundaries.end; j++) {
        const blockLineText = doc.line(j).text;
        const blogMatch = blockLineText.match(/^blog:\s*"([^"]*)"/);
        if (blogMatch) {
          blogName = blogMatch[1];
        } else if (blockLineText.match(/^published:\s*true/)) {
          hasPublished = true;
        }

        // Only add non-blog, non-published lines to content
        if (!blogMatch && !blockLineText.match(/^published:/)) {
          blockContent += blockLineText + '\n';
        }
      }

      if (hasPublished) {
        alert('This post has already been published.');
        return;
      }

      if (!blogName) {
        alert('No blog specified in the blog block. Please fill in the blog field.');
        return;
      }

      // Find the blog by name
      const blog = blogsRef.current.find(b => b.name === blogName);
      if (!blog) {
        alert(`Blog "${blogName}" not found in settings. Please check your blog configuration.`);
        return;
      }

      // Publish!
      const success = await onPublishBlogBlock(blog.id, blockContent.trim());

      console.log('Publish result:', success);

      if (success && viewRef.current) {
        // Get fresh document reference after async operation
        const freshDoc = viewRef.current.state.doc;
        console.log('Fresh doc lines:', freshDoc.lines, 'blockLine:', blockLine);

        // Re-find the closing --- line in the fresh document
        const freshBoundaries = findBlogBlockBoundaries(freshDoc, freshDoc.line(blockLine).from);
        console.log('Fresh boundaries:', freshBoundaries);

        if (freshBoundaries) {
          let freshClosingDashLine = -1;
          let dashCount = 0;
          for (let j = freshBoundaries.start + 1; j < freshBoundaries.end; j++) {
            const lineText = freshDoc.line(j).text.trim();
            if (lineText === '---') {
              dashCount++;
              console.log(`Found --- #${dashCount} at line ${j}`);
              if (dashCount === 2) {
                freshClosingDashLine = j;
                break;
              }
            }
          }

          console.log('Closing dash line:', freshClosingDashLine);

          if (freshClosingDashLine !== -1) {
            // Insert published: true before the closing ---
            const closingLine = freshDoc.line(freshClosingDashLine);
            const insertPos = closingLine.from;
            const insertText = 'published: true\n';

            console.log('Inserting "published: true" at position:', insertPos);
            viewRef.current.dispatch({
              changes: { from: insertPos, to: insertPos, insert: insertText }
            });
            console.log('Dispatch complete, new doc:', viewRef.current.state.doc.toString().substring(0, 500));

            // Force decoration refresh by toggling active line
            setTimeout(() => {
              if (viewRef.current) {
                // Set to -1 then back to current to force refresh
                viewRef.current.dispatch({
                  effects: setActiveLine.of(-1)
                });
                setTimeout(() => {
                  if (viewRef.current) {
                    const currentLine = viewRef.current.state.doc.lineAt(
                      viewRef.current.state.selection.main.head
                    ).number;
                    viewRef.current.dispatch({
                      effects: setActiveLine.of(currentLine)
                    });
                  }
                }, 10);
              }
            }, 50);

            // Trigger save
            scheduleSave();
          } else {
            console.log('ERROR: Could not find closing --- line');
          }
        } else {
          console.log('ERROR: Could not find block boundaries');
        }
      }
    };

    window.addEventListener('blog-publish-click', handlePublishClick);
    return () => {
      window.removeEventListener('blog-publish-click', handlePublishClick);
    };
  }, [onPublishBlogBlock, scheduleSave]);

  // Handle clicks on tags
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle tag clicks
    if (target.classList.contains('cm-tag-link')) {
      e.preventDefault();
      e.stopPropagation();
      const tag = target.dataset.tag;
      if (tag && onTagClick) {
        // metaKey is Cmd on Mac, ctrlKey on Windows/Linux
        const newTab = e.metaKey || e.ctrlKey;
        onTagClick(tag, newTab);
      }
    }
  }, [onTagClick]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ backgroundColor: '#ffffff' }}
      onClick={handleClick}
    />
  );
};
