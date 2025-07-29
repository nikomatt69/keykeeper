import * as vscode from 'vscode';
import { KeyKeeperService } from '../utils/keykeeperService';

export class DocumentationProvider implements vscode.TreeDataProvider<DocumentationItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DocumentationItem | undefined | null | void> = new vscode.EventEmitter<DocumentationItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DocumentationItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private documentation: any[] = [];

    constructor(private keykeeperService: KeyKeeperService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DocumentationItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DocumentationItem): Promise<DocumentationItem[]> {
        if (!element) {
            // Root level - show documentation categories
            try {
                const response = await this.keykeeperService.getAllDocumentation();
                this.documentation = Array.isArray((response as any)?.data) ? (response as any).data : (Array.isArray(response) ? response : []);
                
                if (!this.documentation || this.documentation.length === 0) {
                    return [new DocumentationItem('No documentation found', '', vscode.TreeItemCollapsibleState.None, 'info')];
                }

                // Group by provider/type
                const groupedDocs = this.groupDocumentation(this.documentation);
                return Object.keys(groupedDocs).map(key => 
                    new DocumentationItem(
                        key, 
                        `${groupedDocs[key].length} item(s)`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'folder',
                        undefined,
                        groupedDocs[key]
                    )
                );
            } catch (error) {
                console.error('Failed to load documentation:', error);
                return [new DocumentationItem('Failed to load documentation', error instanceof Error ? error.message : '', vscode.TreeItemCollapsibleState.None, 'error')];
            }
        } else {
            // Show documentation items in this group
            if (element.documentation && Array.isArray(element.documentation)) {
                return element.documentation.map(doc => 
                    new DocumentationItem(
                        doc?.title || 'Untitled',
                        doc?.doc_type || 'documentation',
                        vscode.TreeItemCollapsibleState.None,
                        'doc',
                        doc
                    )
                );
            }
            return [];
        }
    }

    private groupDocumentation(docs: any[]): { [key: string]: any[] } {
        const groups: { [key: string]: any[] } = {};
        
        docs.forEach(doc => {
            const key = doc.provider_id || doc.doc_type || 'General';
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(doc);
        });
        
        return groups;
    }
}

export class DocumentationItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly doc?: any,
        public readonly documentation?: any[]
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.contextValue = contextValue;

        if (doc) {
            this.tooltip = `${doc.title}\n${doc.content?.substring(0, 100) || ''}...`;
            this.command = {
                command: 'keykeeper.showDocumentationDetail',
                title: 'Show Documentation',
                arguments: [doc]
            };
        }

        // Set appropriate icons
        switch (contextValue) {
            case 'folder':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'doc':
                this.iconPath = new vscode.ThemeIcon('book');
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