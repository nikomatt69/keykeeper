// Reset script to clear all authentication data for testing
const { invoke } = require('@tauri-apps/api/tauri')

async function resetAuth() {
  try {
    console.log('🔄 Resetting authentication data...')
    
    // 1. Delete master password from keyring
    console.log('1. Deleting master password from keyring...')
    try {
      await invoke('delete_master_password_from_keyring')
      console.log('   ✅ Keyring cleared')
    } catch (error) {
      console.log('   ⚠️  Keyring already empty or error:', error)
    }
    
    // 2. Reset vault (if command exists)
    console.log('2. Attempting to reset vault...')
    try {
      await invoke('reset_vault')
      console.log('   ✅ Vault reset')
    } catch (error) {
      console.log('   ⚠️  Vault reset failed or command not found:', error)
    }
    
    console.log('🎉 Reset complete! Restart the app to test fresh setup.')
    
  } catch (error) {
    console.error('❌ Reset failed:', error)
  }
}

// Run the reset
resetAuth()
