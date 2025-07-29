import * as vscode from 'vscode';
import { KeyKeeperService, ApiKey } from '../utils/keykeeperService';

export class ApiKeysProvider implements vscode.TreeDataProvider<ApiKeyTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ApiKeyTreeItem | undefined | null | void> = new vscode.EventEmitter<ApiKeyTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ApiKeyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private apiKeys: ApiKey[] = [];

    constructor(private keykeeperService: KeyKeeperService) {
        this.refresh();
    }

    refresh(): void {
        this.loadApiKeys();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ApiKeyTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ApiKeyTreeItem): Thenable<ApiKeyTreeItem[]> {
        if (!element) {
            // Root level - show categories
            return Promise.resolve(this.getCategoryItems());
        } else if (element.contextValue === 'category') {
            // Category level - show keys in that category
            return Promise.resolve(this.getKeysInCategory(element.label as string));
        }
        return Promise.resolve([]);
    }

    private async loadApiKeys(): Promise<void> {
        try {
            this.apiKeys = await this.keykeeperService.getApiKeys();
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.apiKeys = [];
        }
    }

    private getCategoryItems(): ApiKeyTreeItem[] {
        const environments = new Set<string>();
        const services = new Set<string>();

        this.apiKeys.forEach(key => {
            environments.add(key.environment);
            services.add(key.service);
        });

        const categories: ApiKeyTreeItem[] = [];

        // Add environment categories
        environments.forEach(env => {
            const count = this.apiKeys.filter(key => key.environment === env).length;
            categories.push(new ApiKeyTreeItem(
                `${env} (${count})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'category',
                `environment:${env}`
            ));
        });

        // Add service categories
        services.forEach(service => {
            const count = this.apiKeys.filter(key => key.service === service).length;
            categories.push(new ApiKeyTreeItem(
                `${service} (${count})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'category',
                `service:${service}`
            ));
        });

        return categories;
    }

    private getKeysInCategory(categoryLabel: string): ApiKeyTreeItem[] {
        const [type, value] = categoryLabel.includes('(') ?
            categoryLabel.split(' (')[0].split(':') :
            categoryLabel.split(':');

        let filteredKeys: ApiKey[];
        if (categoryLabel.includes('environment:')) {
            filteredKeys = this.apiKeys.filter(key => key.environment === value);
        } else {
            filteredKeys = this.apiKeys.filter(key => key.service === value);
        }

        return filteredKeys.map(key => new ApiKeyTreeItem(
            key.name,
            vscode.TreeItemCollapsibleState.None,
            'apikey',
            key.id,
            key
        ));
    }
}

export class ApiKeyTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly id?: string,
        public readonly apiKey?: ApiKey
    ) {
        super(label, collapsibleState);

        if (contextValue === 'apikey' && apiKey) {
            this.tooltip = `${apiKey.service} - ${apiKey.description || 'No description'}`;
            this.description = apiKey.environment;
            this.iconPath = new vscode.ThemeIcon('key');

            // Add insert command
            this.command = {
                command: 'keykeeper.insertKey',
                title: 'Insert API Key',
                arguments: [apiKey]
            };
        } else if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
} 