import * as vscode from 'vscode';
import { KeyKeeperService, ChatSession, ChatMessage } from '../utils/keykeeperService';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _session: ChatSession;
    private _messages: ChatMessage[] = [];

    public static createOrShow(extensionUri: vscode.Uri, session: ChatSession, keykeeperService: KeyKeeperService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            ChatPanel.currentPanel._session = session;
            ChatPanel.currentPanel._loadMessages();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'keykeeperChat',
            `KeyKeeper Chat: ${session.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, session, keykeeperService);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        session: ChatSession,
        private keykeeperService: KeyKeeperService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._session = session;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        this._sendMessage(message.text);
                        return;
                    case 'loadMessages':
                        this._loadMessages();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _sendMessage(text: string) {
        try {
            // Show loading state
            this._panel.webview.postMessage({
                command: 'showLoading'
            });

            // Send message to KeyKeeper service
            const response = await this.keykeeperService.sendChatMessage(this._session.id, {
                user_id: 'vscode-user',
                content: text,
                message_type: 'user',
                include_docs: true
            });

            // Add both messages to our local cache
            this._messages.push(response.user_message);
            this._messages.push(response.ai_response);

            // Update the UI
            this._panel.webview.postMessage({
                command: 'addMessages',
                messages: [response.user_message, response.ai_response]
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this._panel.webview.postMessage({
                command: 'hideLoading'
            });
        }
    }

    private async _loadMessages() {
        try {
            this._messages = await this.keykeeperService.getChatMessages(this._session.id, 'vscode-user', 50);
            
            this._panel.webview.postMessage({
                command: 'loadMessages',
                messages: this._messages
            });
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        
        // Load messages when panel is created
        this._loadMessages();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>KeyKeeper Chat</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .chat-header {
                    padding: 10px 20px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-panel-background);
                }
                
                .chat-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .message {
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    word-wrap: break-word;
                }
                
                .message.user {
                    align-self: flex-end;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                
                .message.assistant {
                    align-self: flex-start;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                }
                
                .message-content {
                    margin: 0;
                    white-space: pre-wrap;
                }
                
                .message-time {
                    font-size: 0.8em;
                    opacity: 0.7;
                    margin-top: 5px;
                }
                
                .input-container {
                    padding: 20px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-panel-background);
                    display: flex;
                    gap: 10px;
                }
                
                .message-input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 40px;
                }
                
                .send-button {
                    padding: 10px 20px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                }
                
                .send-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .loading {
                    display: none;
                    align-self: flex-start;
                    padding: 12px 16px;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 12px;
                    font-style: italic;
                    opacity: 0.7;
                }
                
                .loading.show {
                    display: block;
                }
                
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 10px;
                    border-radius: 4px;
                    overflow-x: auto;
                    margin: 10px 0;
                }
                
                code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                }
            </style>
        </head>
        <body>
            <div class="chat-header">
                <h3>${this._session.name}</h3>
                <p>Session ID: ${this._session.id}</p>
            </div>
            
            <div class="chat-container" id="chatContainer">
                <!-- Messages will be inserted here -->
            </div>
            
            <div class="loading" id="loadingIndicator">
                AI is thinking...
            </div>
            
            <div class="input-container">
                <textarea 
                    id="messageInput" 
                    class="message-input" 
                    placeholder="Type your message here... (Shift+Enter for new line, Enter to send)"
                    rows="1"
                ></textarea>
                <button id="sendButton" class="send-button">Send</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const chatContainer = document.getElementById('chatContainer');
                const messageInput = document.getElementById('messageInput');
                const sendButton = document.getElementById('sendButton');
                const loadingIndicator = document.getElementById('loadingIndicator');
                
                // Auto-resize textarea
                messageInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
                });
                
                // Send message on Enter (not Shift+Enter)
                messageInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                sendButton.addEventListener('click', sendMessage);
                
                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (!text) return;
                    
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text
                    });
                    
                    messageInput.value = '';
                    messageInput.style.height = 'auto';
                    sendButton.disabled = true;
                }
                
                function addMessage(message) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + message.role;
                    
                    const contentP = document.createElement('p');
                    contentP.className = 'message-content';
                    contentP.textContent = message.content;
                    
                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'message-time';
                    timeDiv.textContent = new Date(message.timestamp).toLocaleString();
                    
                    messageDiv.appendChild(contentP);
                    messageDiv.appendChild(timeDiv);
                    chatContainer.appendChild(messageDiv);
                    
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'loadMessages':
                            chatContainer.innerHTML = '';
                            message.messages.forEach(addMessage);
                            break;
                            
                        case 'addMessages':
                            message.messages.forEach(addMessage);
                            loadingIndicator.classList.remove('show');
                            sendButton.disabled = false;
                            break;
                            
                        case 'showLoading':
                            loadingIndicator.classList.add('show');
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                            break;
                            
                        case 'hideLoading':
                            loadingIndicator.classList.remove('show');
                            sendButton.disabled = false;
                            break;
                    }
                });
                
                // Request initial load
                vscode.postMessage({ command: 'loadMessages' });
            </script>
        </body>
        </html>`;
    }
}