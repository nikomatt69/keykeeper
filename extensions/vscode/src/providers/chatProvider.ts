import * as vscode from 'vscode';
import { KeyKeeperService, ChatSession } from '../utils/keykeeperService';
import { ChatPanel } from '../webview/chatPanel';

export class ChatProvider implements vscode.TreeDataProvider<ChatItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChatItem | undefined | null | void> = new vscode.EventEmitter<ChatItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChatItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sessions: ChatSession[] = [];
    private readonly userId = 'vscode-user';

    constructor(private keykeeperService: KeyKeeperService, private extensionUri: vscode.Uri) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChatItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ChatItem): Promise<ChatItem[]> {
        if (!element) {
            // Root level - show chat sessions and actions
            try {
                this.sessions = await this.keykeeperService.listChatSessions(this.userId);
                
                const items: ChatItem[] = [];
                
                // Add new chat button
                items.push(new ChatItem(
                    'New Chat',
                    'Start a new conversation',
                    vscode.TreeItemCollapsibleState.None,
                    'new-chat'
                ));

                // Add quick chat button
                items.push(new ChatItem(
                    'Quick Chat',
                    'Ask a quick question',
                    vscode.TreeItemCollapsibleState.None,
                    'quick-chat'
                ));

                if (!this.sessions || this.sessions.length === 0) {
                    items.push(new ChatItem(
                        'No chat sessions',
                        'Create a new chat to get started',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    ));
                } else {
                    // Add existing sessions
                    this.sessions.forEach(session => {
                        items.push(new ChatItem(
                            session.name,
                            `${session.message_count} messages`,
                            vscode.TreeItemCollapsibleState.None,
                            'session',
                            session
                        ));
                    });
                }

                return items;
            } catch (error) {
                console.error('Failed to load chat sessions:', error);
                return [
                    new ChatItem(
                        'New Chat',
                        'Start a new conversation',
                        vscode.TreeItemCollapsibleState.None,
                        'new-chat'
                    ),
                    new ChatItem(
                        'Failed to load sessions',
                        error instanceof Error ? error.message : '',
                        vscode.TreeItemCollapsibleState.None,
                        'error'
                    )
                ];
            }
        }
        return [];
    }

    async createNewChatSession(): Promise<void> {
        try {
            const sessionName = await vscode.window.showInputBox({
                prompt: 'Enter a name for the new chat session',
                value: `Chat ${new Date().toLocaleString()}`
            });

            if (sessionName) {
                const session = await this.keykeeperService.createChatSession({
                    user_id: this.userId,
                    title: sessionName
                });

                vscode.window.showInformationMessage(`Chat session "${sessionName}" created successfully`);
                this.refresh();

                // Optionally open the chat session
                await this.openChatSession(session);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async openChatSession(session: ChatSession): Promise<void> {
        try {
            ChatPanel.createOrShow(this.extensionUri, session, this.keykeeperService);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async quickChat(): Promise<void> {
        try {
            const message = await vscode.window.showInputBox({
                prompt: 'Enter your question',
                placeHolder: 'Ask anything about your APIs, documentation, or code...'
            });

            if (message) {
                vscode.window.showInformationMessage('Sending message...', { modal: false });
                
                const response = await this.keykeeperService.quickChat(message, this.userId);
                
                // Show response in a new document
                const document = await vscode.workspace.openTextDocument({
                    content: `# Quick Chat Response\n\n**Question:** ${message}\n\n**Answer:**\n${response}`,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(document);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Quick chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteChatSession(session: ChatSession): Promise<void> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the chat session "${session.name}"?`,
                'Delete',
                'Cancel'
            );

            if (confirm === 'Delete') {
                await this.keykeeperService.deleteChatSession(session.id, this.userId);
                vscode.window.showInformationMessage(`Chat session "${session.name}" deleted`);
                this.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export class ChatItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly session?: ChatSession
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.contextValue = contextValue;

        // Set appropriate icons and commands
        switch (contextValue) {
            case 'new-chat':
                this.iconPath = new vscode.ThemeIcon('add');
                this.command = {
                    command: 'keykeeper.createNewChat',
                    title: 'Create New Chat',
                    arguments: []
                };
                break;
            case 'quick-chat':
                this.iconPath = new vscode.ThemeIcon('comment');
                this.command = {
                    command: 'keykeeper.quickChat',
                    title: 'Quick Chat',
                    arguments: []
                };
                break;
            case 'session':
                this.iconPath = new vscode.ThemeIcon('comment-discussion');
                if (session) {
                    this.tooltip = `${session.name}\nCreated: ${new Date(session.created_at).toLocaleString()}\nMessages: ${session.message_count}`;
                    this.command = {
                        command: 'keykeeper.openChatSession',
                        title: 'Open Chat Session',
                        arguments: [session]
                    };
                }
                break;
            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error');
                break;
        }
    }
}