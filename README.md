# KeyKeeper 🔐

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/cadcamfun/keykeeper/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-informational)](https://tauri.app/)
[![Mail Ready](https://img.shields.io/badge/mail-MJ%20SMTP-green)](https://www.mailjet.com/)

---

## 🚀 Features

- **Local Security**: All API keys are stored locally on your device
- **Encryption**: Master password to protect the vault
- **Organization**: Manage keys for different environments (dev, staging, production)
- **Advanced Search**: Quickly find your API keys
- **Expiration Tracking**: Monitor key expiration dates
- **Tags and Scopes**: Organize keys with custom tags and scopes
- **Export**: Export the vault for backup
- **Modern UI**: Interface inspired by family.co with smooth animations

## 🛠️ Technologies

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Rust with Tauri v2
- **State Management**: Zustand
- **Icons**: Lucide React
- **Package Manager**: Yarn

## 📦 Installation

### Prerequisites

- Node.js 18+
- Rust 1.77+ (for Tauri v2)
- Yarn

### Setup

1. **Install dependencies**
   ```bash
   yarn install
   ```
2. **Install Tauri CLI v2**
   ```bash
   yarn add -D @tauri-apps/cli@^2.0.0
   ```
3. **Start in development mode**
   ```bash
   yarn tauri:dev
   ```
4. **Build for production**
   ```bash
   yarn tauri:build
   ```

## 🎯 Usage

### First Launch

1. On first launch, set a secure master password
2. This password will be used to encrypt the vault
3. **Do not forget your password**: there is no way to recover it!

### API Key Management

1. **Add a new API key**:
   - Click "New API Key"
   - Fill in required fields (Name, Service, API Key)
   - Select the environment (dev/staging/production)
   - Add optional description, scopes, and tags
2. **Edit an existing key**:
   - Select the key from the list
   - Click the edit icon
   - Update the necessary fields
3. **Delete a key**:
   - Select the key
   - Click the delete icon
   - Confirm deletion

### Search and Filters

- Use the search bar to find keys by name, service, or tag
- Keys are organized by environment with colored counters
- Easily view expiring keys

### Security

- **Lock the vault**: Use the "Lock Vault" button to protect your data
- **Hide/Show keys**: Use the eye icon to show/hide API keys
- **Secure copy**: Copy keys to clipboard with one click

## 🔧 Configuration

### UI Customization

Edit `tailwind.config.js` to customize:
- Theme colors
- Animations
- Spacing

### Additional Security

⚠️ **Important**: This is a demo. For production use:

1. Replace `simple_hash()` in `main.rs` with a secure hash (bcrypt/argon2)
2. Implement real encryption for the vault
3. Add automatic backups
4. Implement secure password recovery

## 🏭 Production Setup (Checklist)

- [x] **Real encryption**: Vault encrypted with master password (Argon2/bcrypt)
- [x] **Automatic backups**: Export and save vault securely
- [x] **Tauri signing**: Generate keys and set `TAURI_SIGNING_PRIVATE_KEY` for secure builds
- [x] **Mail provider**: Configure free SMTP (Mailjet recommended)
- [x] **Audit log**: All sensitive operations are tracked
- [x] **Minimal permissions**: Tauri capabilities configured in `tauri.conf.json`
- [x] **Optimized build**: Use `yarn tauri:build` and `cargo build --release`

### Tauri Signing and Build

1. Generate signing keys:
   ```sh
   npx tauri signer generate
   export TAURI_SIGNING_PRIVATE_KEY="$(cat private.key)"
   ```
2. Production build:
   ```sh
   yarn tauri:build
   # or
   cd src-tauri && cargo build --release
   ```

### Mail Configuration (Free Mailjet SMTP)

1. Register at [Mailjet](https://www.mailjet.com/)
2. Get API Key and Secret from the dashboard
3. Set in `.env` or config:
   ```env
   SMTP_SERVER=in-v3.mailjet.com
   SMTP_PORT=587
   SMTP_USERNAME=<API_KEY>
   SMTP_PASSWORD=<API_SECRET>
   SMTP_FROM=<your_verified_email>
   ```
4. The backend will send real emails for password reset and notifications

---

## 📦 VSCode Extension

For packaging, publishing, and developing the VSCode extension, see `extensions/vscode/README.md`.
- Npm scripts: `package`, `publish`, `vsce:login`, etc.
- Build `.vsix` and publish to the marketplace.

---

## 🔗 API HTTP ↔️ Tauri Command Map

| HTTP Endpoint                | Method | Tauri Command                |
|-----------------------------|--------|------------------------------|
| /api/keys                   | GET    | get_api_keys                 |
| /api/keys/search?q=...      | GET    | search_api_keys_by_query     |
| /api/projects               | GET    | get_projects                 |
| /api/activity/recent        | GET    | get_recent_activity          |
| /api/keys/{id}/usage        | POST   | record_key_usage             |
| /api/projects/sync          | POST   | sync_project                 |
| /health                     | GET    | -                            |

---

## ❓ FAQ & Troubleshooting

**Q: Error `TAURI_SIGNING_PRIVATE_KEY`?**
A: Generate the key with `npx tauri signer generate` and set the environment variable as above.

**Q: Rustup not found?**
A: Install with:
```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
```

**Q: Emails not sent?**
A: Check SMTP config, port, credentials, and that your provider does not block the IP.

**Q: Build fails on Mac/Win/Linux?**
A: Check Rust toolchain, signing keys, permissions, and Tauri dependencies.

---

## 📁 Project Structure

```
keykeeper/
├── components/           # React components
│   ├── modals/          # CRUD modals
│   ├── LoginScreen.tsx  # Login screen
│   ├── MainLayout.tsx   # Main layout
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── ApiKeyList.tsx   # API keys list
│   └── ApiKeyDetail.tsx # Single key detail
├── lib/
│   ├── store.ts         # Zustand store
│   └── utils.ts         # Utility functions
├── pages/
│   ├── _app.tsx         # Next.js app
│   └── index.tsx        # Homepage
├── src-tauri/
│   ├── capabilities/    # Tauri v2 capabilities
│   ├── src/
│   │   └── main.rs      # Rust backend
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri v2 config
├── styles/
│   └── globals.css      # Global styles
└── package.json         # Node.js dependencies
```

## 🆕 What's New in Tauri v2

This project is updated for Tauri v2 with:

### 🔧 Technical Improvements
- **Plugin System**: Improved modularity with separate plugins
- **Capabilities**: New, more secure permission system
- **Performance**: Faster startup and runtime
- **Improved APIs**: More intuitive and consistent APIs

### 🚀 New Features
- **Enhanced Security**: Granular permission control
- **Optimized Bundles**: Smaller app size
- **Cross-Platform**: Improved support for all platforms
- **Developer Experience**: Easier debugging and development

### 🔄 Migration from v1
- Updated config in `tauri.conf.json`
- New APIs in separate plugins
- Capabilities system for permissions
- Improved dependency management

## 🎨 Style & Design

The interface is inspired by [family.co](https://family.co) with:
- Modern, professional color palette
- Smooth animations with Framer Motion
- Responsive and accessible layout
- Micro-interactions for a premium experience

## 🔒 Security

- **Local storage**: Data never leaves your device
- **Master encryption**: Single password to protect the vault
- **Granular permissions**: Precise control of capabilities
- **Secure backup**: Export the vault as JSON

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Available Scripts

- `yarn tauri:dev` - Start in development mode
- `yarn tauri:build` - Build for production
- `yarn dev` - Next.js frontend only
- `yarn build` - Next.js build
- `yarn lint` - Lint code with ESLint
- `yarn format` - Format code with Prettier

## 🐛 Known Issues

- Tauri icons must be generated manually
- The encryption system is basic (demo only)
- No password recovery (lost password = lost vault)

## 🔮 Roadmap

- [x] Real AES-256 encryption
- [x] Automatic backups
- [x] SMTP mail provider integration
- [ ] Import from 1Password/Bitwarden
- [ ] Optional cloud sync
- [ ] Browser plugin
- [ ] Dark theme
- [ ] Multi-vault support

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgements

- [Tauri](https://tauri.app/) for the framework
- [Next.js](https://nextjs.org/) for the frontend
- [Framer Motion](https://www.framer.com/motion/) for animations
- [family.co](https://family.co/) for design inspiration
- [Lucide](https://lucide.dev/) for icons

---

Made with ❤️ by developers, for developers