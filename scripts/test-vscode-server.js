#!/usr/bin/env node

// Test script to verify the VSCode HTTP server integration
// This simulates what the VSCode extension will do

const axios = require('axios');

const KEYKEEPER_SERVER = 'http://127.0.0.1:27182';

async function testServerConnection() {
    console.log('🔍 Testing KeyKeeper VSCode Server Integration\n');
    console.log('=============================================\n');
    
    try {
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${KEYKEEPER_SERVER}/health`);
        console.log('✅ Health check:', healthResponse.data);
        
        // Test 2: Get API keys (this will fail if vault is locked, which is expected)
        console.log('\n2. Testing API keys endpoint...');
        try {
            const keysResponse = await axios.get(`${KEYKEEPER_SERVER}/api/keys`);
            console.log('✅ API keys:', keysResponse.data.length || 0, 'keys found');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('⚠️  Vault is locked (expected behavior)');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }
        
        // Test 3: Test .env parsing endpoint
        console.log('\n3. Testing .env parsing endpoint...');
        const testEnvPath = '/Users/nikoemme/keykeeper/test_projects/nextjs-app/.env.local';
        
        try {
            const parseResponse = await axios.post(`${KEYKEEPER_SERVER}/api/env/parse`, {
                filePath: testEnvPath
            });
            console.log('✅ .env parsing successful');
            console.log('   Project:', parseResponse.data.project_path);
            console.log('   File:', parseResponse.data.file_name);
            console.log('   Variables:', parseResponse.data.keys.length);
            console.log('   Secrets:', parseResponse.data.keys.filter(k => k.is_secret).length);
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('⚠️  Vault is locked (expected behavior)');
            } else {
                console.log('❌ Parse error:', error.message);
            }
        }
        
        // Test 4: Test project associations endpoint
        console.log('\n4. Testing project associations endpoint...');
        try {
            const assocResponse = await axios.get(`${KEYKEEPER_SERVER}/api/env/associations`);
            console.log('✅ Associations retrieved:', assocResponse.data.length || 0, 'associations');
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('⚠️  Vault is locked (expected behavior)');
            } else {
                console.log('❌ Association error:', error.message);
            }
        }
        
        // Test 5: Test project activation endpoint
        console.log('\n5. Testing project activation endpoint...');
        try {
            const activateResponse = await axios.post(`${KEYKEEPER_SERVER}/api/projects/activate`, {
                projectPath: '/Users/nikoemme/keykeeper/test_projects/nextjs-app'
            });
            console.log('✅ Project activation:', activateResponse.data);
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('⚠️  Vault is locked (expected behavior)');
            } else {
                console.log('❌ Activation error:', error.message);
            }
        }
        
        console.log('\n🎉 VSCode server integration test completed!');
        console.log('\n📝 Notes:');
        console.log('• If vault is locked, most endpoints will return 403 (this is correct behavior)');
        console.log('• To test full functionality, unlock the vault in the desktop app first');
        console.log('• The server should be running on port 27182 when the desktop app is open');
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Cannot connect to KeyKeeper server.');
            console.log('   Make sure the KeyKeeper desktop app is running!');
            console.log('   The app should start the VSCode server on port 27182.');
        } else {
            console.log('❌ Unexpected error:', error.message);
        }
        
        console.log('\n💡 To start the KeyKeeper app:');
        console.log('   cd /Users/nikoemme/keykeeper');
        console.log('   yarn tauri:dev');
    }
}

// Run the test
testServerConnection();