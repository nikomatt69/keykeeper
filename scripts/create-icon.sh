#!/bin/bash

# Script semplice per creare icone placeholder con strumenti macOS

echo "🎨 Creazione icone placeholder per KeyKeeper (macOS)..."

# Crea directory se non esiste
mkdir -p src-tauri/icons

# Crea icone PNG semplici usando il comando 'sips' di macOS
# Queste sono solo placeholder - per produzione usa icone vere

echo "📝 Creazione icone placeholder..."

# Crea un'icona base 1024x1024 (blu semplice)
cat > /tmp/keykeeper-icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#0ea5e9" rx="200"/>
  <rect x="312" y="450" width="400" height="150" fill="white" rx="30"/>
  <circle cx="512" cy="525" r="40" fill="#0ea5e9"/>
  <rect x="480" y="540" width="64" height="80" fill="#0ea5e9" rx="10"/>
  <text x="512" y="750" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="120" font-weight="bold">K</text>
</svg>
EOF

# Messaggio per l'utente
echo "📁 Icona SVG creata in /tmp/keykeeper-icon.svg"
echo ""
echo "💡 Per convertire SVG in PNG e generare le icone:"
echo ""
echo "Opzione 1 - Se hai ImageMagick installato:"
echo "  brew install imagemagick"
echo "  convert /tmp/keykeeper-icon.svg -resize 1024x1024 /tmp/keykeeper-icon.png"
echo "  yarn tauri icon /tmp/keykeeper-icon.png"
echo ""
echo "Opzione 2 - Usa un tool online:"
echo "  1. Apri https://convertio.co/svg-png/"
echo "  2. Carica /tmp/keykeeper-icon.svg"
echo "  3. Scarica il PNG risultante"
echo "  4. Esegui: yarn tauri icon path/to/downloaded/icon.png"
echo ""
echo "Opzione 3 - Usa il tuo design:"
echo "  1. Crea un'icona PNG 1024x1024 personalizzata"
echo "  2. Esegui: yarn tauri icon path/to/your/icon.png"
echo ""
echo "🚀 Dopo aver generato le icone:"
echo "   yarn tauri:dev"
echo ""
echo "📂 Il file SVG è disponibile in /tmp/keykeeper-icon.svg"

# Mostra l'icona SVG se possibile
if command -v open &> /dev/null; then
    echo "🖼️ Aprendo l'icona SVG..."
    open /tmp/keykeeper-icon.svg
fi