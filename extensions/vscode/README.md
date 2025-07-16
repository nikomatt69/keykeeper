# KeyKeeper VSCode Extension

Enterprise-grade Secure API Key Management with .env Drag & Drop and Auto-Activation

## Overview

The KeyKeeper VSCode extension provides seamless integration between your VSCode/Cursor editor and the KeyKeeper desktop application, offering secure API key management, project synchronization, and enterprise-grade security features.

## 🚀 Quick Start

### Installation

1. **Download the latest extension**: `keykeeper-vscode-2.2.2.vsix`
2. **Install in VSCode/Cursor**:
   ```bash
   code --install-extension keykeeper-vscode-2.2.2.vsix
   # or for Cursor
   cursor --install-extension keykeeper-vscode-2.2.2.vsix
   ```
3. **Start KeyKeeper desktop app** and unlock your vault
4. **Extension will auto-connect** when vault is unlocked

## 🔧 Configuration Guide

### ✅ 1. Backend Configuration (Rust/Tauri)

**HTTP Server Auto-Start**:
- **Status**: ✅ Fixed - Now auto-starts when vault is unlocked
- **Port**: `27182` (default)
- **Integration**: Automatically initialized via `integrationService.initialize()`

**API Endpoints Available**:
```
GET  /health                    - Health check
GET  /api/keys                  - Get all API keys
GET  /api/keys/search?q=...     - Search API keys
GET  /api/projects              - Get projects
GET  /api/activity/recent       - Get recent activity
POST /api/keys/{id}/usage       - Record key usage
POST /api/projects/sync         - Sync project
POST /api/env/parse             - Parse .env file
POST /api/env/associate         - Associate project with env
GET  /api/env/associations      - Get project associations
POST /api/projects/activate     - Activate project context
POST /api/vscode/workspaces     - Update VSCode workspaces
GET  /api/vscode/workspaces     - Get VSCode workspaces
GET  /api/vscode/status         - Get project VSCode status
```

### ✅ 2. Frontend Configuration (Next.js)

**Integration Service**:
- **Status**: ✅ Fixed - Auto-initializes when vault unlocks
- **Settings**: VSCode integration enabled by default
- **Auto-Connect**: Enabled by default

**Default Settings**:
```typescript
integrations: {
  vscode: {
    enabled: true,           // ✅ VSCode integration enabled
    autoConnect: true,       // ✅ Auto-connect when possible
    projectSync: true,       // ✅ Project synchronization
    quickInsert: true,       // ✅ Quick key insertion
    contextAware: true,      // ✅ Context-aware suggestions
    securityWarnings: true   // ✅ Security warnings enabled
  }
}
```

### ✅ 3. VSCode Extension Settings

**Default Configuration**:
```json
{
  "keykeeper.autoSync": true,
  "keykeeper.insertFormat": "process.env",
  "keykeeper.showNotifications": true,
  "keykeeper.defaultProject": "",
  "keykeeper.appPort": 27182,
  "keykeeper.enterprise.auditLogging": true,
  "keykeeper.enterprise.securityWarnings": true,
  "keykeeper.enterprise.contextAnalysis": true,
  "keykeeper.enterprise.teamSync": false,
  "keykeeper.enterprise.rateLimiting": true,
  "keykeeper.enterprise.encryptionLevel": "enhanced"
}
```

### ✅ 4. Automatic Initialization Flow

**Connection Flow**:
```
1. App Start → 2. User Unlocks Vault → 3. Integration Service Initializes → 4. VSCode Server Starts → 5. Extension Connects
```

**Technical Flow**:
```typescript
unlockVault() → integrationService.initialize() → enableVSCodeIntegration() → startVSCodeServer() → HTTP server on port 27182
```

## 🎯 Features

### Commands Available

- **`keykeeper.insertKey`** - Insert API key (`Cmd+Shift+I`)
- **`keykeeper.browseKeys`** - Browse API keys
- **`keykeeper.quickSearch`** - Quick search keys (`Cmd+Shift+K`)
- **`keykeeper.syncProject`** - Sync with KeyKeeper
- **`keykeeper.createKey`** - Create new API key
- **`keykeeper.refreshKeys`** - Refresh keys
- **`keykeeper.openSettings`** - Open KeyKeeper settings
- **`keykeeper.login`** - Login to KeyKeeper

### Views Available

- **Projects** - Project management and .env file associations
- **API Keys** - Key management with environment indicators
- **Recent** - Recent activity and usage tracking

### Keyboard Shortcuts

- **`Cmd+Shift+K`** (`Ctrl+Shift+K` on Windows/Linux) - Quick search keys
- **`Cmd+Shift+I`** (`Ctrl+Shift+I` on Windows/Linux) - Insert API key

## 🔒 Security Features

### Enterprise Security

- ✅ **Audit logging** enabled for compliance
- ✅ **Security warnings** for unsafe key usage
- ✅ **Context analysis** for smart suggestions
- ✅ **Rate limiting** respect
- ✅ **Enhanced encryption** level

### File Security

- ✅ **Warns against plaintext exposure** in documentation files
- ✅ **Checks for version control risks** in README/CHANGELOG files
- ✅ **Production key usage warnings** for enhanced security

## 📊 Connection Status

### Health Check

- **URL**: `http://localhost:27182/health`
- **Method**: GET
- **Expected Response**: 200 OK
- **Auto-Check**: Every 30 seconds

**Manual Connection Test**:
```bash
curl http://localhost:27182/health
```

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### 1. Extension Not Activating
- ✅ **Fixed**: Removed Tauri API imports
- ✅ **Fixed**: Bundled all dependencies with webpack
- **Solution**: Extension now loads without dependency errors

#### 2. Cannot Connect to Main App
- ✅ **Fixed**: Auto-start server when vault unlocks
- **Check**: KeyKeeper app is running
- **Verify**: Port 27182 is not blocked by firewall

#### 3. API Keys Not Loading
- **Ensure**: Vault is unlocked in main app
- **Check**: VSCode integration is enabled in settings
- **Verify**: HTTP server is running on port 27182

#### 4. Commands Not Appearing
- **Reload**: VSCode window (`Cmd+Shift+P` → "Developer: Reload Window")
- **Check**: Extension is enabled in Extensions panel
- **Verify**: KeyKeeper app is running and connected

## 🧪 Testing

### Test Commands

1. **Open VSCode/Cursor**
2. **Press `Cmd+Shift+P`** → Search "KeyKeeper"
3. **Should see all KeyKeeper commands**
4. **Try `Cmd+Shift+K`** for quick search
5. **Check sidebar** for KeyKeeper panel

### Expected Behavior

- ✅ Extension loads without errors
- ✅ Commands appear in command palette
- ✅ Sidebar shows KeyKeeper views
- ✅ HTTP connection to port 27182 works
- ✅ API keys load from main app

## 📋 System Requirements

- **VSCode**: 1.74.0 or higher
- **KeyKeeper Desktop**: Latest version
- **Operating System**: macOS, Windows, or Linux
- **Network**: Port 27182 available (localhost only)

## 🔄 Version History

### v2.2.2 (Latest)
- ✅ Fixed Tauri API import errors
- ✅ Bundled all dependencies with webpack
- ✅ Auto-start server when vault unlocks
- ✅ Improved error handling and connection stability

### v2.2.1
- ✅ Removed invalid Tauri dependencies
- ✅ Fixed module resolution issues

### v2.2.0
- ✅ Added comprehensive VSCode integration
- ✅ Enterprise security features
- ✅ Project synchronization

## 🎯 Current Status: **ALL SYSTEMS WORKING**

The KeyKeeper VSCode extension should now:
- ✅ Load without any errors
- ✅ Auto-connect to the main app when vault is unlocked
- ✅ Provide all commands and features
- ✅ Display proper sidebar views
- ✅ Handle keyboard shortcuts correctly
- ✅ Maintain enterprise security standards

## 📞 Support

For issues or questions:
1. Check this README for troubleshooting steps
2. Verify all prerequisites are met
3. Test the manual connection with `curl http://localhost:27182/health`
4. Report issues with detailed error messages

## 🔐 Security Note

This extension communicates only with your local KeyKeeper application via HTTP on localhost:27182. No data is transmitted over the internet. All security features from the main application are maintained in the extension.

---

**Ready to use!** The extension is properly configured and all settings are working correctly.