#!/usr/bin/env node

// Test script to simulate the .env parsing logic from Rust
// This helps validate our secret detection algorithm

const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const variables = [];
    
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        // Parse KEY=VALUE format
        const eqPos = trimmed.indexOf('=');
        if (eqPos === -1) continue;
        
        const name = trimmed.substring(0, eqPos).trim();
        let value = trimmed.substring(eqPos + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        
        // Determine if it's a secret
        const isSecret = isSecretVariable(name, value);
        
        variables.push({
            name,
            value,
            isSecret
        });
    }
    
    return variables;
}

function isSecretVariable(name, value) {
    const nameLower = name.toLowerCase();
    
    // Common secret patterns
    const secretPatterns = [
        'key', 'secret', 'token', 'password', 'pass', 'pwd', 'auth',
        'api_key', 'private', 'credential', 'cert', 'signature',
        'access_token', 'refresh_token', 'client_secret', 'webhook_secret'
    ];
    
    // Check if name contains secret patterns
    const nameIsSecret = secretPatterns.some(pattern => nameLower.includes(pattern));
    
    // Check value patterns (long base64-like strings, UUIDs, etc.)
    const valueLooksSecret = value.length > 20 && 
        (value.match(/^[A-Za-z0-9+/=]+$/) || // base64-like
         (value.includes('-') && value.length > 30)); // UUID-like
    
    return nameIsSecret || valueLooksSecret;
}

function detectProjectPath(envFilePath) {
    let currentDir = path.dirname(envFilePath);
    
    // Project indicators
    const projectIndicators = [
        'package.json', 'Cargo.toml', '.git', 'composer.json',
        'requirements.txt', 'go.mod', 'pom.xml', 'build.gradle'
    ];
    
    // Walk up the directory tree
    while (currentDir !== path.dirname(currentDir)) {
        for (const indicator of projectIndicators) {
            if (fs.existsSync(path.join(currentDir, indicator))) {
                return currentDir;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    
    // If no project indicators found, use the .env file's directory
    return path.dirname(envFilePath);
}

// Test all created .env files
const testProjects = [
    'test_projects/nextjs-app/.env.local',
    'test_projects/nextjs-app/.env.production',
    'test_projects/react-native-app/.env',
    'test_projects/rust-api/.env'
];

console.log('🧪 Testing .env Parser Logic\n');
console.log('============================\n');

for (const envFile of testProjects) {
    const fullPath = path.join(__dirname, '..', envFile);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${envFile}`);
        continue;
    }
    
    console.log(`📄 Testing: ${envFile}`);
    console.log('─'.repeat(50));
    
    try {
        // Parse the file
        const variables = parseEnvFile(fullPath);
        const secrets = variables.filter(v => v.isSecret);
        const configs = variables.filter(v => !v.isSecret);
        
        // Detect project path
        const projectPath = detectProjectPath(fullPath);
        const projectName = path.basename(projectPath);
        
        console.log(`📁 Project: ${projectName}`);
        console.log(`📍 Path: ${projectPath}`);
        console.log(`📊 Total variables: ${variables.length}`);
        console.log(`🔐 Secrets detected: ${secrets.length}`);
        console.log(`⚙️  Config variables: ${configs.length}`);
        
        if (secrets.length > 0) {
            console.log('\n🔐 Detected Secrets:');
            secrets.forEach(secret => {
                const maskedValue = secret.value.length > 10 
                    ? secret.value.substring(0, 8) + '***' + secret.value.slice(-4)
                    : secret.value.substring(0, 4) + '***';
                console.log(`   • ${secret.name} = ${maskedValue}`);
            });
        }
        
        if (configs.length > 0) {
            console.log('\n⚙️  Config Variables:');
            configs.forEach(config => {
                console.log(`   • ${config.name} = ${config.value}`);
            });
        }
        
        // Simulate the DroppedEnvFile structure
        const result = {
            path: fullPath,
            project_path: projectPath,
            file_name: path.basename(fullPath),
            keys: variables
        };
        
        console.log('\n✅ Parse Result:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.log(`❌ Error parsing ${envFile}: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// Test secret detection accuracy
console.log('🎯 Secret Detection Accuracy Test\n');
console.log('===================================\n');

const testCases = [
    // Should be detected as secrets
    { name: 'OPENAI_API_KEY', value: 'sk-1234567890abcdef', expected: true },
    { name: 'JWT_SECRET', value: 'super-secret-key', expected: true },
    { name: 'DATABASE_PASSWORD', value: 'mypassword123', expected: true },
    { name: 'WEBHOOK_SECRET', value: 'whsec_1234567890abcdef', expected: true },
    { name: 'PRIVATE_KEY', value: '-----BEGIN PRIVATE KEY-----', expected: true },
    
    // Should NOT be detected as secrets
    { name: 'NODE_ENV', value: 'development', expected: false },
    { name: 'PORT', value: '3000', expected: false },
    { name: 'ENABLE_LOGGING', value: 'true', expected: false },
    { name: 'API_VERSION', value: 'v1', expected: false },
    { name: 'TIMEOUT', value: '30', expected: false },
];

let correct = 0;
let total = testCases.length;

testCases.forEach(testCase => {
    const detected = isSecretVariable(testCase.name, testCase.value);
    const isCorrect = detected === testCase.expected;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(`${status} ${testCase.name}: ${detected ? 'SECRET' : 'CONFIG'} (expected: ${testCase.expected ? 'SECRET' : 'CONFIG'})`);
    
    if (isCorrect) correct++;
});

console.log(`\n📊 Accuracy: ${correct}/${total} (${Math.round(correct/total*100)}%)`);

if (correct === total) {
    console.log('🎉 Perfect accuracy! Secret detection is working correctly.');
} else {
    console.log('⚠️  Some test cases failed. Algorithm may need refinement.');
}