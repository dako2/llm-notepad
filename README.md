# LLM-powered Notepad++ Style Text Editor

A cross-platform desktop text editor built with Tauri + React + TypeScript, providing core Notepad++ functionality with modern web technologies and AI collaboration features.

## 🚀 Features

- **Multi-tab editing** - Full tab management with close buttons and unsaved change indicators
- **Monaco Editor integration** - VS Code's powerful editor with syntax highlighting
- **File operations** - Open, Save, Save As with native file dialogs
- **Light/Dark theme switching** - Modern theme toggle
- **Cross-platform compatibility** - Windows, macOS, and Linux support
- **Syntax highlighting** - Support for multiple programming languages
- **Multi-cursor editing** - Advanced editing capabilities
- **Professional UI** - Clean, modern interface similar to Notepad++
- **🤖 LLM Collaboration** - AI-powered text editing with OpenAI integration
- **Smart text assistance** - Edit, append, or respond modes for different AI interactions
- **Keyboard shortcuts** - Quick LLM access via Ctrl+Shift+L

## 🛠 Prerequisites

### System Dependencies (Linux/Ubuntu)
```bash
sudo apt update
sudo apt install pkg-config libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.0-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev
```

### Development Tools
- **Node.js** (v16 or higher)
- **Rust** (latest stable)
- **npm** or **yarn**
- **OpenAI API Key** (for LLM features)

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key (for LLM features)
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Development Mode
```bash
# Set environment variable for the session
export OPENAI_API_KEY=your_actual_api_key_here

# Start development server
npm run tauri:dev
```
This will start the development server and launch the desktop application.

### 4. Production Build
```bash
npm run tauri:build
```
This creates optimized binaries for your platform in `src-tauri/target/release/bundle/`.

## 🏗 Project Structure

```
llm-notepad/
├── src/                    # React frontend
│   ├── App.tsx            # Main application component
│   ├── App.css            # Application styles
│   └── main.tsx           # React entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   └── lib.rs         # Tauri commands and file operations
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node.js dependencies and scripts
```

## 🎯 Usage

1. **Creating New Files**: Click the "New" button or the "+" tab
2. **Opening Files**: Click "Open" to browse and select files
3. **Saving Files**: Click "Save" to save current file (Save As for new files)
4. **Theme Toggle**: Click the sun/moon icon to switch themes
5. **Tab Management**: Click tabs to switch, "×" to close
6. **Multi-cursor**: Hold Ctrl/Cmd while clicking to create multiple cursors
7. **🤖 LLM Collaboration**:
   - **Keyboard Shortcut**: Press `Ctrl+Shift+L` to send text to AI
   - **Selection Mode**: Select text first, then use shortcut to edit selection
   - **Document Mode**: Use shortcut without selection to process entire document
   - **Interaction Modes**:
     - **Edit**: Replace selected text with AI response
     - **Append**: Add AI response at cursor position
     - **Respond**: Add AI response as new section with spacing

## 🔧 Technical Details

- **Frontend**: React 19 + TypeScript + Monaco Editor
- **Backend**: Rust with Tauri v2 framework
- **Build System**: Vite for fast development
- **Styling**: Custom CSS with theme support
- **File Operations**: Secure Tauri APIs with native dialogs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the MIT License.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
