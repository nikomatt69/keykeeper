#!/usr/bin/env node

/**
 * KeyKeeper Integration Test Script
 * Tests the communication between the desktop app and VSCode extension
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:27182';
const TEST_TIMEOUT = 5000;

// Test data
const TEST_ENV_FILE = path.join(__dirname, '../test_projects/test.env');
const TEST_ENV_CONTENT = `
# Test environment file
API_KEY=sk-test123456789abcdef
DATABASE_URL=postgresql://user:password@localhost:5432/testdb
DEBUG=true
PORT=3000
SECRET_TOKEN=super-secret-token-12345
NON_SECRET_VALUE=just-a-value
`;

class IntegrationTester {
    constructor() {
        this.results = [];
        this.errors = [];
    }

    async test(name, testFn) {
        console.log(`\n🧪 Testing: ${name}`);
        try {
            const start = Date.now();
            await testFn();
            const duration = Date.now() - start;
            console.log(`✅ ${name} - Passed (${duration}ms)`);
            this.results.push({ name, status: 'PASS', duration });
        } catch (error) {
            console.log(`❌ ${name} - Failed: ${error.message}`);
            this.results.push({ name, status: 'FAIL', error: error.message });
            this.errors.push({ test: name, error });
        }
    }

    async httpRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 27182,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'KeyKeeper-Integration-Test/1.0.0'
                }
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: responseData ? JSON.parse(responseData) : null
                        };
                        resolve(result);
                    } catch (parseError) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: responseData
                        });
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(TEST_TIMEOUT, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async runTests() {
        console.log('🚀 KeyKeeper Desktop ↔️ VSCode Extension Integration Tests');
        console.log('=' * 60);

        // Setup test environment file
        await this.setupTestEnv();

        // Basic connectivity tests
        await this.test('Health Check Endpoint', async () => {
            const response = await this.httpRequest('GET', '/health');
            if (response.statusCode !== 200) {
                throw new Error(`Expected status 200, got ${response.statusCode}`);
            }
        });

        await this.test('CORS Options Request', async () => {
            const response = await this.httpRequest('OPTIONS', '/api/keys');
            if (response.statusCode !== 200) {
                throw new Error(`Expected status 200, got ${response.statusCode}`);
            }
        });

        // Authentication tests
        await this.test('Login Endpoint Exists', async () => {
            const response = await this.httpRequest('POST', '/api/login', {
                account: 'test@example.com',
                masterPass: 'wrongpassword'
            });
            // Should exist (not 404) even if credentials are wrong
            if (response.statusCode === 404) {
                throw new Error('Login endpoint not found');
            }
        });

        // API endpoint tests (these might fail if vault is locked, but endpoints should exist)
        await this.test('API Keys Endpoint', async () => {
            const response = await this.httpRequest('GET', '/api/keys');
            // Should return 401/403 if locked, not 404
            if (response.statusCode === 404) {
                throw new Error('API keys endpoint not found');
            }
        });

        await this.test('Projects Endpoint', async () => {
            const response = await this.httpRequest('GET', '/api/projects');
            if (response.statusCode === 404) {
                throw new Error('Projects endpoint not found');
            }
        });

        await this.test('Recent Activity Endpoint', async () => {
            const response = await this.httpRequest('GET', '/api/activity/recent');
            if (response.statusCode === 404) {
                throw new Error('Recent activity endpoint not found');
            }
        });

        // Environment file integration tests
        await this.test('ENV Parse Endpoint', async () => {
            const response = await this.httpRequest('POST', '/api/env/parse', {
                filePath: TEST_ENV_FILE
            });
            if (response.statusCode === 404) {
                throw new Error('ENV parse endpoint not found');
            }
        });

        await this.test('ENV Association Endpoint', async () => {
            const response = await this.httpRequest('GET', '/api/env/associations');
            if (response.statusCode === 404) {
                throw new Error('ENV associations endpoint not found');
            }
        });

        await this.test('Project Activation Endpoint', async () => {
            const response = await this.httpRequest('POST', '/api/projects/activate', {
                projectPath: '/test/project'
            });
            if (response.statusCode === 404) {
                throw new Error('Project activation endpoint not found');
            }
        });

        // WebSocket test (should return 501 not 404)
        await this.test('WebSocket Endpoint Placeholder', async () => {
            const response = await this.httpRequest('GET', '/ws');
            if (response.statusCode === 404) {
                throw new Error('WebSocket endpoint not found');
            }
            if (response.statusCode !== 501) {
                console.log(`⚠️  WebSocket returned ${response.statusCode}, expected 501 (not implemented)`);
            }
        });

        // Cleanup
        await this.cleanupTestEnv();

        // Print results
        this.printResults();
    }

    async setupTestEnv() {
        console.log('\n📁 Setting up test environment...');
        try {
            fs.writeFileSync(TEST_ENV_FILE, TEST_ENV_CONTENT);
            console.log(`✅ Created test .env file: ${TEST_ENV_FILE}`);
        } catch (error) {
            console.log(`⚠️  Could not create test file: ${error.message}`);
        }
    }

    async cleanupTestEnv() {
        console.log('\n🧹 Cleaning up test environment...');
        try {
            if (fs.existsSync(TEST_ENV_FILE)) {
                fs.unlinkSync(TEST_ENV_FILE);
                console.log(`✅ Removed test .env file`);
            }
        } catch (error) {
            console.log(`⚠️  Could not remove test file: ${error.message}`);
        }
    }

    printResults() {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 TEST RESULTS');
        console.log('═'.repeat(60));

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const total = this.results.length;

        console.log(`\n📈 Summary: ${passed}/${total} tests passed`);
        
        if (failed > 0) {
            console.log(`\n❌ Failed Tests (${failed}):`);
            this.errors.forEach(({ test, error }) => {
                console.log(`   • ${test}: ${error.message}`);
            });
        }

        if (passed === total) {
            console.log('\n🎉 All tests passed! Desktop app and VSCode extension integration looks good.');
        } else {
            console.log('\n⚠️  Some tests failed. Check the errors above and ensure:');
            console.log('   1. KeyKeeper desktop app is running');
            console.log('   2. VSCode server is started (port 27182)');
            console.log('   3. All API endpoints are implemented');
        }

        console.log('\n💡 Next steps:');
        console.log('   1. Start KeyKeeper desktop app');
        console.log('   2. Install VSCode extension');
        console.log('   3. Test manual integration with a real project');
        console.log('   4. Try drag-and-drop .env file functionality');
        
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Run tests
const tester = new IntegrationTester();
tester.runTests().catch(error => {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
});