'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, placeholder as cmPlaceholder } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

const cyberTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0d0d14',
    color: '#c8d3f5',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#00f0ff',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#00f0ff',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#1a3a4a',
  },
  '.cm-gutters': {
    backgroundColor: '#08080e',
    color: '#3a3f5c',
    border: 'none',
    borderRight: '1px solid #1a1a2e',
    minWidth: '48px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#0f0f1a',
    color: '#00f0ff',
  },
  '.cm-activeLine': {
    backgroundColor: '#0a0f1a',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#1a3a4a',
    color: '#00f0ff',
    outline: '1px solid #00f0ff44',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-placeholder': {
    color: '#3a3f5c',
    fontStyle: 'italic',
  },
}, { dark: true });

const cyberHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.variableName, color: '#c8d3f5' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.definition(tags.variableName), color: '#e5c07b' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.null, color: '#d19a66' },
  { tag: tags.comment, color: '#3a3f5c', fontStyle: 'italic' },
  { tag: tags.propertyName, color: '#e06c75' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.paren, color: '#abb2bf' },
  { tag: tags.brace, color: '#abb2bf' },
  { tag: tags.bracket, color: '#abb2bf' },
  { tag: tags.punctuation, color: '#abb2bf' },
  { tag: tags.regexp, color: '#e06c75' },
  { tag: tags.tagName, color: '#e06c75' },
  { tag: tags.attributeName, color: '#d19a66' },
]);

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export default function CodeEditor({ value, onChange, readOnly = false, placeholder }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track whether changes are programmatic
  const isProgrammatic = useRef(false);

  const createEditor = useCallback(() => {
    if (!editorRef.current) return;

    // Clean up existing view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = [
      cyberTheme,
      syntaxHighlighting(cyberHighlight),
      javascript(),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      highlightSelectionMatches(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.lineWrapping,
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    if (!readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isProgrammatic.current) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        })
      );
    }

    if (placeholder) {
      extensions.push(cmPlaceholder(placeholder));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });
  }, [readOnly, placeholder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial setup
  useEffect(() => {
    createEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [createEditor]);

  // Update value when it changes from outside
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      isProgrammatic.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
      isProgrammatic.current = false;
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-hidden"
      style={{ minHeight: 0 }}
    />
  );
}
