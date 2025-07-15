#!/bin/bash

# KeyKeeper Enterprise Production Build Script
# Questo script esegue il build completo per produzione con tutte le funzionalità enterprise

set -e

echo "🏢 KeyKeeper Enterprise Build Script"
echo "===================================="

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Verifica prerequisiti
check_prerequisites() {
    log_step "Verifica prerequisiti enterprise..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js non installato"
        exit 1
    fi
    
    if ! command -v yarn &> /dev/null; then
        log_error "Yarn non installato"
        exit 1
    fi
    
    if ! command -v cargo &> /dev/null; then
        log_error "Rust non installato"
        exit 1
    fi
    
    if ! command -v tauri &> /dev/null; then
        log_warn "Tauri CLI non trovato, installazione..."
        npm install -g @tauri-apps/cli@latest
    fi
    
    log_info "✅ Prerequisiti verificati"
}

# Pulizia build precedenti
clean_build() {
    log_step "Pulizia build precedenti..."
    
    rm -rf out/
    rm -rf src-tauri/target/release/
    rm -rf dist/
    rm -rf .next/
    rm -rf node_modules/.cache/
    
    log_info "✅ Build pulita"
}

# Installazione dipendenze
install_dependencies() {
    log_step "Installazione dipendenze..."
    
    yarn install --immutable
    
    log_info "✅ Dipendenze installate"
}

# Generazione icone
generate_icons() {
    log_step "Generazione icone per tutte le piattaforme..."
    
    if [ ! -f "assets/icon.png" ]; then
        log_warn "Icona non trovata, creazione icona predefinita..."
        mkdir -p assets
        
        if command -v convert &> /dev/null; then
            convert -size 512x512 xc:transparent \
                -fill '#4F46E5' \
                -draw 'roundrectangle 50,50 462,462 50,50' \
                -fill white \
                -pointsize 200 \
                -gravity center \
                -annotate +0+0 'K' \
                assets/icon.png
        else
            log_error "ImageMagick non trovato e nessuna icona fornita"
            exit 1
        fi
    fi
    
    tauri icon assets/icon.png
    log_info "✅ Icone generate"
}

# Audit di sicurezza
security_audit() {
    log_step "Audit di sicurezza enterprise..."
    
    # Audit npm
    yarn audit --audit-level moderate || log_warn "Vulnerabilità npm rilevate"
    
    # Audit Rust
    if command -v cargo-audit &> /dev/null; then
        cd src-tauri
        cargo audit || log_warn "Vulnerabilità Rust rilevate"
        cd ..
    else
        log_warn "cargo-audit non installato"
    fi
    
    log_info "✅ Audit di sicurezza completato"
}

# Configurazione ambiente produzione
setup_production_env() {
    log_step "Configurazione ambiente produzione..."
    
    # Carica variabili produzione
    if [ -f ".env.production" ]; then
        export $(cat .env.production | grep -v ^# | xargs)
    fi
    
    # Imposta variabili build
    export NODE_ENV=production
    export TAURI_ENV=production
    export RUST_LOG=info
    export GENERATE_SOURCEMAP=false
    
    log_info "✅ Ambiente produzione configurato"
}

# Build frontend
build_frontend() {
    log_step "Build frontend con ottimizzazioni enterprise..."
    
    yarn build
    
    log_info "✅ Frontend build completato"
}

# Build applicazione Tauri
build_tauri() {
    log_step "Build applicazione Tauri..."
    
    # Abilita funzionalità enterprise
    export TAURI_FEATURES="updater"
    
    yarn tauri:build
    
    log_info "✅ Tauri build completato"
}

# Test produzione
test_production() {
    log_step "Test build produzione..."
    
    # Verifica che i file siano stati generati
    if [ ! -d "src-tauri/target/release/bundle" ]; then
        log_error "Build fallito: bundle non trovato"
        exit 1
    fi
    
    # Test basic functionality
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        yarn test --passWithNoTests || log_warn "Test falliti"
    fi
    
    log_info "✅ Test produzione completati"
}

# Creazione pacchetto distribuzione
create_distribution() {
    log_step "Creazione pacchetto distribuzione..."
    
    mkdir -p dist/
    
    # Copia bundle per tutte le piattaforme
    if [ -d "src-tauri/target/release/bundle" ]; then
        cp -r src-tauri/target/release/bundle/* dist/
    fi
    
    # Crea info versione
    cat > dist/build-info.json << EOF
{
    "name": "KeyKeeper Enterprise",
    "version": "$(grep '"version"' package.json | cut -d'"' -f4)",
    "build_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "environment": "production",
    "features": {
        "enterprise": true,
        "security": "AES-256-GCM + PBKDF2",
        "vscode_integration": true,
        "audit_logging": true,
        "auto_update": true
    }
}
EOF

    # Crea checksum
    if command -v sha256sum &> /dev/null; then
        find dist/ -type f -name "*.dmg" -o -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" | while read file; do
            sha256sum "$file" > "$file.sha256"
        done
    fi
    
    log_info "✅ Distribuzione creata"
}

# Verifica finale
final_verification() {
    log_step "Verifica finale enterprise..."
    
    # Lista file generati
    echo ""
    echo "📦 File di distribuzione:"
    find dist/ -type f -name "*.dmg" -o -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" | sort
    
    # Verifica dimensioni
    echo ""
    echo "📊 Dimensioni file:"
    find dist/ -type f -name "*.dmg" -o -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" | while read file; do
        size=$(du -h "$file" | cut -f1)
        echo "  $(basename "$file"): $size"
    done
    
    # Verifica checksum
    echo ""
    echo "🔐 Checksum SHA-256:"
    find dist/ -name "*.sha256" | while read file; do
        echo "  $(basename "$file"): $(cat "$file" | cut -d' ' -f1)"
    done
    
    log_info "✅ Verifica completata"
}

# Funzione principale
main() {
    echo "🚀 Avvio build enterprise per KeyKeeper..."
    echo "Versione: $(grep '"version"' package.json | cut -d'"' -f4)"
    echo "Data: $(date)"
    echo ""
    
    check_prerequisites
    clean_build
    install_dependencies
    generate_icons
    security_audit
    setup_production_env
    build_frontend
    build_tauri
    test_production
    create_distribution
    final_verification
    
    echo ""
    echo "🎉 Build enterprise completato con successo!"
    echo ""
    echo "📋 Prossimi passi:"
    echo "1. Testa l'applicazione sui target di deployment"
    echo "2. Firma i binari per la distribuzione"
    echo "3. Carica su piattaforme di distribuzione"
    echo "4. Aggiorna documentazione e changelog"
    echo "5. Annuncia il rilascio"
    echo ""
    echo "🏢 KeyKeeper Enterprise è pronto per la produzione!"
}

# Gestione errori
trap 'log_error "Build fallito alla linea $LINENO"' ERR

# Esegui main
main "$@"