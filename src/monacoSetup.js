import { loader } from '@monaco-editor/react';
import 'monaco-editor/esm/vs/editor/editor.all.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker&inline';

self.MonacoEnvironment = {
  getWorker() { return new EditorWorker(); },
};

if (!monaco.languages.getLanguages().some((l) => l.id === 'json')) {
  monaco.languages.register({ id: 'json', extensions: ['.json'], aliases: ['JSON'] });
  monaco.languages.setLanguageConfiguration('json', {
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '"', close: '"' }],
  });
  monaco.languages.setMonarchTokensProvider('json', {
    tokenizer: {
      root: [
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'type'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/\b(true|false|null)\b/, 'keyword'],
        [/[{}[\],:]/, 'delimiter'],
      ],
    },
  });
}

monaco.editor.defineTheme('tgb-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7c3aed' },
    { token: 'string', foreground: '0f8a5f' },
    { token: 'string.escape', foreground: '0f766e' },
    { token: 'number', foreground: 'c2410c' },
    { token: 'type', foreground: '0a6cff' },
    { token: 'tag', foreground: 'be185d' },
    { token: 'delimiter', foreground: '64748b' },
    { token: 'identifier', foreground: '0f172a' },
  ],
  colors: {
    'editor.background': '#00000000',
    'editor.foreground': '#0f172a',
    'editorLineNumber.foreground': '#b6c0cf',
    'editorLineNumber.activeForeground': '#475569',
    'editor.lineHighlightBackground': '#0f172a08',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#0a6cff2e',
    'editor.inactiveSelectionBackground': '#0a6cff18',
    'editorCursor.foreground': '#0a6cff',
    'editorIndentGuide.background1': '#0f172a12',
    'editorIndentGuide.activeBackground1': '#0f172a30',
    'editorWidget.background': '#fbfcfe',
    'editorWidget.border': '#0f172a1a',
    'editorSuggestWidget.background': '#fbfcfe',
    'editorSuggestWidget.selectedBackground': '#0a6cff1a',
    'editorHoverWidget.background': '#fbfcfe',
    'scrollbarSlider.background': '#0f172a1f',
    'scrollbarSlider.hoverBackground': '#0f172a33',
    'scrollbarSlider.activeBackground': '#0f172a40',
    'editorGutter.background': '#00000000',
    'minimap.background': '#00000000',
  },
});

monaco.editor.defineTheme('tgb-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7a90', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c4a5ff' },
    { token: 'string', foreground: '7ee2b0' },
    { token: 'string.escape', foreground: '5eead4' },
    { token: 'number', foreground: 'fdba74' },
    { token: 'type', foreground: '7cb6ff' },
    { token: 'tag', foreground: 'f9a8d4' },
    { token: 'delimiter', foreground: '94a3b8' },
    { token: 'identifier', foreground: 'e6ebf2' },
  ],
  colors: {
    'editor.background': '#00000000',
    'editor.foreground': '#e6ebf2',
    'editorLineNumber.foreground': '#4b586b',
    'editorLineNumber.activeForeground': '#a3b0c2',
    'editor.lineHighlightBackground': '#ffffff08',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#3d8bff40',
    'editor.inactiveSelectionBackground': '#3d8bff22',
    'editorCursor.foreground': '#5b9dff',
    'editorIndentGuide.background1': '#ffffff10',
    'editorIndentGuide.activeBackground1': '#ffffff2a',
    'editorWidget.background': '#1b2130',
    'editorWidget.border': '#ffffff1a',
    'editorSuggestWidget.background': '#1b2130',
    'editorSuggestWidget.selectedBackground': '#3d8bff30',
    'editorHoverWidget.background': '#1b2130',
    'scrollbarSlider.background': '#ffffff1a',
    'scrollbarSlider.hoverBackground': '#ffffff2a',
    'scrollbarSlider.activeBackground': '#ffffff38',
    'editorGutter.background': '#00000000',
    'minimap.background': '#00000000',
  },
});

loader.config({ monaco });

export const monacoTheme = (isDark) => (isDark ? 'tgb-dark' : 'tgb-light');
export default monaco;
