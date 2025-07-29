# Contributing to KeyKeeper

Thank you for your interest in contributing to KeyKeeper! This guide will help you get started.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ with Yarn
- **Rust** 1.77+ (for Tauri)
- **Platform-specific tools**:
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: Essential build tools (`build-essential`, `libwebkit2gtk-4.0-dev`, etc.)
  - **iOS**: Xcode 14+
  - **Android**: Android Studio with NDK

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nikomatt69/keykeeper.git
cd keykeeper

# Install dependencies
yarn install

# Start development environment
yarn tauri:dev
```

## 📋 Development Workflow

### 1. Code Structure

```
keykeeper/
├── components/          # React components
├── lib/                # Shared utilities and services
├── pages/              # Next.js pages
├── src-tauri/          # Rust backend
│   ├── src/            # Rust source code
│   ├── capabilities/   # Tauri permissions
│   └── icons/          # Platform icons
├── styles/             # CSS and styling
└── extensions/         # VSCode extension
```

### 2. Available Scripts

```bash
# Development
yarn dev                # Next.js dev server
yarn tauri:dev         # Full Tauri development

# Building
yarn build             # Next.js build
yarn tauri:build       # Production Tauri build

# Testing
yarn test:native       # Native features test
yarn test:production   # Production build test

# Platform-specific builds
yarn build:ios         # iOS build
yarn build:android     # Android build
yarn build:enterprise  # Enterprise build
```

### 3. Platform Development

#### Desktop Development
```bash
# Standard desktop development
yarn tauri:dev

# Platform-specific testing
yarn tauri:build --target x86_64-pc-windows-msvc    # Windows
yarn tauri:build --target x86_64-apple-darwin       # macOS Intel
yarn tauri:build --target aarch64-apple-darwin      # macOS Apple Silicon
yarn tauri:build --target x86_64-unknown-linux-gnu  # Linux
```

#### Mobile Development
```bash
# iOS (requires macOS)
yarn tauri ios init
yarn tauri ios dev

# Android
yarn tauri android init
yarn tauri android dev
```

## 🎯 Contributing Guidelines

### Code Style

#### TypeScript/React
- Use **TypeScript** for all new code
- Follow **React hooks** patterns
- Use **Tailwind CSS** for styling
- Implement **Framer Motion** for animations

#### Rust
- Follow **Rust 2021 edition** standards
- Use **serde** for serialization
- Implement proper **error handling** with `anyhow`
- Add **tracing** for logging

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add iOS support for keychain integration
fix: resolve Windows build issue with native dependencies
docs: update API documentation for new endpoints
style: format code according to project standards
refactor: improve AI engine performance
test: add integration tests for chat functionality
chore: update dependencies to latest versions
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements

## 🔧 Development Areas

### 1. Core Features
- **API Key Management**: Secure storage and organization
- **Vault Security**: Encryption and authentication
- **Project Integration**: Framework detection and templates

### 2. AI Integration
- **Chat Engine**: LLM-powered assistance
- **Template Generation**: AI-driven code generation
- **Documentation**: Intelligent documentation processing
- **Analysis**: Project and framework analysis

### 3. Platform Support
- **Desktop**: Windows, macOS, Linux optimization
- **Mobile**: iOS and Android native features
- **VSCode Extension**: Editor integration

### 4. Enterprise Features
- **Team Collaboration**: Multi-user support
- **Compliance**: Audit trails and security
- **Advanced Authentication**: SSO and enterprise auth

## 🧪 Testing

### Running Tests

```bash
# Native features testing
yarn test:native

# Integration tests
node scripts/test-integration.js

# VSCode extension testing
cd extensions/vscode && npm test

# Platform-specific testing
yarn test:production
```

### Test Coverage Areas

- **Security**: Encryption, authentication, vault integrity
- **AI Features**: Chat, template generation, analysis
- **Platform Integration**: Native features, file system access
- **Cross-platform**: Behavior consistency across platforms

## 📱 Platform-Specific Contributions

### Desktop Platforms

#### Windows
- **Native Integration**: Windows APIs, notifications
- **Distribution**: MSI packages, Microsoft Store
- **Testing**: Windows 10/11 compatibility

#### macOS
- **Native Integration**: Keychain, notifications, sandboxing
- **Distribution**: DMG packages, Mac App Store
- **Testing**: Intel and Apple Silicon compatibility

#### Linux
- **Distribution**: AppImage, Flatpak, Snap packages
- **Desktop Integration**: .desktop files, system integration
- **Testing**: Multiple distributions (Ubuntu, Fedora, Arch)

### Mobile Platforms

#### iOS
- **Native Features**: Keychain integration, Face ID/Touch ID
- **Distribution**: App Store submission
- **Testing**: iOS 13+ compatibility

#### Android
- **Native Features**: Keystore integration, biometric auth
- **Distribution**: Play Store, F-Droid
- **Testing**: API 24+ compatibility

## 🔒 Security Considerations

### Security Review Process
1. **Code Review**: All security-related code requires review
2. **Vulnerability Testing**: Security testing for sensitive areas
3. **Audit Trail**: Document security decisions
4. **Responsible Disclosure**: Follow security reporting guidelines

### Sensitive Areas
- **Encryption/Decryption**: Vault security implementation
- **Authentication**: Master password handling
- **Native Integration**: Platform-specific security features
- **Network Communication**: API provider integrations

## 📝 Documentation

### Required Documentation
- **Code Comments**: Document complex algorithms and security decisions
- **API Documentation**: Update for new Tauri commands
- **User Guide**: Update for new features
- **Platform Guide**: Platform-specific setup and features

### Documentation Standards
- Use **JSDoc** for TypeScript functions
- Use **Rust doc comments** for public APIs
- Update **README.md** for major changes
- Include **examples** for new features

## 🚀 Release Process

### Version Bumping
1. Update version in `package.json` and `src-tauri/Cargo.toml`
2. Update `CHANGELOG.md` with new changes
3. Create release branch: `release/v1.2.3`
4. Test across all platforms
5. Create Git tag and GitHub release

### Platform Builds
- **Automated**: GitHub Actions handles most builds
- **iOS**: Requires manual Xcode build and submission
- **Android**: Automated with signing keys
- **Desktop**: Cross-compilation via GitHub Actions

## 🤝 Community

### Getting Help
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Security**: security@keykeeper.app for vulnerabilities

### Code of Conduct
We follow the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. Please be respectful and inclusive in all interactions.

## 🎉 Recognition

Contributors are recognized in:
- **CHANGELOG.md** for significant contributions
- **GitHub Contributors** section
- **Release Notes** for major features

Thank you for contributing to KeyKeeper! Your efforts help make secure API key management accessible to developers worldwide.

---

## Quick Reference

### Essential Commands
```bash
yarn tauri:dev          # Start development
yarn tauri:build        # Production build
yarn test:native        # Run tests
yarn build:enterprise   # Enterprise build
```

### Platform Targets
```bash
# Desktop
x86_64-pc-windows-msvc      # Windows x64
aarch64-pc-windows-msvc     # Windows ARM64
x86_64-apple-darwin         # macOS Intel
aarch64-apple-darwin        # macOS Apple Silicon
x86_64-unknown-linux-gnu    # Linux x64
aarch64-unknown-linux-gnu   # Linux ARM64

# Mobile
aarch64-apple-ios           # iOS
aarch64-linux-android       # Android ARM64
```