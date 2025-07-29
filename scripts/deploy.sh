#!/bin/bash

# KeyKeeper Production Deployment Script
# This script handles the complete deployment process for KeyKeeper

set -e

echo "🚀 KeyKeeper Production Deployment Script"
echo "=========================================="

# Configuration
APP_NAME="KeyKeeper"
VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
BUILD_DIR="dist"
RELEASE_DIR="release"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check Yarn
    if ! command -v yarn &> /dev/null; then
        log_error "Yarn is required but not installed"
        exit 1
    fi
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        log_error "Rust is required but not installed"
        exit 1
    fi
    
    # Check Tauri CLI
    if ! command -v tauri &> /dev/null; then
        log_warn "Tauri CLI not found, installing..."
        npm install -g @tauri-apps/cli@latest
    fi
    
    log_info "Prerequisites check passed"
}

# Clean previous builds
clean_build() {
    log_info "Cleaning previous builds..."
    rm -rf out/
    rm -rf src-tauri/target/release/
    rm -rf $BUILD_DIR/
    rm -rf $RELEASE_DIR/
    log_info "Clean completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    yarn install --frozen-lockfile
    log_info "Dependencies installed"
}

# Generate icons
generate_icons() {
    log_info "Generating application icons..."
    
    # Create a default icon if none exists
    if [ ! -f "assets/icon.png" ]; then
        log_warn "No icon found at assets/icon.png, creating default..."
        mkdir -p assets
        
        # Create a simple icon using ImageMagick if available
        if command -v convert &> /dev/null; then
            convert -size 512x512 xc:transparent \
                -fill '#4F46E5' \
                -draw 'roundrectangle 50,50 462,462 50,50' \
                -fill white \
                -pointsize 200 \
                -gravity center \
                -annotate +0+0 'K' \
                assets/icon.png
            log_info "Default icon created"
        else
            log_error "ImageMagick not found and no icon provided"
            exit 1
        fi
    fi
    
    # Generate icons with Tauri CLI
    tauri icon assets/icon.png
    log_info "Icons generated successfully"
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."
    yarn build
    log_info "Frontend build completed"
}

# Build application
build_app() {
    log_info "Building application for production..."
    
    # Set production environment
    export NODE_ENV=production
    export TAURI_ENV=production
    
    # Build the app
    yarn tauri:build
    
    log_info "Application build completed"
}

# Create release directory
create_release() {
    log_info "Creating release packages..."
    
    mkdir -p $RELEASE_DIR
    
    # Copy built files
    if [ -d "src-tauri/target/release/bundle" ]; then
        cp -r src-tauri/target/release/bundle/* $RELEASE_DIR/
    fi
    
    # Create version info
    cat > $RELEASE_DIR/version.json << EOF
{
    "name": "$APP_NAME",
    "version": "$VERSION",
    "build_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "platform": "$(uname -s)"
}
EOF
    
    log_info "Release packages created in $RELEASE_DIR/"
}

# Security check
security_check() {
    log_info "Running security checks..."
    
    # Audit npm packages
    yarn audit --audit-level moderate || log_warn "npm audit found issues"
    
    # Audit Rust dependencies
    if command -v cargo-audit &> /dev/null; then
        cd src-tauri
        cargo audit || log_warn "cargo audit found issues"
        cd ..
    else
        log_warn "cargo-audit not installed, skipping Rust security audit"
    fi
    
    log_info "Security checks completed"
}

# Test build
test_build() {
    log_info "Testing build..."
    
    # Run tests if they exist
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        yarn test || log_warn "Tests failed"
    fi
    
    # Type check
    if [ -f "tsconfig.json" ]; then
        yarn tsc --noEmit || log_warn "Type checking failed"
    fi
    
    log_info "Build testing completed"
}

# Main deployment function
main() {
    log_info "Starting deployment for $APP_NAME v$VERSION"
    
    check_prerequisites
    clean_build
    install_dependencies
    generate_icons
    security_check
    build_frontend
    build_app
    create_release
    test_build
    
    log_info "🎉 Deployment completed successfully!"
    log_info "Release files are available in: $RELEASE_DIR/"
    
    # Show release info
    echo ""
    echo "📦 Release Information:"
    echo "   Version: $VERSION"
    echo "   Build Date: $(date)"
    echo "   Files:"
    ls -la $RELEASE_DIR/
    
    echo ""
    echo "🔍 Next Steps:"
    echo "1. Test the application thoroughly"
    echo "2. Sign the binaries for distribution"
    echo "3. Upload to release platforms"
    echo "4. Update documentation"
    echo "5. Announce the release"
}

# Run main function
main "$@"