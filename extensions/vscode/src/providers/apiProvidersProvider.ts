import * as vscode from 'vscode';
import { KeyKeeperService } from '../utils/keykeeperService';

export class ApiProvidersProvider implements vscode.TreeDataProvider<ApiProviderItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ApiProviderItem | undefined | null | void> = new vscode.EventEmitter<ApiProviderItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ApiProviderItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private providers: any[] = [];

    constructor(private keykeeperService: KeyKeeperService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ApiProviderItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ApiProviderItem): Promise<ApiProviderItem[]> {
        if (!element) {
            // Root level - show API providers
            try {
                this.providers = await this.keykeeperService.getAPIProviders();
                
                if (this.providers.length === 0) {
                    return [new ApiProviderItem('No API providers found', '', vscode.TreeItemCollapsibleState.None, 'info')];
                }

                return this.providers.map(provider => 
                    new ApiProviderItem(
                        provider.name,
                        provider.description,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'provider',
                        provider
                    )
                );
            } catch (error) {
                console.error('Failed to load API providers:', error);
                return [new ApiProviderItem('Failed to load providers', '', vscode.TreeItemCollapsibleState.None, 'error')];
            }
        } else {
            // Show provider details
            if (element.provider) {
                const details = [];
                
                if (element.provider.docs_url) {
                    details.push(new ApiProviderItem(
                        'Documentation',
                        element.provider.docs_url,
                        vscode.TreeItemCollapsibleState.None,
                        'docs-url',
                        element.provider
                    ));
                }
                
                if (element.provider.category) {
                    details.push(new ApiProviderItem(
                        'Category',
                        element.provider.category,
                        vscode.TreeItemCollapsibleState.None,
                        'category'
                    ));
                }
                
                if (element.provider.setup_type) {
                    details.push(new ApiProviderItem(
                        'Setup Type',
                        element.provider.setup_type,
                        vscode.TreeItemCollapsibleState.None,
                        'setup-type'
                    ));
                }

                if (element.provider.key_patterns && element.provider.key_patterns.length > 0) {
                    details.push(new ApiProviderItem(
                        'Key Patterns',
                        element.provider.key_patterns.join(', '),
                        vscode.TreeItemCollapsibleState.None,
                        'patterns'
                    ));
                }

                return details;
            }
            return [];
        }
    }
}

export class ApiProviderItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly provider?: any
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.contextValue = contextValue;

        if (provider && contextValue === 'provider') {
            this.tooltip = `${provider.name}\n${provider.description}`;
            this.command = {
                command: 'keykeeper.showProviderDetails',
                title: 'Show Provider Details',
                arguments: [provider]
            };
        }

        // Set appropriate icons
        switch (contextValue) {
            case 'provider':
                this.iconPath = new vscode.ThemeIcon('cloud');
                break;
            case 'docs-url':
                this.iconPath = new vscode.ThemeIcon('book');
                this.command = {
                    command: 'vscode.open',
                    title: 'Open Documentation',
                    arguments: [vscode.Uri.parse(description)]
                };
                break;
            case 'category':
                this.iconPath = new vscode.ThemeIcon('tag');
                break;
            case 'setup-type':
                this.iconPath = new vscode.ThemeIcon('tools');
                break;
            case 'patterns':
                this.iconPath = new vscode.ThemeIcon('regex');
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