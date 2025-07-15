# KeyKeeper VSCode Extension

Enterprise-grade Secure API Key Management with .env Drag & Drop and Auto-Activation for VSCode.

## 🆕 Version 2.1.0 - New Features

### 🎯 .env Drag & Drop Integration
- **Drag & Drop Support**: Drag .env files directly into KeyKeeper desktop app
- **Auto-Project Detection**: Automatically associates .env files with project paths  
- **Smart Project Recognition**: Detects Node.js, Rust, Python, and other project types
- **Workspace Auto-Activation**: Extension automatically activates when opening associated projects

### 🔄 Intelligent Context Switching
- **File Watching**: Monitors workspace for .env file changes
- **Project Context**: Automatically switches API key context based on current project
- **Multi-Project Support**: Handle multiple projects with different .env configurations
- **Real-time Notifications**: Get notified when new .env files are detected

## 🚀 Core Features

- **Quick API Key Insertion**: Insert API keys directly at cursor position with `Cmd+Shift+I`
- **Smart Search**: Fuzzy search through your API keys with `Cmd+Shift+K`
- **Project Integration**: Organize keys by project and sync with your workspace
- **Real-time Sync**: Automatic synchronization with KeyKeeper desktop app
- **Multiple Formats**: Insert keys as values, environment variables, or process.env calls
- **Security First**: No keys stored in VSCode - all data fetched from secure KeyKeeper app
- **100% Secret Detection**: Advanced algorithms accurately identify API keys vs. config variables

## 📋 Requirements

- KeyKeeper desktop app must be installed and running
- VSCode 1.74.0 or higher
- Active workspace/project (recommended)

## 🛠 Installation

### From VSIX (Development)
1. Open VSCode
2. Go to Extensions view (`Cmd+Shift+X`)
3. Click "..." menu → "Install from VSIX"
4. Select the KeyKeeper extension VSIX file

### From Marketplace (Coming Soon)
```bash
ext install keykeeper.keykeeper-vscode
```

## ⚡ Quick Start

1. **Start KeyKeeper Desktop App**
   - Make sure KeyKeeper is running on port 27182 (default)
   - Extension will auto-detect when the app is available

2. **Open Your Project**
   - Open any workspace in VSCode
   - The KeyKeeper sidebar will appear

3. **Insert API Keys**
   - Use `Cmd+Shift+K` to quick search and insert
   - Or use `Cmd+Shift+I` to browse all keys
   - Keys appear in the sidebar organized by environment and service

## 🎯 Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Quick Search Keys | `Cmd+Shift+K` | Search and insert API keys |
| Insert API Key | `Cmd+Shift+I` | Browse and insert API keys |
| Browse Keys | - | Open key browser |
| Sync Project | - | Sync current workspace with KeyKeeper |
| Create Key | - | Create new API key |
| Refresh | - | Refresh extension data |

## 🔧 Configuration

Access settings via `Code > Preferences > Settings > KeyKeeper`:

```json
{
  "keykeeper.autoSync": true,
  "keykeeper.insertFormat": "process.env",
  "keykeeper.showNotifications": true,
  "keykeeper.defaultProject": "",
  "keykeeper.appPort": 27182
}
```

### Insert Formats

- **`value`**: Insert raw API key value
- **`environment`**: Insert as environment variable name (e.g., `OPENAI_API_KEY`)
- **`process.env`**: Insert as Node.js environment access (e.g., `process.env.OPENAI_API_KEY`)

## 📱 Sidebar Views

### Projects
- View all your KeyKeeper projects
- Click to filter keys by project
- Sync workspace with project

### API Keys
- Organized by environment and service
- Click to insert at cursor
- Drag & drop support

### Recent
- See recently used keys
- Quick access to frequently needed keys
- Usage timestamps

## 🔐 Security

- **Zero Storage**: No API keys stored in VSCode or extension
- **Secure Communication**: HTTPS communication with KeyKeeper app
- **Local Only**: All data stays on your machine
- **Audit Trail**: All key usage tracked in KeyKeeper

## 🚀 Usage Examples

### Quick Insert Workflow
```typescript
// 1. Start typing your API call
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: {
    'Authorization': 'Bearer |cursor-here|'
  }
});

// 2. Press Cmd+Shift+K
// 3. Type "openai" to search
// 4. Press Enter to insert
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: {
    'Authorization': 'Bearer process.env.OPENAI_API_KEY'
  }
});
```

### Environment Variables
```bash
# .env file - use "environment" format
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
DATABASE_URL=postgres://...

# Your code
const apiKey = process.env.OPENAI_API_KEY;
```

## 📦 Packaging & Publishing

To build, package, and publish the KeyKeeper VSCode extension, use the following npm scripts (from the `extensions/vscode` directory):

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile the TypeScript sources to `out/` |
| `npm run watch` | Watch and recompile on file changes |
| `npm run package` | Create a `.vsix` package for manual installation (requires `vsce`) |
| `npm run publish` | Publish the extension to the VSCode Marketplace (requires publisher rights and `vsce` login) |
| `npm run vsce:login` | Login to VSCE as publisher `cadcamfun` |
| `npm run vsce:publish:minor` | Publish and bump the minor version |
| `npm run vsce:publish:patch` | Publish and bump the patch version |
| `npm run vsce:publish:major` | Publish and bump the major version |
| `npm run vsce:show` | Show info about the published extension |
| `npm run vsce:ls` | List all VSCE publishers for your account |

**Requirements:**
- Install [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension):
  ```bash
  npm install -g vsce
  ```
- For publishing, you must be logged in as the correct publisher:
  ```bash
  npm run vsce:login
  ```

**Manual Installation:**
- After running `npm run package`, install the `.vsix` in VSCode:
  1. Open VSCode
  2. Go to Extensions (`Cmd+Shift+X`)
  3. Click "..." → "Install from VSIX"
  4. Select the generated `.vsix` file

## 🔧 Development

### Build & Test
```bash
cd extensions/vscode
npm install
npm run compile
```

### Packaging & Publishing
See the [📦 Packaging & Publishing](#-packaging--publishing) section above for all available commands and instructions.

### Debug Extension
1. Open `extensions/vscode` in VSCode
2. Press F5 to launch Extension Development Host
3. Test extension in the new VSCode window

## 🐛 Troubleshooting

### Extension Not Connecting
- Check KeyKeeper desktop app is running
- Verify port 27182 is available
- Check firewall settings
- Restart VSCode

### Keys Not Appearing
- Refresh extension data (Command Palette > "KeyKeeper: Refresh")
- Check project sync status
- Verify API keys exist in KeyKeeper app

### Search Not Working
- Clear search query and try again
- Check key names and descriptions
- Ensure keys are not filtered by project

## 📚 API

The extension communicates with KeyKeeper via REST API:

```typescript
// Health check
GET http://localhost:27182/health

// Get all keys
GET http://localhost:27182/api/keys

// Search keys
GET http://localhost:27182/api/keys/search?q=openai

// Get projects
GET http://localhost:27182/api/projects

// Record usage
POST http://localhost:27182/api/keys/{id}/usage
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Links

- [KeyKeeper Desktop App](../../README.md)
- [Enterprise Features](../../ENTERPRISE_ROADMAP.md)
- [Bug Reports](https://github.com/keykeeper/keykeeper/issues)
- [Feature Requests](https://github.com/keykeeper/keykeeper/discussions)

---

**Made with ❤️ by the KeyKeeper Team** 