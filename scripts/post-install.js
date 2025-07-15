#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Rendi eseguibile lo script di setup
const setupScript = path.join(__dirname, 'setup.sh')
if (fs.existsSync(setupScript)) {
  fs.chmodSync(setupScript, 0o755)
  console.log('✅ Script di setup reso eseguibile')
} else {
  console.log('❌ Script di setup non trovato')
}

// Crea .gitkeep nella directory icons se vuota
const iconsDir = path.join(__dirname, '../src-tauri/icons')
if (fs.existsSync(iconsDir)) {
  const files = fs.readdirSync(iconsDir)
  if (files.length === 0) {
    fs.writeFileSync(path.join(iconsDir, '.gitkeep'), '')
    console.log('✅ Creato .gitkeep in icons directory')
  }
}

console.log('🎉 Post-install setup completato!')
