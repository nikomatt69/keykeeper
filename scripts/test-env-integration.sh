#!/bin/bash

# ===================================
# KEYKEEPER - TEST ENV INTEGRATION
# ===================================
#
# Script per testare l'integrazione .env 
# con drag & drop e auto-detection VSCode
#
# ===================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$ROOT_DIR/test_projects"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 KeyKeeper ENV Integration Test${NC}"
echo "=================================="

# Create test directory structure
echo -e "${YELLOW}📁 Creating test project structure...${NC}"

mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create test projects
for project in "nextjs-app" "react-native-app" "rust-api"; do
    echo -e "  Creating $project..."
    mkdir -p "$project"
    cd "$project"
    
    case $project in
        "nextjs-app")
            # Create Next.js project structure
            cat > package.json << EOF
{
  "name": "test-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
EOF
            
            # Create .env files
            cat > .env.local << EOF
# Next.js Local Environment
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ANALYTICS_ID=UA-12345-1

# API Keys (these should be detected as secrets)
OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef
STRIPE_SECRET_KEY=sk_test_1234567890abcdef1234567890abcdef
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=super-secret-jwt-key-that-should-be-detected
WEBHOOK_SECRET=whsec_1234567890abcdef1234567890abcdef

# Non-secret configuration
NODE_ENV=development
PORT=3000
ENABLE_LOGGING=true
EOF

            cat > .env.production << EOF
# Next.js Production Environment
NEXT_PUBLIC_API_URL=https://api.myapp.com
NEXT_PUBLIC_ANALYTICS_ID=UA-67890-2

# Production API Keys (secrets)
OPENAI_API_KEY=sk-prod-1234567890abcdef1234567890abcdef
STRIPE_SECRET_KEY=sk_live_1234567890abcdef1234567890abcdef
DATABASE_URL=postgresql://produser:prodpass@prod.db.com:5432/proddb
JWT_SECRET=super-secure-production-jwt-key
WEBHOOK_SECRET=whsec_prod_1234567890abcdef1234567890abcdef

# Production configuration
NODE_ENV=production
PORT=80
ENABLE_LOGGING=false
EOF
            ;;
            
        "react-native-app")
            # Create React Native project structure
            cat > package.json << EOF
{
  "name": "test-react-native-app",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "start": "react-native start"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.6"
  }
}
EOF
            
            cat > .env << EOF
# React Native Environment
API_BASE_URL=https://api.myapp.com

# API Keys (should be detected)
GOOGLE_MAPS_API_KEY=AIzaSyC1234567890abcdef1234567890abcdef
FACEBOOK_APP_ID=1234567890123456
FIREBASE_API_KEY=AIzaSyF1234567890abcdef1234567890abcdef
PUSHER_KEY=1234567890abcdef1234
SENTRY_DSN=https://1234567890abcdef@sentry.io/1234567

# Configuration
ENVIRONMENT=development
DEBUG_MODE=true
EOF
            ;;
            
        "rust-api")
            # Create Rust project structure
            cat > Cargo.toml << EOF
[package]
name = "test-rust-api"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = "1.0"
serde = "1.0"
EOF
            
            cat > .env << EOF
# Rust API Environment
HOST=0.0.0.0
PORT=8080

# Database and API Keys (secrets)
DATABASE_URL=postgres://user:password@localhost/myapp
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-super-secret-jwt-key-here
API_SECRET_KEY=your-api-secret-key-here
ENCRYPTION_KEY=your-32-byte-encryption-key-here!!
OAUTH_CLIENT_SECRET=oauth-client-secret-1234567890

# Third-party API Keys
SENDGRID_API_KEY=SG.1234567890abcdef.1234567890abcdef
AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF
AWS_SECRET_ACCESS_KEY=1234567890abcdef1234567890abcdef1234567890
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef

# Configuration (non-secrets)
LOG_LEVEL=info
RUST_LOG=debug
WORKERS=4
EOF
            ;;
    esac
    
    cd ..
done

echo -e "${GREEN}✅ Test projects created successfully!${NC}"
echo ""

# Show test instructions
echo -e "${YELLOW}🎯 Testing Instructions:${NC}"
echo "========================"
echo ""
echo -e "${BLUE}1. Desktop App Testing:${NC}"
echo "   • Open KeyKeeper desktop app"
echo "   • Drag & drop any .env file from test_projects/ into the app"
echo "   • Verify that:"
echo "     - File is parsed correctly"
echo "     - Project path is detected automatically"
echo "     - Secret variables are identified"
echo "     - Association is created"
echo ""

echo -e "${BLUE}2. VSCode Extension Testing:${NC}"
echo "   • Open VSCode"
echo "   • Open any test project folder (nextjs-app, react-native-app, rust-api)"
echo "   • Verify that:"
echo "     - Extension activates automatically if .env was imported"
echo "     - Notification shows associated .env files"
echo "     - API keys are available in the extension"
echo "     - Project context is activated in KeyKeeper"
echo ""

echo -e "${BLUE}3. File Watching Testing:${NC}"
echo "   • Create a new .env file in any test project"
echo "   • Verify that:"
echo "     - VSCode extension detects the new file"
echo "     - Offers to import it into KeyKeeper"
echo "     - Updates associations correctly"
echo ""

echo -e "${BLUE}4. Multi-Project Testing:${NC}"
echo "   • Import .env files from all test projects"
echo "   • Switch between different project folders in VSCode"
echo "   • Verify that:"
echo "     - Extension context switches correctly"
echo "     - Only relevant API keys are shown"
echo "     - Project associations are maintained"
echo ""

# Show file locations
echo -e "${YELLOW}📍 Test Project Locations:${NC}"
echo "=========================="
for project in "nextjs-app" "react-native-app" "rust-api"; do
    echo -e "  ${BLUE}$project:${NC} $TEST_DIR/$project"
done
echo ""

# Show sample .env content
echo -e "${YELLOW}📄 Sample .env Files Created:${NC}"
echo "============================="
echo ""

echo -e "${BLUE}nextjs-app/.env.local${NC} (11 variables, 5 secrets):"
echo "  OPENAI_API_KEY, STRIPE_SECRET_KEY, DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET"
echo ""

echo -e "${BLUE}react-native-app/.env${NC} (7 variables, 5 secrets):"
echo "  GOOGLE_MAPS_API_KEY, FACEBOOK_APP_ID, FIREBASE_API_KEY, PUSHER_KEY, SENTRY_DSN"
echo ""

echo -e "${BLUE}rust-api/.env${NC} (13 variables, 8 secrets):"
echo "  DATABASE_URL, JWT_SECRET_KEY, API_SECRET_KEY, ENCRYPTION_KEY, etc."
echo ""

# Performance test
echo -e "${YELLOW}⚡ Performance Testing:${NC}"
echo "======================="
echo "• Test with large .env files (100+ variables)"
echo "• Test concurrent drag & drop operations"
echo "• Test rapid project switching in VSCode"
echo "• Monitor memory usage and response times"
echo ""

# Security test
echo -e "${YELLOW}🔒 Security Testing:${NC}"
echo "==================="
echo "• Verify secret detection accuracy"
echo "• Test with various API key formats"
echo "• Check file path sanitization"
echo "• Verify encrypted storage of imported keys"
echo ""

echo -e "${GREEN}🚀 Ready to test! Follow the instructions above.${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "• Enable debug mode in both desktop app and VSCode extension"
echo "• Monitor the console for detailed logs"
echo "• Test error scenarios (invalid files, network issues, etc.)"
echo "• Verify cross-platform compatibility (macOS, Windows, Linux)"

# Create a cleanup script
cat > "$ROOT_DIR/scripts/cleanup-test-env.sh" << 'EOF'
#!/bin/bash
echo "🧹 Cleaning up test environment..."
rm -rf "$(dirname "$0")/../test_projects"
echo "✅ Test projects removed!"
EOF

chmod +x "$ROOT_DIR/scripts/cleanup-test-env.sh"

echo ""
echo -e "${BLUE}📝 To clean up test files later, run:${NC}"
echo "   ./scripts/cleanup-test-env.sh"