<p align="center">
  <img src="public/assets/logo.png" alt="KeyKeeper Logo" width="400"/>
</p>

<p align="center">
  <img src="public/assets/icon.png" alt="KeyKeeper Icon" width="80"/>
</p>

<p align="center">
  <b>KeyKeeper</b> – Secure, local, and beautiful API key management for developers.
</p>

<p align="center">
  <a href="https://github.com/cadcamfun/keykeeper/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-informational">
</p>

---

# Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [VSCode Extension](#vscode-extension)
- [API Reference](#api-reference)
- [Security](#security)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Features

- Local encrypted vault with master password
- Environment organization (dev, staging, production)
- Expiration tracking and advanced search
- Tags, scopes, and project sync
- Modern UI with smooth animations
- Secure copy and hide/show for API keys
- VSCode extension for seamless workflow

## Installation

### Prerequisites

- Node.js 18+
- Rust 1.77+ (for Tauri v2)
- Yarn

### Setup

```bash
yarn install
yarn add -D @tauri-apps/cli@^2.0.0
yarn tauri:dev
```

To build for production:

```bash
yarn tauri:build
```

## Usage

- Set your master password on first launch
- Add, edit, and organize API keys
- Lock/unlock the vault as needed
- Use the search and filter features
- Track expiration and tag your keys

## Configuration

- Edit `tailwind.config.js` for UI customization
- Set environment variables in `.env`
- Configure Tauri in `src-tauri/tauri.conf.json`

## VSCode Extension

For packaging, publishing, and developing the VSCode extension, see [`extensions/vscode/README.md`](extensions/vscode/README.md).
- Npm scripts: `package`, `publish`, `vsce:login`, etc.
- Build `.vsix` and publish to the marketplace.

## API Reference

| HTTP Endpoint                | Method | Tauri Command                |
|-----------------------------|--------|------------------------------|
| /api/keys                   | GET    | get_api_keys                 |
| /api/keys/search?q=...      | GET    | search_api_keys_by_query     |
| /api/projects               | GET    | get_projects                 |
| /api/activity/recent        | GET    | get_recent_activity          |
| /api/keys/{id}/usage        | POST   | record_key_usage             |
| /api/projects/sync          | POST   | sync_project                 |
| /health                     | GET    | -                            |

## Security

- All data is stored locally and encrypted
- Master password protects the vault (Argon2/bcrypt recommended)
- Minimal permissions via Tauri capabilities
- No cloud or external sync by default

## Troubleshooting & FAQ

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

## Project Structure

```
keykeeper/
├── components/
├── lib/
├── pages/
├── src-tauri/
├── styles/
└── package.json
```

## Contributing

1. Fork and clone the repo
2. Create a feature branch
3. Submit a pull request

## License

MIT License. See [LICENSE](LICENSE).

## Acknowledgements

- Tauri, Next.js, Framer Motion, Lucide, and more.

---

<p align="center">
  <img src="public/assets/icon.png" alt="KeyKeeper Icon" width="60"/>
  <br/>
  <i>Made with ❤️ by developers, for developers</i>
</p>