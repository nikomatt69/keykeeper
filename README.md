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
  <a href="https://github.com/nikomatt69/keykeeper/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL%20v3%20%2B%20Commercial-blue.svg"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-informational">
</p>

---

# KeyKeeper

**Intellectual Property & Author**  
KeyKeeper is an original project created and developed by [nikomatt69](https://github.com/nikomatt69). This repository and all its contents are fully protected as intellectual property. Unauthorized commercial use, copying, or distribution is strictly prohibited.  


**Launch & Product Hunt**  
KeyKeeper is set to launch on [Product Hunt](https://www.producthunt.com/)!  
Show your support and learn more by visiting the Product Hunt page:

[![Product Hunt Badge](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=000000&theme=light)](https://www.producthunt.com/posts/keykeeper)

---

## Overview

KeyKeeper is a secure, local solution for API key management designed with developers in mind. It combines modern UI/UX, robust security practices, and dual licensing to provide:
- **Open-Source Freedom:** Distributed under GNU AGPL v3.0.
- **Commercial Flexibility:** A proprietary license is available for those needing closed-source integration.
  
---

## Features

### Core Security & Management
- **Secure Vault:** Local encrypted vault with master password protection
- **Environment Organization:** Manage different environments like development, staging, and production
- **Advanced Functionality:** Expiration tracking, advanced search, tags, scopes, and project synchronization
- **Secure Clipboard Operations:** Securely copy and hide/show API keys

### AI-Powered Intelligence
- **Local LLM Integration:** Built-in Qwen model support for offline AI processing with GGUF format compatibility
- **Multi-Provider AI Support:** Support for OpenAI, Anthropic Claude, and local Ollama models
- **Contextual AI Suggestions:** Smart recommendations based on your project context and framework detection
- **AI-Enhanced Project Analysis:** Automated framework detection, code quality analysis, and dependency mapping
- **Intelligent Documentation Generation:** AI-powered contextual documentation creation with template inheritance
- **Smart Template Matching:** AI-assisted template recommendations for your projects with enhanced matching algorithms
- **AI Proxy System:** Unified interface for multiple LLM providers with automatic fallback

### Advanced Chat & Assistant Features
- **Interactive Chat System:** Built-in chat interface with persistent session management and conversation history
- **Code Generation Assistant:** AI-powered code generation with integration support and validation
- **Documentation Search & Integration:** Intelligent search through documentation libraries with semantic understanding
- **Integration Generation:** Automated API integration code generation with framework-specific templates
- **Chat Engine:** Advanced chat engine with context-aware responses and multi-model support
- **LLM Wrapper:** Unified wrapper for different language models with optimized performance
- **ML Engine Integration:** Machine learning capabilities for pattern recognition and intelligent suggestions

### Enhanced Validation & Setup System
- **Configuration Validation:** AI-powered validation of generated configurations with error detection
- **Setup Script Generation:** Automated setup scripts for various frameworks with dependency management
- **Environment Compatibility Checks:** Pre-deployment environment validation with comprehensive testing
- **Security Configuration Validation:** Automated security best practices validation and compliance checking
- **Deployment Configuration:** Platform-specific deployment config generation with optimization
- **Validation Engine:** Advanced validation system for templates and configurations
- **Template Inheritance:** Support for template inheritance and composition patterns

### Developer Experience
- **Modern UI:** Smooth animations and beautiful interface with glassmorphism effects
- **VSCode Integration:** Comprehensive VSCode extension for seamless workflow
- **Framework Detection:** Automatic detection of project frameworks and patterns
- **Template Engine:** Advanced templating system with inheritance support
- **Dual Licensing:** Open-source under GNU AGPL v3.0 and available commercially

---

## Installation

### Prerequisites

- Node.js 18+
- Rust 1.77+ (compatible with Tauri v2)
- Yarn

### Setup

Install dependencies and start the development environment with:

```bash
yarn install
yarn add -D @tauri-apps/cli@^2.0.0
yarn tauri:dev
```

To build for production:

```bash
yarn tauri:build
```

---

## Usage

- **First Launch:** Set your master password on the first run.
- **API Key Management:** Add, edit, and organize your API keys.
- **Vault Security:** Lock/unlock the vault as needed.
- **Search & Filter:** Use advanced search and filtering functionalities.
- **Expiration Tracking:** Monitor your API keys by tracking their expiration dates.

---

## Configuration

- **UI Customization:** Modify the UI by editing `tailwind.config.js`.
- **Environment Setup:** Set environment variables in the `.env` file.
- **Tauri Configuration:** Customize Tauri settings in `src-tauri/tauri.conf.json`.

---

## Security

KeyKeeper is designed with stringent security best practices:
- **Local Encrypted Storage:** All sensitive data is stored locally in an encrypted vault.
- **Vault Protection:** Secured by a master password (using algorithms like Argon2 or bcrypt is recommended).
- **Minimal Permissions:** Leverages Tauri’s capabilities for secure, minimal permissions.
- **No Cloud Sync:** By default, no data is synchronized externally.

If you encounter any vulnerabilities, please report them immediately to [nicom.19@icloud.com](mailto:nicom.19@icloud.com).

---

## VSCode Extension

A dedicated VSCode extension is available for seamless integration:
- Refer to [`extensions/vscode/README.md`](extensions/vscode/README.md) for setup and usage.
- Includes npm scripts for packaging, publishing, and developing your extension.

---

## API Reference

### Core API Endpoints
| HTTP Endpoint              | Method | Tauri Command              |
|----------------------------|--------|----------------------------|
| /api/keys                  | GET    | get_api_keys               |
| /api/keys/search?q=...     | GET    | search_api_keys_by_query   |
| /api/projects              | GET    | get_projects               |
| /api/activity/recent       | GET    | get_recent_activity        |
| /api/keys/{id}/usage       | POST   | record_key_usage           |
| /api/projects/sync         | POST   | sync_project               |
| /health                    | GET    | -                          |

### AI & Chat API Endpoints
| HTTP Endpoint              | Method | Tauri Command              |
|----------------------------|--------|----------------------------|
| /api/ai/analyze            | POST   | ai_analyze_project         |
| /api/ai/suggestions        | GET    | get_contextual_suggestions |
| /api/ai/template-match     | POST   | smart_template_matching    |
| /api/chat/sessions         | GET    | get_chat_sessions          |
| /api/chat/send             | POST   | send_chat_message          |
| /api/chat/history          | GET    | get_chat_history           |
| /api/llm/config            | GET    | get_llm_config             |
| /api/llm/status            | GET    | get_llm_status             |

### Documentation & ML API Endpoints
| HTTP Endpoint              | Method | Tauri Command              |
|----------------------------|--------|----------------------------|
| /api/docs/search           | GET    | search_documentation       |
| /api/docs/generate         | POST   | generate_documentation     |
| /api/docs/library          | GET    | get_documentation_library  |
| /api/ml/analyze            | POST   | ml_analyze_context         |
| /api/validation/setup      | POST   | validate_setup_config      |
| /api/templates/generate    | POST   | generate_template          |

---

## Troubleshooting & FAQ

**Q: I encountered an error regarding `TAURI_SIGNING_PRIVATE_KEY`?**  
A: Generate the signing key with:

```bash
npx tauri signer generate
```

Then set the `TAURI_SIGNING_PRIVATE_KEY` environment variable with the generated key.

**Q: Rustup is not installed. What should I do?**  
A: Install Rustup using:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
```

**Q: Build fails on Mac/Windows/Linux?**  
A: Verify your Rust toolchain, signing keys, permissions, and Tauri dependencies.

**Q: Emails are not being sent?**  
A: Check your SMTP configuration, port, credentials, and any potential IP blocks from your provider.

---

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

---

## Contributing

1. **Fork and Clone:** Fork the repository and clone it locally.
2. **Feature Branch:** Create a new branch for your feature or fix.
3. **Pull Request:** Submit your changes in a pull request with a detailed description.

All contributions must adhere to the licensing terms and coding guidelines of KeyKeeper.

---

## License

KeyKeeper is dual-licensed under the GNU AGPL v3.0 (open-source) and a commercial license. Any redistribution or modifications must comply with these terms.  
For the full license text, please refer to [LICENSE](LICENSE).

---

## Acknowledgements

- Special thanks to the communities behind Tauri, Next.js, Framer Motion, Lucide, and more.

<p align="center">
  <img src="public/assets/icon.png" alt="KeyKeeper Icon" width="60"/>
  <br/>
  <i>Made with ❤️ by developers, for developers</i>
</p>