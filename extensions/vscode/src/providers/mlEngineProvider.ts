import * as vscode from 'vscode';
import { KeyKeeperService } from '../utils/keykeeperService';

export class MLEngineProvider implements vscode.TreeDataProvider<MLEngineItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MLEngineItem | undefined | null | void> = new vscode.EventEmitter<MLEngineItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MLEngineItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private mlStatus: any = null;
    private mlStats: any = null;

    constructor(private keykeeperService: KeyKeeperService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MLEngineItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MLEngineItem): Promise<MLEngineItem[]> {
        if (!element) {
            // Root level - show ML engine status and features
            try {
                // Check if KeyKeeper app is running
                const isAppRunning = await this.keykeeperService.isAppRunning();
                if (!isAppRunning) {
                    return [new MLEngineItem('KeyKeeper app not running', '', vscode.TreeItemCollapsibleState.None, 'error')];
                }

                const items: MLEngineItem[] = [];

                // ML Engine Status section
                items.push(new MLEngineItem(
                    'ML Engine Status',
                    'Check engine status',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'status-section'
                ));

                // ML Predictions section
                items.push(new MLEngineItem(
                    'Smart Suggestions',
                    'Context-aware API key suggestions',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'suggestions-section'
                ));

                // ML Statistics section
                items.push(new MLEngineItem(
                    'Usage Statistics',
                    'ML engine performance metrics',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'stats-section'
                ));

                return items;
            } catch (error) {
                console.error('Failed to load ML engine info:', error);
                return [new MLEngineItem('Failed to load ML engine info', '', vscode.TreeItemCollapsibleState.None, 'error')];
            }
        } else {
            // Show section-specific items
            switch (element.contextValue) {
                case 'status-section':
                    return await this.getStatusItems();
                case 'suggestions-section':
                    return await this.getSuggestionItems();
                case 'stats-section':
                    return await this.getStatsItems();
                default:
                    return [];
            }
        }
    }

    private async getStatusItems(): Promise<MLEngineItem[]> {
        try {
            // Note: These would need to be implemented in the KeyKeeperService
            // For now, showing placeholder items
            return [
                new MLEngineItem(
                    'Engine Status',
                    'Checking...',
                    vscode.TreeItemCollapsibleState.None,
                    'status-item',
                    { command: 'keykeeper.checkMLStatus' }
                ),
                new MLEngineItem(
                    'Initialize Engine',
                    'Start ML engine',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.initializeMLEngine' }
                ),
                new MLEngineItem(
                    'Reinitialize Engine',
                    'Restart ML engine',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.reinitializeMLEngine' }
                )
            ];
        } catch (error) {
            return [new MLEngineItem('Error loading status', '', vscode.TreeItemCollapsibleState.None, 'error')];
        }
    }

    private async getSuggestionItems(): Promise<MLEngineItem[]> {
        try {
            return [
                new MLEngineItem(
                    'Get Context Suggestions',
                    'Analyze current context for API suggestions',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.getMLSuggestions' }
                ),
                new MLEngineItem(
                    'Detect Current Context',
                    'Analyze current file/workspace context',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.detectContext' }
                ),
                new MLEngineItem(
                    'Record Usage',
                    'Record API key usage for learning',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.recordMLUsage' }
                )
            ];
        } catch (error) {
            return [new MLEngineItem('Error loading suggestions', '', vscode.TreeItemCollapsibleState.None, 'error')];
        }
    }

    private async getStatsItems(): Promise<MLEngineItem[]> {
        try {
            return [
                new MLEngineItem(
                    'View ML Statistics',
                    'Show detailed ML engine statistics',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.showMLStats' }
                ),
                new MLEngineItem(
                    'Export Usage Data',
                    'Export ML usage data for analysis',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.exportMLData' }
                ),
                new MLEngineItem(
                    'Reset ML Data',
                    'Clear ML learning data',
                    vscode.TreeItemCollapsibleState.None,
                    'action-item',
                    { command: 'keykeeper.resetMLData' }
                )
            ];
        } catch (error) {
            return [new MLEngineItem('Error loading stats', '', vscode.TreeItemCollapsibleState.None, 'error')];
        }
    }
}

export class MLEngineItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly action?: { command: string }
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.contextValue = contextValue;

        if (action) {
            this.command = {
                command: action.command,
                title: label,
                arguments: []
            };
        }

        // Set appropriate icons
        switch (contextValue) {
            case 'status-section':
                this.iconPath = new vscode.ThemeIcon('pulse');
                break;
            case 'suggestions-section':
                this.iconPath = new vscode.ThemeIcon('lightbulb');
                break;
            case 'stats-section':
                this.iconPath = new vscode.ThemeIcon('graph');
                break;
            case 'status-item':
                this.iconPath = new vscode.ThemeIcon('circle-outline');
                break;
            case 'action-item':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('gear');
                break;
        }
    }
}