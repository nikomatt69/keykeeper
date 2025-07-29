import * as vscode from 'vscode';
import { KeyKeeperService, Project } from '../utils/keykeeperService';

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projects: Project[] = [];

    constructor(private keykeeperService: KeyKeeperService) {
        this.refresh();
    }

    refresh(): void {
        this.loadProjects();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        if (!element) {
            await this.loadProjects();
            if (!this.projects || this.projects.length === 0) {
                return [new ProjectTreeItem({
                    id: 'no-projects',
                    name: 'No projects found',
                    description: '',
                    created_at: '',
                    updated_at: '',
                    settings: {
                        defaultEnvironment: 'dev' as const,
                        autoSync: false,
                        vscodeIntegration: false,
                        cursorIntegration: false,
                        notifications: false
                    }
                }, true)];
            }
            return this.projects.map(project => new ProjectTreeItem(project));
        }
        return [];
    }

    private async loadProjects(): Promise<void> {
        try {
            const response = await this.keykeeperService.getProjects();
            this.projects = Array.isArray((response as any)?.data) ? (response as any).data : (Array.isArray(response) ? response : []);
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }
}

export class ProjectTreeItem extends vscode.TreeItem {
    constructor(public readonly project: Project, public readonly isPlaceholder: boolean = false) {
        super(project.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = project.description || project.name;
        this.description = isPlaceholder ? '' : `${project.settings?.defaultEnvironment || 'dev'}`;
        this.iconPath = new vscode.ThemeIcon(isPlaceholder ? 'info' : 'project');
        this.contextValue = isPlaceholder ? 'info' : 'project';

        if (!isPlaceholder) {
            this.command = {
                command: 'keykeeper.browseKeys',
                title: 'Browse Project Keys',
                arguments: [project.id]
            };
        }
    }
} 