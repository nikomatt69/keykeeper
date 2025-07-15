#!/bin/bash

# Script per creare icone placeholder temporanee per KeyKeeper

echo "🎨 Creazione icone placeholder per KeyKeeper..."

# Crea un'icona SVG semplice
cat > /tmp/keykeeper-icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0ea5e9" rx="20"/>
  <path d="M30 45 L35 40 L65 40 L70 45 L70 60 L65 65 L35 65 L30 60 Z" fill="white"/>
  <circle cx="50" cy="52" r="6" fill="#0ea5e9"/>
  <rect x="47" y="55" width="6" height="8" fill="#0ea5e9"/>
  <text x="50" y="80" text-anchor="middle" fill="white" font-family="Arial" font-size="8">K</text>
</svg>
EOF

# Crea directory se non esiste
mkdir -p src-tauri/icons

# Messaggio per l'utente
echo "📝 Icona SVG creata in /tmp/keykeeper-icon.svg"
echo ""
echo "Per completare la configurazione delle icone:"
echo "1. Installa ImageMagick (se non presente):"
echo "   brew install imagemagick  # su macOS"
echo "   sudo apt-get install imagemagick  # su Ubuntu"
echo ""
echo "2. Converti l'SVG in PNG e genera le icone:"
echo "   convert /tmp/keykeeper-icon.svg -resize 1024x1024 /tmp/keykeeper-icon.png"
echo "   yarn tauri icon /tmp/keykeeper-icon.png"
echo ""
echo "Oppure usa l'icona SVG direttamente con un tool online per convertirla in PNG 1024x1024"
echo "e poi esegui: yarn tauri icon path/to/your/icon.png"
echo ""
echo "🚀 Una volta generate le icone, puoi avviare l'app con:"
echo "   yarn tauri:dev"