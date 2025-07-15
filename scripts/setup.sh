#!/bin/bash

# KeyKeeper Setup Script (Tauri v2 Beta)
# Questo script automatizza l'installazione e la configurazione di KeyKeeper

set -e

echo "🔐 KeyKeeper Setup Script (Tauri v2 Beta)"
echo "======================================="

# Controlla se Node.js è installato
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non è installato. Per favore installa Node.js 18+ prima di continuare."
    exit 1
fi

# Controlla la versione di Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versione 18+ richiesta. Versione corrente: $(node --version)"
    exit 1
fi

# Controlla se Rust è installato
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust non è installato. Per favore installa Rust 1.70+ prima di continuare."
    echo "Visita: https://rustup.rs/"
    exit 1
fi

# Controlla la versione di Rust
RUST_VERSION=$(rustc --version | cut -d' ' -f2 | cut -d'.' -f1-2)
echo "🦀 Rust versione rilevata: $RUST_VERSION"

# Controlla se Yarn è installato
if ! command -v yarn &> /dev/null; then
    echo "📦 Yarn non trovato. Installazione in corso..."
    npm install -g yarn
fi

echo "✅ Prerequisiti verificati"

# Pulisci cache precedenti
echo "🧹 Pulizia cache precedenti..."
rm -rf node_modules
rm -rf src-tauri/target

# Installa le dipendenze
echo "📦 Installazione dipendenze..."
yarn install

# Verifica che tutto sia installato correttamente
echo "🔍 Verifica installazione..."
if yarn tauri --version &> /dev/null; then
    TAURI_VERSION=$(yarn tauri --version)
    echo "✅ Tauri CLI installato: $TAURI_VERSION"
else
    echo "❌ Problema con l'installazione di Tauri CLI"
    exit 1
fi

# Controlla se le icone esistono
echo "🖼️ Controllo icone..."
if [ ! -f "src-tauri/icons/32x32.png" ] || [ ! -f "src-tauri/icons/icon.ico" ]; then
    echo "⚠️ Icone mancanti! Devi generare le icone prima di avviare l'app."
    echo "   Esegui: yarn tauri icon path/to/your/icon.png"
    echo "   Vedi scripts/generate-icons.md per maggiori dettagli"
fi

echo ""
echo "🎉 Setup completato con successo!"
echo ""
echo "📋 Prossimi passi:"
echo "1. Genera le icone (obbligatorio):"
echo "   yarn tauri icon path/to/your/icon.png"
echo ""
echo "2. Avvia l'applicazione:"
echo "   yarn tauri:dev"
echo ""
echo "📚 Comandi disponibili:"
echo "  yarn tauri:dev    - Avvia in modalità sviluppo"
echo "  yarn tauri:build  - Build per produzione"
echo "  yarn dev          - Solo frontend Next.js"
echo "  yarn build        - Build Next.js"
echo ""
echo "🔧 Tauri v2 Beta Features:"
echo "  ✅ Plugin system modulare"
echo "  ✅ Capabilities per sicurezza"
echo "  ✅ Performance migliorata"
echo "  ✅ API più intuitive"
echo ""
echo "⚠️ Nota: Stai usando Tauri v2 Beta - alcune funzionalità potrebbero non essere stabili."
echo ""
echo "Buon lavoro con KeyKeeper v2 Beta! 🚀"