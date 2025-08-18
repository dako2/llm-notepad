import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Editor from "@monaco-editor/react";
import "./App.css";

interface FileTab {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
  path?: string;
}

interface LLMState {
  isProcessing: boolean;
  mode: 'edit' | 'append' | 'respond';
  lastRequestTime?: number;
  processingText?: string;
  isStreaming?: boolean;
  streamBuffer?: string;
  streamRequestId?: string;
}

interface StreamingMessage {
  type: 'llm_start' | 'llm_delta' | 'llm_done';
  id: string;
  delta?: string;
}

function App() {
  const [tabs, setTabs] = useState<FileTab[]>([
    {
      id: "1",
      name: "Untitled-1",
      content: "// Welcome to LLM Notepad\n// A powerful text editor built with Tauri + Monaco\n\nfunction hello() {\n  console.log('Hello, World!');\n}",
      isDirty: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [llmState, setLLMState] = useState<LLMState>({
    isProcessing: false,
    mode: 'edit',
    isStreaming: false,
    streamBuffer: '',
    streamRequestId: ''
  });
  
  const [ghostText, setGhostText] = useState<string>("");
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value || !activeTabId) return;
    
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, content: value, isDirty: true }
          : tab
      )
    );
  }, [activeTabId]);

  const createNewTab = useCallback(() => {
    const newId = Date.now().toString();
    const newTab: FileTab = {
      id: newId,
      name: `Untitled-${tabs.length + 1}`,
      content: "",
      isDirty: false,
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newId);
  }, [tabs.length]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      if (newTabs.length === 0) {
        const newTab: FileTab = {
          id: Date.now().toString(),
          name: "Untitled-1",
          content: "",
          isDirty: false,
        };
        setActiveTabId(newTab.id);
        return [newTab];
      }
      
      if (tabId === activeTabId) {
        setActiveTabId(newTabs[0].id);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const openFile = useCallback(async () => {
    try {
      const result = await invoke<{ path: string; content: string }>("open_file");
      if (result) {
        const fileName = result.path.split(/[/\\]/).pop() || "Unknown";
        const newTab: FileTab = {
          id: Date.now().toString(),
          name: fileName,
          content: result.content,
          isDirty: false,
          path: result.path,
        };
        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(newTab.id);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!activeTab) return;
    
    try {
      if (activeTab.path) {
        await invoke("save_file", { path: activeTab.path, content: activeTab.content });
      } else {
        const path = await invoke<string>("save_file_as", { content: activeTab.content });
        if (path) {
          const fileName = path.split(/[/\\]/).pop() || "Unknown";
          setTabs(prevTabs =>
            prevTabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, name: fileName, path, isDirty: false }
                : tab
            )
          );
          return;
        }
      }
      
      setTabs(prevTabs =>
        prevTabs.map(tab =>
          tab.id === activeTabId
            ? { ...tab, isDirty: false }
            : tab
        )
      );
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [activeTab, activeTabId]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  }, []);

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL, () => {
      console.log('LLM shortcut triggered (Ctrl+Shift+L)');
      sendToLLM();
    });
  }, []);
  
  const updateGhostText = useCallback((text: string, position: any) => {
    if (monacoRef.current && editorRef.current && text) {
      const model = editorRef.current.getModel();
      if (model && position) {
        const decorations = editorRef.current.deltaDecorations([], [{
          range: new monacoRef.current.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            afterContentClassName: 'ghost-text-decoration',
            after: {
              content: text,
              inlineClassName: 'ghost-text-inline'
            }
          }
        }]);
        
        return decorations;
      }
    }
    return [];
  }, []);
  
  const clearGhostText = useCallback((decorations: string[]) => {
    if (editorRef.current && decorations.length > 0) {
      editorRef.current.deltaDecorations(decorations, []);
    }
  }, []);
  
  useEffect(() => {
    const unlisten = listen('streaming_message', (event: any) => {
      const message = event.payload as StreamingMessage;
      
      if (message.type === 'llm_start') {
        setIsStreamingActive(true);
        setGhostText("");
        setLLMState(prev => ({
          ...prev,
          isStreaming: true,
          streamBuffer: '',
          streamRequestId: message.id
        }));
      } else if (message.type === 'llm_delta' && message.delta) {
        const newBuffer = (llmState.streamBuffer || '') + message.delta;
        setGhostText(newBuffer);
        setLLMState(prev => ({
          ...prev,
          streamBuffer: newBuffer
        }));
        
        if (editorRef.current) {
          const position = editorRef.current.getPosition();
          updateGhostText(newBuffer, position);
        }
      } else if (message.type === 'llm_done') {
        setIsStreamingActive(false);
        
        if (editorRef.current && llmState.streamBuffer) {
          const editor = editorRef.current;
          const position = editor.getPosition();
          const model = editor.getModel();
          
          if (model && position) {
            const range = new monacoRef.current.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            );
            
            const operation = {
              range: range,
              text: llmState.streamBuffer,
              forceMoveMarkers: true
            };
            
            model.pushEditOperations([], [operation], () => null);
            
            const newPosition = new monacoRef.current.Position(
              position.lineNumber,
              position.column + llmState.streamBuffer.length
            );
            editor.setPosition(newPosition);
          }
        }
        
        setGhostText("");
        setLLMState(prev => ({
          ...prev,
          isProcessing: false,
          isStreaming: false,
          streamBuffer: '',
          streamRequestId: ''
        }));
        
        if (activeTabId) {
          setTabs(prevTabs => 
            prevTabs.map(tab => 
              tab.id === activeTabId 
                ? { ...tab, content: editorRef.current.getValue(), isDirty: true }
                : tab
            )
          );
        }
      }
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [activeTabId, llmState.streamBuffer, updateGhostText]);
  
  const sendToLLMStreaming = useCallback(async () => {
    if (!editorRef.current || !activeTab || llmState.isProcessing || llmState.isStreaming) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    
    const selection = editor.getSelection();
    const position = editor.getPosition();
    
    let content = '';
    let cursorPosition = 0;
    
    if (selection && !selection.isEmpty()) {
      content = model.getValueInRange(selection);
      cursorPosition = model.getOffsetAt(selection.getStartPosition());
    } else {
      content = model.getValue();
      cursorPosition = model.getOffsetAt(position);
    }
    
    if (!content.trim()) return;
    
    setLLMState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const instruction = llmState.mode === 'edit' ? 'polish and improve' :
                         llmState.mode === 'append' ? 'continue writing' :
                         'analyze and respond to';
      
      await invoke('stream_to_llm', {
        request: {
          content,
          mode: llmState.mode,
          cursor_position: cursorPosition,
          instruction
        }
      });
    } catch (error) {
      console.error('Streaming LLM error:', error);
      setLLMState(prev => ({ 
        ...prev, 
        isProcessing: false,
        isStreaming: false,
        streamBuffer: '',
        streamRequestId: ''
      }));
      setIsStreamingActive(false);
      setGhostText("");
    }
  }, [activeTab, activeTabId, llmState]);

  const sendToLLM = useCallback(async () => {
    await sendToLLMStreaming();
  }, [sendToLLMStreaming]);

  return (
    <div className={`app ${theme}`}>
      <div className="menu-bar">
        <div className="menu-items">
          <button onClick={createNewTab}>New</button>
          <button onClick={openFile}>Open</button>
          <button onClick={saveFile} disabled={!activeTab}>Save</button>
          <button onClick={sendToLLM} disabled={!activeTab || llmState.isProcessing || llmState.isStreaming}>
            🤖 {llmState.isStreaming ? 'Streaming...' : 
                 llmState.isProcessing ? (llmState.processingText || 'Processing...') : 
                 'Ask LLM'}
          </button>
          <select 
            value={llmState.mode} 
            onChange={(e) => setLLMState(prev => ({ ...prev, mode: e.target.value as any }))}
            disabled={llmState.isProcessing}
          >
            <option value="edit">Edit</option>
            <option value="append">Append</option>
            <option value="respond">Respond</option>
          </select>
          <button onClick={toggleTheme}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>
      
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="tab-name">
              {tab.name}
              {tab.isDirty && " •"}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="new-tab-btn" onClick={createNewTab}>+</button>
      </div>

      <div className="editor-container">
        {activeTab && (
          <Editor
            height="100%"
            language="javascript"
            theme={theme === "dark" ? "vs-dark" : "vs"}
            value={activeTab.content}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              multiCursorModifier: "ctrlCmd",
              find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: "never",
                seedSearchStringFromSelection: "always",
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
