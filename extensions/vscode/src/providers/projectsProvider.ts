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

    getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.projects.map(project => new ProjectTreeItem(project)));
        }
        return Promise.resolve([]);
    }

    private async loadProjects(): Promise<void> {
        try {
            this.projects = await this.keykeeperService.getProjects();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.projects = [];
        }
    }
}

export class ProjectTreeItem extends vscode.TreeItem {
    constructor(public readonly project: Project) {
        super(project.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = project.description || project.name;
        this.description = `${project.settings.defaultEnvironment}`;
        this.iconPath = new vscode.ThemeIcon('project');
        this.contextValue = 'project';

        this.command = {
            command: 'keykeeper.browseKeys',
            title: 'Browse Project Keys',
            arguments: [project.id]
        };
    }
} 