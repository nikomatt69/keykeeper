// scripts/test-native-features.js
const { invoke } = require('@tauri-apps/api/core')

/**
 * Test script per verificare tutte le funzionalità native
 * Questo script deve essere eseguito in un ambiente Tauri
 */

async function testNativeFeatures() {
  console.log('🧪 Testing KeyKeeper Native Features...')
  
  const tests = []
  
  // Test 1: Device Info
  try {
    const deviceInfo = await invoke('get_device_info')
    console.log('✅ Device Info:', deviceInfo)
    tests.push({ name: 'Device Info', status: 'PASS' })
  } catch (error) {
    console.error('❌ Device Info failed:', error)
    tests.push({ name: 'Device Info', status: 'FAIL', error })
  }
  
  // Test 2: Keyring Operations
  try {
    await invoke('keyring_set', {
      service: 'keykeeper_test',
      account: 'test_account',
      password: 'test_password'
    })
    
    const retrievedPassword = await invoke('keyring_get', {
      service: 'keykeeper_test',
      account: 'test_account'
    })
    
    if (retrievedPassword === 'test_password') {
      console.log('✅ Keyring operations work correctly')
      tests.push({ name: 'Keyring Operations', status: 'PASS' })
    } else {
      throw new Error('Password mismatch')
    }
    
    // Cleanup
    await invoke('keyring_delete', {
      service: 'keykeeper_test',
      account: 'test_account'
    })
    
  } catch (error) {
    console.error('❌ Keyring operations failed:', error)
    tests.push({ name: 'Keyring Operations', status: 'FAIL', error })
  }
  
  // Test 3: Notifications
  try {
    await invoke('show_notification', {
      title: 'KeyKeeper Test',
      body: 'Native notifications are working!'
    })
    console.log('✅ Notifications working')
    tests.push({ name: 'Notifications', status: 'PASS' })
  } catch (error) {
    console.error('❌ Notifications failed:', error)
    tests.push({ name: 'Notifications', status: 'FAIL', error })
  }
  
  // Test 4: Auto-start
  try {
    const isEnabled = await invoke('is_auto_start_enabled')
    console.log('✅ Auto-start status:', isEnabled)
    tests.push({ name: 'Auto-start Check', status: 'PASS' })
  } catch (error) {
    console.error('❌ Auto-start check failed:', error)
    tests.push({ name: 'Auto-start Check', status: 'FAIL', error })
  }
  
  // Test 5: Updates
  try {
    const updateInfo = await invoke('check_for_updates')
    console.log('✅ Update check:', updateInfo)
    tests.push({ name: 'Update Check', status: 'PASS' })
  } catch (error) {
    console.error('❌ Update check failed:', error)
    tests.push({ name: 'Update Check', status: 'FAIL', error })
  }
  
  // Test 6: Window Management
  try {
    await invoke('show_window')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await invoke('hide_window')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await invoke('show_window')
    
    console.log('✅ Window management working')
    tests.push({ name: 'Window Management', status: 'PASS' })
  } catch (error) {
    console.error('❌ Window management failed:', error)
    tests.push({ name: 'Window Management', status: 'FAIL', error })
  }
  
  // Risultati finali
  console.log('\n📊 Test Results:')
  console.log('================')
  
  const passedTests = tests.filter(t => t.status === 'PASS')
  const failedTests = tests.filter(t => t.status === 'FAIL')
  
  tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} ${test.name}: ${test.status}`)
    if (test.error) {
      console.log(`   Error: ${test.error}`)
    }
  })
  
  console.log('\n📈 Summary:')
  console.log(`✅ Passed: ${passedTests.length}`)
  console.log(`❌ Failed: ${failedTests.length}`)
  console.log(`📊 Total: ${tests.length}`)
  
  const successRate = (passedTests.length / tests.length) * 100
  console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`)
  
  if (successRate >= 90) {
    console.log('\n🎉 EXCELLENT! Native features are working correctly!')
  } else if (successRate >= 75) {
    console.log('\n👍 GOOD! Most native features are working, some issues to fix.')
  } else {
    console.log('\n⚠️  WARNING! Multiple native features are not working correctly.')
  }
  
  return tests
}

// Esporta per uso come modulo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testNativeFeatures }
} else {
  // Esegui direttamente se non è un modulo
  testNativeFeatures().catch(console.error)
}
