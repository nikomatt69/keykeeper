#!/bin/bash

# KeyKeeper Icon Generation Script
# This script generates app icons for all platforms supported by Tauri

echo "🎨 Generating KeyKeeper icons for all platforms..."

# Check if we have a source icon
if [ ! -f "assets/icon.png" ]; then
    echo "❌ Source icon not found at assets/icon.png"
    echo "Creating a placeholder icon..."
    
    # Create assets directory if it doesn't exist
    mkdir -p assets
    
    # Create a simple placeholder icon using ImageMagick (if available)
    if command -v convert &> /dev/null; then
        convert -size 512x512 xc:transparent -fill '#4F46E5' -draw 'roundrectangle 50,50 462,462 50,50' -fill white -pointsize 200 -gravity center -annotate +0+0 'K' assets/icon.png
        echo "✅ Created placeholder icon at assets/icon.png"
    else
        echo "❌ ImageMagick not found. Please install it or provide a 512x512 PNG icon at assets/icon.png"
        exit 1
    fi
fi

# Check if Tauri CLI is available
if ! command -v tauri &> /dev/null; then
    echo "❌ Tauri CLI not found. Installing..."
    npm install -g @tauri-apps/cli@latest
fi

# Generate icons using Tauri CLI
echo "📱 Generating icons with Tauri CLI..."
tauri icon assets/icon.png

if [ $? -eq 0 ]; then
    echo "✅ Icons generated successfully!"
    echo "📁 Icons saved to: src-tauri/icons/"
    
    # List generated icons
    echo "Generated icons:"
    ls -la src-tauri/icons/
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Review the generated icons in src-tauri/icons/"
    echo "2. Customize the source icon at assets/icon.png if needed"
    echo "3. Re-run this script to regenerate icons"
    echo "4. Test the app build: yarn tauri:build"
else
    echo "❌ Icon generation failed"
    exit 1
fi