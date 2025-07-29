# 🚀 KeyKeeper - User Guide

## Main Features

### 💬 AI Chat - ChatGPT Experience

#### How to Configure an AI Provider
1. **Open Chat**: Click the chat icon in the right sidebar
2. **Configure Provider**: Click the Wi-Fi icon in the chat header
3. **Choose Provider**:
   - **OpenAI**: For GPT-4, GPT-3.5-turbo (requires API key)
   - **Anthropic**: For Claude (requires API key)  
   - **Ollama**: For local models (free, requires installation)

#### OpenAI Provider
```
1. Select "OpenAI" tab
2. Enter API Key: sk-...
3. Click "Test Connection"
4. If the test passes, the provider is configured
```

#### Ollama Provider (Local)
```
1. Install Ollama: https://ollama.ai
2. Start Ollama: ollama serve
3. Install a model: ollama pull qwen2.5:7b
4. In KeyKeeper: select "Ollama" tab
5. Choose the model and test the connection
```

#### Local Qwen Model (Built-in)
```
1. KeyKeeper includes built-in Qwen model support
2. Uses GGUF format for efficient local inference
3. No internet connection required
4. Automatically optimizes for your hardware
5. Select "Local Qwen" in the AI provider settings
```

#### Multi-Provider Support
```
KeyKeeper supports multiple AI providers simultaneously:
- Switch between providers during conversations
- Each provider optimized for different tasks
- Automatic fallback if primary provider fails
- Unified interface across all providers
```

#### How to Chat
1. **Create Session**: Click the sessions icon → "Create New Session"
2. **Write Message**: Type in the text box at the bottom
3. **Send**: Press Enter or click the send button
4. **Receive Response**: The AI will respond in a few seconds

---

### 📚 Documentation System

#### Adding Documentation from URL
```
1. Go to the "Documentation" section
2. Click "Add Documentation" → "From URL"
3. Fill in:
   - Provider: Service name (e.g. "OpenAI")
   - URL: https://docs.openai.com/api/reference
   - Category: Type of documentation
   - Tags: Keywords for search
4. Click "Import"
```

#### Adding Manual Documentation
```
1. "Documentation" section → "Manual Entry"
2. Fill in:
   - Provider: Service name
   - Title: Documentation title
   - Content: Markdown content
   - Tags: Keywords
3. Click "Save"
```

#### Searching Documentation
```
1. Use the search bar in the Documentation section
2. Type keywords or API names
3. Results appear instantly
4. Click on a result to open it
```

#### Chat with Documentation
```
The AI can use your local documentation to respond:

Example:
"How do I use the OpenAI API that I documented?"
"Show me the endpoints of my custom API"
"Explain how to authenticate with the service I added"
```

---

### 🔐 API Key Management

#### Adding an API Key
```
1. Click "Add API Key" in the sidebar
2. Fill in:
   - Service: Service name
   - Key: Your API key
   - Description: Optional description
   - Environment: Production/Development/Test
   - Tags: Categories for organization
3. Click "Save"
```

#### Searching API Keys
```
1. Use the search bar at the top
2. Search by:
   - Service name
   - Description
   - Tags
   - Environment
3. Click on the API key to copy it
```

#### Exporting the Vault
```
1. Menu → "Export Vault"
2. Choose format: JSON, CSV, Excel
3. Select save location
4. The file is exported with encryption
```

---

### 🤖 Advanced AI & ML Features

#### AI-Enhanced Project Analysis
The AI system provides comprehensive project analysis:
- **Framework Detection**: Automatically identifies project frameworks and patterns
- **Code Quality Analysis**: Evaluates code structure and suggests improvements
- **Dependency Mapping**: Analyzes project dependencies and suggests optimizations
- **Security Analysis**: Identifies potential security vulnerabilities

#### Contextual AI Suggestions
Intelligent suggestions based on:
- Current project context and framework
- API usage patterns and history
- Development environment configuration
- Documentation and template libraries

#### Smart Template Matching
AI-powered template recommendations:
1. **Automatic Analysis**: AI analyzes your project structure
2. **Pattern Recognition**: Identifies common patterns and frameworks
3. **Template Suggestions**: Recommends optimal templates
4. **Custom Generation**: Creates tailored templates for your needs

#### Getting AI Suggestions
1. **Automatic**: Appear when AI detects new project or changes
2. **Manual**: Click "Get AI Suggestions" in the dashboard
3. **Context-Aware**: Real-time suggestions based on current file/context
4. **Interactive**: Chat with AI for specific recommendations

---

### ⚙️ Advanced Configuration & Template System

#### AI-Powered Configuration Generation
```
1. Go to the "Config Generation" section
2. Select:
   - Framework: React, Next.js, Vue, Angular, etc.
   - Language: TypeScript, JavaScript, Python, etc.
   - API Service: From your API keys list
   - Environment: Development, staging, production
3. Click "Generate Configuration"
4. AI optimizes configuration for your specific setup
5. Copy the generated code to your project
```

#### Enhanced Template System
```
1. "Templates" section with AI assistance
2. Click "Create Custom Template" or "AI Generate Template"
3. Define:
   - Target framework and version
   - Custom variables and parameters
   - Code structure and patterns
   - Integration requirements
4. Template inheritance and composition support
5. Save for future reuse and sharing
```

#### Validation & Setup Engine
```
Advanced validation system:
1. "Validation" section
2. Upload or paste configuration files
3. AI analyzes for:
   - Syntax errors and compatibility
   - Security best practices
   - Performance optimizations
   - Framework-specific requirements
4. Get detailed reports and suggestions
5. Auto-fix common issues
```

#### Setup Script Generation
```
1. Go to "Setup Scripts" section
2. Select target environment and framework
3. AI generates comprehensive setup scripts
4. Includes:
   - Dependency installation
   - Environment configuration
   - Security setup
   - Deployment preparation
5. Platform-specific optimizations
```

---

## 🎯 Usage Examples

### Scenario 1: New React Project with AI Integration
```
1. Add OpenAI API key to vault
2. AI analyzes your project structure automatically
3. Generate React + OpenAI configuration with AI assistance
4. Use enhanced AI chat for specific questions:
   "How do I implement chat streaming with OpenAI in React?"
5. Get framework-specific templates and validation
6. AI suggests best practices and optimizations
```

### Scenario 2: Custom API Development & Documentation
```
1. Import documentation from team URL or create manually
2. AI analyzes API patterns and suggests improvements
3. Use contextual AI chat:
   "Generate integration examples for our User API"
4. Export configurations for multiple frameworks
5. AI creates comprehensive documentation
6. Validate API configurations automatically
```

### Scenario 3: Advanced Debugging with AI
```
1. Copy your code into the enhanced chat interface
2. Ask: "Analyze this code for issues and optimizations"
3. AI uses local documentation and project context
4. Receive detailed analysis with:
   - Bug identification and fixes
   - Performance improvements
   - Security recommendations
   - Framework-specific suggestions
5. Get code generation assistance for fixes
```

### Scenario 4: Framework Migration with AI
```
1. Upload existing project configuration
2. Select target framework (e.g., React to Next.js)
3. AI analyzes migration requirements
4. Get step-by-step migration plan
5. Generate new configurations and templates
6. Validate migration compatibility
7. Receive optimization recommendations
```

### Scenario 5: Team Collaboration & Templates
```
1. Create shared template library for team
2. AI analyzes team coding patterns
3. Generate standardized templates
4. Export configurations for team distribution
5. Validate team member setups
6. Maintain consistency across projects
```

---

## 🔧 Tips & Tricks

### Performance
- **Cache**: AI responses are cached for speed
- **Offline**: Local documentation works without internet
- **Search**: Use specific keywords for better results

### Security  
- **API Keys**: Always encrypted in the vault
- **Backup**: Export the vault regularly
- **Session Keys**: API keys for chat are temporary

### Organization
- **Tags**: Use consistent tags for easy search
- **Categorization**: Organize API keys by environment
- **Documentation**: Keep docs updated with API versions

---

## ❓ FAQ

**Q: Can I use multiple AI providers simultaneously?**  
A: Yes, you can configure OpenAI, Anthropic and Ollama and switch between them

**Q: Are my API keys secure?**  
A: Yes, everything is encrypted locally. KeyKeeper never sends your API keys to external servers

**Q: Can I use local AI models?**  
A: Yes, KeyKeeper supports multiple local AI options:
- Built-in Qwen model with GGUF format
- Ollama integration for models like Qwen, Llama, Mistral
- Complete offline functionality with local models

**Q: Does documentation take up a lot of space?**  
A: No, the system is optimized with efficient storage and caching

**Q: Can I share configurations and templates with my team?**  
A: Yes, you can export configurations, templates, and validation rules for team sharing

**Q: Does it work offline?**  
A: Yes, most features work offline including:
- Vault management and API key storage
- Local documentation and search
- Built-in Qwen AI model
- Template generation and validation
- Only cloud-based AI providers require internet

**Q: How accurate is the AI framework detection?**  
A: Very accurate - the AI analyzes multiple indicators:
- File structure and naming patterns
- Package.json and dependency files
- Configuration files and settings
- Code patterns and imports

**Q: Can I customize AI suggestions and templates?**  
A: Yes, the system supports:
- Custom template creation and modification
- AI suggestion tuning and preferences
- Template inheritance and composition
- Validation rule customization

---

## 🆘 Troubleshooting

### AI Chat doesn't respond
1. Check internet connection (for OpenAI/Anthropic)
2. Verify that the API key is valid
3. For Ollama: verify that the service is active (`ollama serve`)

### Documentation doesn't import
1. Verify that the URL is accessible
2. Check network permissions
3. Try with a simpler URL for testing

### API Key doesn't save
1. Verify that the vault is unlocked
2. Check available disk space  
3. Restart the application if necessary

### Slow performance
1. Close unused chat sessions
2. Limit the number of open documents
3. Restart the application periodically

---

**🎉 Enjoy using KeyKeeper!**

For advanced support, consult the test files in the project directory or contact technical support.