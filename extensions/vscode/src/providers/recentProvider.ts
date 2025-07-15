import * as vscode from 'vscode';
import { KeyKeeperService, RecentActivity } from '../utils/keykeeperService';

export class RecentProvider implements vscode.TreeDataProvider<RecentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RecentTreeItem | undefined | null | void> = new vscode.EventEmitter<RecentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RecentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private recentActivity: RecentActivity[] = [];

    constructor(private keykeeperService: KeyKeeperService) {
        this.refresh();
    }

    refresh(): void {
        this.loadRecentActivity();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RecentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RecentTreeItem): Promise<RecentTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.recentActivity.map(activity => new RecentTreeItem(activity)));
        }
        return Promise.resolve([]);
    }

    private async loadRecentActivity(): Promise<void> {
        try {
            this.recentActivity = await this.keykeeperService.getRecentActivity();
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            this.recentActivity = [];
        }
    }
}

export class RecentTreeItem extends vscode.TreeItem {
    constructor(public readonly activity: RecentActivity) {
        super(activity.keyName, vscode.TreeItemCollapsibleState.None);

        const timeAgo = this.getTimeAgo(new Date(activity.timestamp));
        this.description = `${this.getActionText(activity.type)} ${timeAgo}`;
        this.tooltip = `${activity.keyName} - ${this.getActionText(activity.type)} ${timeAgo}`;
        this.iconPath = this.getActionIcon(activity.type);
        this.contextValue = 'recent';
    }

    private getActionText(type: string): string {
        switch (type) {
            case 'key_used': return 'used';
            case 'key_created': return 'created';
            case 'key_updated': return 'updated';
            default: return type;
        }
    }

    private getActionIcon(type: string): vscode.ThemeIcon {
        switch (type) {
            case 'key_used': return new vscode.ThemeIcon('play');
            case 'key_created': return new vscode.ThemeIcon('add');
            case 'key_updated': return new vscode.ThemeIcon('edit');
            default: return new vscode.ThemeIcon('history');
        }
    }

    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
} 