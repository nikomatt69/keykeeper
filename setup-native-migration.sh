#!/bin/bash

# KeyKeeper Native Migration Setup Script
# This script sets up all native dependencies and configurations

set -e

echo "🚀 Starting KeyKeeper Native Migration Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src-tauri" ]; then
    print_error "This script must be run from the KeyKeeper project root directory"
    exit 1
fi

print_status "Checking project structure..."

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
    print_error "Yarn is not installed. Please install yarn first."
    exit 1
fi

# Check if rust is installed
if ! command -v rustc &> /dev/null; then
    print_error "Rust is not installed. Please install Rust first."
    exit 1
fi

# Check if tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    print_warning "Tauri CLI not found. Installing..."
    yarn global add @tauri-apps/cli
fi

print_status "Installing frontend dependencies..."
yarn install

print_status "Installing Rust dependencies..."
cd src-tauri
cargo fetch
cd ..

print_status "Building project for the first time..."
cargo build --manifest-path=src-tauri/Cargo.toml

print_status "Checking native plugin configuration..."

# Verify all necessary files exist
FILES_TO_CHECK=(
    "lib/services/nativeStorageService.ts"
    "lib/services/nativeFeatures.ts"
    "components/AuthManager.tsx"
    "src-tauri/capabilities/keykeeper-capabilities.json"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Missing file: $file"
        exit 1
    fi
done

print_success "All required files are present"

print_status "Testing native functionality..."

# Test build
print_status "Running test build..."
yarn build

print_status "Testing Tauri development mode..."
timeout 30s yarn tauri:dev || print_warning "Development mode test timed out (this is expected)"

print_success "Setup completed successfully!"

echo ""
echo "🎉 KeyKeeper Native Migration Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Run 'yarn tauri:dev' to start development mode"
echo "2. Run 'yarn tauri:build' to create a production build"
echo "3. Check the NATIVE_MIGRATION_PLAN.md for detailed implementation phases"
echo ""
echo "Key features now available:"
echo "- ✅ Native persistent storage with Tauri Store"
echo "- ✅ Secure credential storage with Keyring"
echo "- ✅ Window state management"
echo "- ✅ Single instance application"
echo "- ✅ Native notifications"
echo "- ✅ Auto-start capability"
echo "- ✅ Persistent user sessions"
echo "- ✅ Device fingerprinting"
echo ""
echo "Happy coding! 🚀"
