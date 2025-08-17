import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface FileData {
  path?: string;
  content: string;
  language: string;
  isModified: boolean;
}

interface ElectronAPI {
  onMenuNewFile: (callback: () => void) => void;
  onMenuOpenFile: (callback: (event: any, data: { path: string; content: string }) => void) => void;
  onMenuSaveFile: (callback: () => void) => void;
  onMenuSaveAsFile: (callback: () => void) => void;
  saveFile: (data: { path?: string; content: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

function App() {
  const [currentFile, setCurrentFile] = useState<FileData>({
    content: '// Welcome to Text Editor\n// Start typing or open a file to begin...',
    language: 'javascript',
    isModified: false
  });
  
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const editorRef = useRef<any>(null);

  const getLanguageFromPath = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'sql': 'sql',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sh': 'shell',
      'bash': 'shell',
      'yml': 'yaml',
      'yaml': 'yaml',
      'txt': 'plaintext'
    };
    return languageMap[extension || ''] || 'plaintext';
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCurrentFile(prev => ({
        ...prev,
        content: value,
        isModified: true
      }));
    }
  };

  const handleNewFile = () => {
    setCurrentFile({
      content: '',
      language: 'plaintext',
      isModified: false
    });
  };

  const handleOpenFile = (event: any, data: { path: string; content: string }) => {
    const language = getLanguageFromPath(data.path);
    setCurrentFile({
      path: data.path,
      content: data.content,
      language,
      isModified: false
    });
  };

  const handleSaveFile = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile({
        path: currentFile.path,
        content: currentFile.content
      });
      
      if (result.success) {
        setCurrentFile(prev => ({
          ...prev,
          path: result.path,
          isModified: false
        }));
      }
    }
  };

  const handleSaveAsFile = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile({
        content: currentFile.content
      });
      
      if (result.success) {
        const language = getLanguageFromPath(result.path || '');
        setCurrentFile(prev => ({
          ...prev,
          path: result.path,
          language,
          isModified: false
        }));
      }
    }
  };

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMenuNewFile(handleNewFile);
      window.electronAPI.onMenuOpenFile(handleOpenFile);
      window.electronAPI.onMenuSaveFile(handleSaveFile);
      window.electronAPI.onMenuSaveAsFile(handleSaveAsFile);

      return () => {
        window.electronAPI?.removeAllListeners('menu-new-file');
        window.electronAPI?.removeAllListeners('menu-open-file');
        window.electronAPI?.removeAllListeners('menu-save-file');
        window.electronAPI?.removeAllListeners('menu-save-as-file');
      };
    }
  }, [currentFile.path, currentFile.content]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.focus();
  };

  const getFileName = () => {
    if (currentFile.path) {
      return currentFile.path.split('/').pop() || 'Untitled';
    }
    return 'Untitled';
  };

  const getLanguageDisplayName = (lang: string) => {
    const displayNames: { [key: string]: string } = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'xml': 'XML',
      'markdown': 'Markdown',
      'sql': 'SQL',
      'php': 'PHP',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'shell': 'Shell',
      'yaml': 'YAML',
      'plaintext': 'Plain Text'
    };
    return displayNames[lang] || lang.toUpperCase();
  };

  return (
    <div className="editor-container">
      <div className="toolbar">
        <button onClick={handleNewFile}>
          New File
        </button>
        <button onClick={handleSaveFile} disabled={!currentFile.isModified}>
          Save
        </button>
        <button onClick={handleSaveAsFile}>
          Save As
        </button>
        <button 
          onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
        >
          {editorTheme === 'vs-dark' ? 'Light Theme' : 'Dark Theme'}
        </button>
        <div className="file-info">
          {getFileName()}{currentFile.isModified ? ' •' : ''}
        </div>
      </div>
      
      <Editor
        height="calc(100vh - 64px)"
        language={currentFile.language}
        value={currentFile.content}
        theme={editorTheme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          minimap: { enabled: true },
          wordWrap: 'on',
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          unfoldOnClickAfterEndOfLine: false,
          contextmenu: true,
          mouseWheelZoom: true,
          multiCursorModifier: 'ctrlCmd',
          accessibilitySupport: 'auto',
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always'
          }
        }}
      />
      
      <div className="status-bar">
        <span>
          {getLanguageDisplayName(currentFile.language)}
        </span>
        <span>
          {currentFile.path || 'Untitled'}
        </span>
      </div>
    </div>
  );
}

export default App;
