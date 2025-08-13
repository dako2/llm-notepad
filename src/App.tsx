import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Editor from "@monaco-editor/react";
import "./App.css";

interface FileTab {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
  path?: string;
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

  return (
    <div className={`app ${theme}`}>
      <div className="menu-bar">
        <div className="menu-items">
          <button onClick={createNewTab}>New</button>
          <button onClick={openFile}>Open</button>
          <button onClick={saveFile} disabled={!activeTab}>Save</button>
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
