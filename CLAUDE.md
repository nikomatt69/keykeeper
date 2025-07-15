# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KeyKeeper is a secure API key manager built with Tauri v2, Next.js, TypeScript, and Rust. It provides local storage and encryption for API keys with enterprise-grade security features.

## Development Commands

### Essential Commands
- `yarn tauri:dev` - Start development server with Tauri backend
- `yarn tauri:build` - Build production executable  
- `yarn dev` - Start Next.js frontend only (for UI development)
- `yarn build` - Build Next.js frontend

### Build Variants
- `yarn build:enterprise` - Build enterprise version using `./scripts/enterprise-build.sh`
- `yarn build:icons` - Generate app icons using `./scripts/generate-icons.sh`
- `yarn test:production` - Test production build with debug symbols

### Security & Maintenance
- `yarn audit:security` - Run security audit on both Node.js and Rust dependencies
- `yarn deploy:production` - Deploy using `./scripts/deploy.sh`

## Architecture

### Frontend (Next.js)
- **State Management**: Zustand store in `lib/store.ts` with enterprise settings support
- **API Layer**: `lib/tauri-api.ts` provides typed wrapper around Tauri commands
- **Components**: React components in `components/` with modals for CRUD operations
- **Styling**: Tailwind CSS with Framer Motion animations (family.co inspired design)

### Backend (Rust/Tauri v2)
- **Main Backend**: `src-tauri/src/main.rs` implements all Tauri commands
- **Security**: bcrypt password hashing, AES-256-GCM encryption, audit logging
- **VSCode Integration**: Built-in HTTP server on port 27182 for VSCode extension
- **Enterprise Features**: User accounts, password recovery, project management

### Key Integrations
- **VSCode Extension**: Located in `extensions/vscode/` with complete TypeScript implementation
- **Enterprise Support**: Advanced settings, audit logs, security policies
- **Local Storage**: All data stored locally with optional cloud sync

## Important Implementation Details

### Security Architecture
- Master password uses bcrypt hashing with DEFAULT_COST
- Vault encryption uses AES-256-GCM with random nonces
- PBKDF2 key derivation with 100,000 iterations (OWASP recommended)
- Comprehensive audit logging for all operations

### Tauri v2 Features
- Capabilities-based security model (see `src-tauri/capabilities/`)
- Plugin system: dialog, fs, shell, log plugins
- Custom CSP configuration for enhanced security
- Tray icon with context menu support

### State Management
- Zustand store handles all application state
- Enterprise settings with typed interfaces
- Automatic persistence and loading from Tauri backend

### VSCode Extension
- Full TypeScript implementation with providers for API keys, projects, and recent items
- HTTP API integration with the main app
- Enterprise features including project synchronization

## File Structure Highlights

- `src-tauri/src/main.rs` - Main Rust backend with all Tauri commands
- `lib/store.ts` - Central Zustand state management
- `lib/tauri-api.ts` - Typed API wrapper for Tauri commands
- `components/` - React UI components
- `extensions/vscode/` - Complete VSCode extension implementation
- `src-tauri/tauri.conf.json` - Tauri v2 configuration
- `src-tauri/Cargo.toml` - Rust dependencies (includes security crates)

## Development Notes

### Running the Application
Always use `yarn tauri:dev` for full-stack development. The `yarn dev` command only runs the frontend and won't have access to Tauri APIs.

### Adding New Features
1. Add Rust command to `src-tauri/src/main.rs`
2. Update `lib/tauri-api.ts` with typed wrapper
3. Update Zustand store in `lib/store.ts` if needed
4. Implement UI components

### Security Considerations
- Never commit encryption keys or passwords
- All API keys are encrypted before storage
- Audit logging is enabled for all security-sensitive operations
- Rate limiting implemented for VSCode integration

### Enterprise Features
The application includes enterprise-grade features like user accounts, audit logging, password recovery, and VSCode integration. These are fully implemented in the current codebase.