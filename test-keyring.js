// Simple test script to verify keyring functionality
const { invoke } = require('@tauri-apps/api/tauri')

async function testKeyring() {
  try {
    console.log('🔐 Testing keyring functionality...')
    
    // Test 1: Check if master password exists
    console.log('1. Checking if master password exists in keyring...')
    const hasPassword = await invoke('get_master_password_from_keyring')
    console.log('   Result:', hasPassword ? 'Password found' : 'No password found')
    
    // Test 2: Try to save a test password
    console.log('2. Attempting to save test password to keyring...')
    try {
      await invoke('save_master_password_to_keyring', { password: 'test-password-123' })
      console.log('   ✅ Password saved successfully!')
      
      // Test 3: Try to retrieve the password
      console.log('3. Attempting to retrieve password from keyring...')
      const retrievedPassword = await invoke('get_master_password_from_keyring')
      console.log('   Retrieved password:', retrievedPassword)
      
      if (retrievedPassword === 'test-password-123') {
        console.log('   ✅ Password retrieved correctly!')
      } else {
        console.log('   ❌ Password mismatch!')
      }
      
      // Test 4: Clean up - delete test password
      console.log('4. Cleaning up test password...')
      await invoke('delete_master_password_from_keyring')
      console.log('   ✅ Test password deleted!')
      
    } catch (error) {
      console.error('   ❌ Error during keyring operations:', error)
    }
    
  } catch (error) {
    console.error('❌ Keyring test failed:', error)
  }
}

// Run the test
testKeyring()
