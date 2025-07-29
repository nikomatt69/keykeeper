import * as vscode from 'vscode';
import { KeyKeeperService, ApiKey, AuthResult } from '../utils/keykeeperService';
import { ApiKeysProvider } from '../providers/apiKeysProvider';
import { ProjectsProvider } from '../providers/projectsProvider';
import { RecentProvider } from '../providers/recentProvider';

export async function insertKeyCommand(service: KeyKeeperService, key?: ApiKey): Promise<void> {
    try {
        let selectedKey = key;

        if (!selectedKey) {
            // Show quick pick for key selection
            const keys = await service.getApiKeys();
            const items = keys.map(k => ({
                label: k.name,
                description: `${k.service} - ${k.environment}`,
                detail: k.description,
                key: k
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an API key to insert'
            });

            if (!selected) return;
            selectedKey = selected.key;
        }

        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        // Get insertion format from settings
        const config = vscode.workspace.getConfiguration('keykeeper');
        const format = config.get<string>('insertFormat', 'process.env');

        // Use intelligent insertion with auto-sync
        try {
            const result = await service.intelligentKeyInsertion(selectedKey.id);
            
            // Format the key for insertion
            const keyVarName = `${selectedKey.service.toUpperCase().replace(/\s+/g, '_')}_API_KEY`;
            let insertText: string;

            switch (format) {
                case 'value':
                    insertText = selectedKey.key;
                    break;
                case 'environment':
                    insertText = keyVarName;
                    break;
                case 'process.env':
                default:
                    insertText = `process.env.${keyVarName}`;
                    break;
            }

            // Insert the formatted text
            await editor.edit(editBuilder => {
                const position = editor.selection.active;
                editBuilder.insert(position, insertText);
            });

            // Record usage
            await service.recordKeyUsage(selectedKey.id);

            // Show success message with sync info
            vscode.window.showInformationMessage(result.message);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to insert key: ${error.message}`);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to insert API key: ${error.message}`);
    }
}

// Fallback method for older insertion logic
async function insertKeyLegacy(service: KeyKeeperService, selectedKey: ApiKey): Promise<void> {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const config = vscode.workspace.getConfiguration('keykeeper');
        const format = config.get<string>('insertFormat', 'process.env');

        // Format the key for insertion
        const formattedKey = service.formatKeyForInsertion(selectedKey, format);

        // Insert at cursor position
        await editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, formattedKey);
        });

        // Record usage
        await service.recordKeyUsage(selectedKey.id);

        // Show success message
        vscode.window.showInformationMessage(`Inserted ${selectedKey.name}`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to insert API key: ${error}`);
    }
}

export async function browseKeysCommand(service: KeyKeeperService, projectId?: string): Promise<void> {
    try {
        const keys = await service.getApiKeys(projectId);

        if (keys.length === 0) {
            vscode.window.showInformationMessage('No API keys found');
            return;
        }

        const items = keys.map(key => ({
            label: key.name,
            description: `${key.service} - ${key.environment}`,
            detail: key.description,
            key: key
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Browse API keys',
            onDidSelectItem: (item: any) => {
                // Preview on hover
                vscode.window.showInformationMessage(`${item.key.name}: ${item.key.service}`);
            }
        });

        if (selected) {
            await insertKeyCommand(service, selected.key);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to browse API keys: ${error}`);
    }
}

export async function quickSearchCommand(service: KeyKeeperService): Promise<void> {
    try {
        const searchTerm = await vscode.window.showInputBox({
            placeHolder: 'Search API keys...',
            prompt: 'Enter search term for API keys'
        });

        if (!searchTerm) return;

        const keys = await service.searchKeys(searchTerm);

        if (keys.length === 0) {
            vscode.window.showInformationMessage(`No API keys found for "${searchTerm}"`);
            return;
        }

        const items = keys.map(key => ({
            label: key.name,
            description: `${key.service} - ${key.environment}`,
            detail: key.description,
            key: key
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Search results for "${searchTerm}"`
        });

        if (selected) {
            await insertKeyCommand(service, selected.key);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
    }
}

export async function syncProjectCommand(service: KeyKeeperService): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        await service.syncProject(projectPath);

        vscode.window.showInformationMessage('Project synced with KeyKeeper');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to sync project: ${error}`);
    }
}

export async function createKeyCommand(service: KeyKeeperService): Promise<void> {
    try {
        // Get key details from user
        const name = await vscode.window.showInputBox({
            placeHolder: 'Enter API key name',
            prompt: 'Name for the new API key'
        });
        if (!name) return;

        const serviceName = await vscode.window.showInputBox({
            placeHolder: 'Enter service name (e.g., OpenAI, Stripe)',
            prompt: 'Service that provides this API key'
        });
        if (!serviceName) return;

        const value = await vscode.window.showInputBox({
            placeHolder: 'Enter API key value',
            prompt: 'The actual API key value',
            password: true
        });
        if (!value) return;

        const environments: ('dev' | 'staging' | 'production')[] = ['dev', 'staging', 'production'];
        const environment = await vscode.window.showQuickPick(environments, {
            placeHolder: 'Select environment'
        });
        if (!environment) return;

        const description = await vscode.window.showInputBox({
            placeHolder: 'Enter description (optional)',
            prompt: 'Description for this API key'
        });

        // Create the key
        const newKey = await service.createKey({
            name,
            service: serviceName,
            key: value,
            environment: environment as 'dev' | 'staging' | 'production',
            description,
            scopes: [],
            tags: [],
            is_active: true
        });

        vscode.window.showInformationMessage(`Created API key: ${newKey.name}`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create API key: ${error}`);
    }
}

export async function refreshKeysCommand(
    apiKeysProvider: ApiKeysProvider,
    projectsProvider: ProjectsProvider,
    recentProvider: RecentProvider,
    documentationProvider?: any,
    apiProvidersProvider?: any,
    mlEngineProvider?: any,
    chatProvider?: any
): Promise<void> {
    try {
        const refreshPromises = [
            apiKeysProvider.refresh(),
            projectsProvider.refresh(),
            recentProvider.refresh()
        ];

        // Add optional providers if they exist
        if (documentationProvider) {
            refreshPromises.push(documentationProvider.refresh());
        }
        if (apiProvidersProvider) {
            refreshPromises.push(apiProvidersProvider.refresh());
        }
        if (mlEngineProvider) {
            refreshPromises.push(mlEngineProvider.refresh());
        }
        if (chatProvider) {
            refreshPromises.push(chatProvider.refresh());
        }

        await Promise.all(refreshPromises);

        vscode.window.showInformationMessage('KeyKeeper data refreshed');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to refresh: ${error}`);
    }
}

export function openSettingsCommand() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'keykeeper');
}

export async function autoSyncWorkspaceCommand(service: KeyKeeperService): Promise<void> {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Syncing workspace with KeyKeeper...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            try {
                const result = await service.autoSyncWorkspaceEnvFiles(workspacePath);
                progress.report({ increment: 100 });
                
                vscode.window.showInformationMessage(result);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Auto-sync failed: ${error.message}`);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to auto-sync workspace: ${error.message}`);
    }
}

export async function authenticateCommand(keykeeperService: KeyKeeperService) {
    const masterPass = await vscode.window.showInputBox({ prompt: 'Enter your Master Password', password: true });
    if (!masterPass) return;

    try {
        const result = await keykeeperService.authenticateWithMasterPassword(masterPass);
        if (result.success) {
            vscode.window.showInformationMessage('Successfully authenticated with KeyKeeper!');
            vscode.commands.executeCommand('setContext', 'keykeeper:loggedIn', true);
            vscode.commands.executeCommand('keykeeper.refreshKeys');
        } else {
            vscode.window.showErrorMessage(`Authentication failed: ${result.message}`);
            vscode.commands.executeCommand('setContext', 'keykeeper:loggedIn', false);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
        vscode.commands.executeCommand('setContext', 'keykeeper:loggedIn', false);
    }
} 