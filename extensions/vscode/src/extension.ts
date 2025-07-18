import * as vscode from 'vscode';
import { KeyKeeperService } from './utils/keykeeperService';
import { ApiKeysProvider } from './providers/apiKeysProvider';
import { ProjectsProvider } from './providers/projectsProvider';
import { RecentProvider } from './providers/recentProvider';
import {
    insertKeyCommand,
    browseKeysCommand,
    quickSearchCommand,
    syncProjectCommand,
    createKeyCommand,
    refreshKeysCommand,
    openSettingsCommand,
    authenticateCommand
} from './commands';

let keykeeperService: KeyKeeperService;
let apiKeysProvider: ApiKeysProvider;
let projectsProvider: ProjectsProvider;
let recentProvider: RecentProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('KeyKeeper extension is now active!');

    // Initialize service
    keykeeperService = new KeyKeeperService();

    // Initialize providers
    apiKeysProvider = new ApiKeysProvider(keykeeperService);
    projectsProvider = new ProjectsProvider(keykeeperService);
    recentProvider = new RecentProvider(keykeeperService);

    // Note: VSCode extensions cannot use Tauri APIs directly
    // Communication with the main app is handled through HTTP API calls

    // Auto-detect workspace and activate context
    detectAndActivateWorkspace(context);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('keykeeperKeys', apiKeysProvider);
    vscode.window.registerTreeDataProvider('keykeeperProjects', projectsProvider);
    vscode.window.registerTreeDataProvider('keykeeperRecent', recentProvider);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('keykeeper.insertKey', (key?) =>
            insertKeyCommand(keykeeperService, key)
        ),
        vscode.commands.registerCommand('keykeeper.browseKeys', () =>
            browseKeysCommand(keykeeperService)
        ),
        vscode.commands.registerCommand('keykeeper.quickSearch', () =>
            quickSearchCommand(keykeeperService)
        ),
        vscode.commands.registerCommand('keykeeper.syncProject', () =>
            syncProjectCommand(keykeeperService)
        ),
        vscode.commands.registerCommand('keykeeper.createKey', () =>
            createKeyCommand(keykeeperService)
        ),
        vscode.commands.registerCommand('keykeeper.refreshKeys', () =>
            refreshKeysCommand(apiKeysProvider, projectsProvider, recentProvider)
        ),
        vscode.commands.registerCommand('keykeeper.openSettings', () =>
            openSettingsCommand()
        ),
        vscode.commands.registerCommand('keykeeper.authenticate', () =>
            authenticateCommand(keykeeperService)
        )
    ];

    // Add commands to context
    commands.forEach(command => context.subscriptions.push(command));

    // Set context when KeyKeeper is available and logged in
    checkKeykeeperAvailability().then(async (isAvailable) => {
        if (isAvailable) {
            await checkLoginStatus();
        }
    });

    // Auto-sync if enabled
    const config = vscode.workspace.getConfiguration('keykeeper');
    if (config.get('autoSync')) {
        startAutoSync();
    }

    // Start periodic workspace sync
    startWorkspaceSync();

    // Show welcome message
    vscode.window.showInformationMessage(
        'KeyKeeper extension activated! Use Cmd+Shift+K to quick search API keys.',
        'Open KeyKeeper'
    ).then(selection => {
        if (selection === 'Open KeyKeeper') {
            vscode.commands.executeCommand('keykeeper.openSettings');
        }
    });
}

export function deactivate() {
    console.log('KeyKeeper extension is now deactivated.');
    if (keykeeperService) {
        keykeeperService.disconnect();
    }
}

async function checkKeykeeperAvailability(): Promise<boolean> {
    try {
        const isAvailable = await keykeeperService.isAppRunning();
        await vscode.commands.executeCommand('setContext', 'keykeeper:enabled', isAvailable);

        if (!isAvailable) {
            vscode.window.showWarningMessage(
                'KeyKeeper desktop app is not running. Please start the app to use the extension.',
                'Open KeyKeeper',
                'Settings'
            ).then(selection => {
                if (selection === 'Open KeyKeeper') {
                    vscode.env.openExternal(vscode.Uri.parse('keykeeper://'));
                } else if (selection === 'Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'keykeeper');
                }
            });
        }
        return isAvailable;
    } catch (error) {
        console.error('Error checking KeyKeeper availability:', error);
        await vscode.commands.executeCommand('setContext', 'keykeeper:enabled', false);
        return false;
    }
}

async function checkLoginStatus() {
    const isLoggedIn = keykeeperService.isLoggedIn();
    await vscode.commands.executeCommand('setContext', 'keykeeper:loggedIn', isLoggedIn);

    if (!isLoggedIn) {
        vscode.window.showInformationMessage(
            'You are not logged in to KeyKeeper. Please log in to use the extension features.',
            'Login Now'
        ).then(selection => {
            if (selection === 'Login Now') {
                vscode.commands.executeCommand('keykeeper.authenticate');
            }
        });
    }
}

function startAutoSync() {
    // Sync every 30 seconds if auto-sync is enabled
    setInterval(async () => {
        try {
            await apiKeysProvider.refresh();
            await projectsProvider.refresh();
            await recentProvider.refresh();
        } catch (error) {
            console.error('Auto-sync error:', error);
        }
    }, 30000);
}

// ===============================
//  WORKSPACE AUTO-DETECTION
// ===============================

async function detectAndActivateWorkspace(context: vscode.ExtensionContext) {
    // Send initial workspace folders to main app
    await sendCurrentWorkspaceFolders();

    // Check current workspace
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        await checkAndActivateProjectContext(workspaceFolder.uri.fsPath);
    }

    // Listen for workspace changes
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        // Send updated workspace folders to main app
        await sendCurrentWorkspaceFolders();
        
        if (event.added.length > 0) {
            const newFolder = event.added[0];
            await checkAndActivateProjectContext(newFolder.uri.fsPath);
        }
    });

    context.subscriptions.push(workspaceWatcher);

    // Listen for file system changes to detect new .env files
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.env*');
    
    fileWatcher.onDidCreate(async (uri) => {
        if (isEnvFile(uri.fsPath)) {
            await handleEnvFileDetected(uri.fsPath);
        }
    });

    fileWatcher.onDidChange(async (uri) => {
        if (isEnvFile(uri.fsPath)) {
            await handleEnvFileChanged(uri.fsPath);
        }
    });

    context.subscriptions.push(fileWatcher);
}

async function checkAndActivateProjectContext(projectPath: string) {
    try {
        // Check if KeyKeeper is available
        const isAvailable = await keykeeperService.isAppRunning();
        if (!isAvailable) {
            return;
        }

        // Check if this project has associated .env files
        const associations = await keykeeperService.getProjectEnvAssociations(projectPath);
        
        if (associations.length > 0) {
            // Activate project context in KeyKeeper
            const activated = await keykeeperService.activateProjectContext(projectPath);
            
            if (activated) {
                // Update extension context
                await vscode.commands.executeCommand('setContext', 'keykeeper:projectActive', true);
                await vscode.commands.executeCommand('setContext', 'keykeeper:projectPath', projectPath);
                
                // Show notification
                const envCount = associations.length;
                const envFiles = associations.map(a => a.env_file_name).join(', ');
                
                vscode.window.showInformationMessage(
                    `🔐 KeyKeeper activated for this project! Found ${envCount} associated .env file(s): ${envFiles}`,
                    'Show Keys',
                    'Settings'
                ).then(selection => {
                    if (selection === 'Show Keys') {
                        vscode.commands.executeCommand('keykeeper.browseKeys');
                    } else if (selection === 'Settings') {
                        vscode.commands.executeCommand('keykeeper.openSettings');
                    }
                });

                // Refresh providers with project-specific data
                await refreshProviders();
                
                console.log(`KeyKeeper project context activated for: ${projectPath}`);
            }
        } else {
            // No associations found, check for .env files in current project
            await scanForEnvFiles(projectPath);
        }
    } catch (error) {
        console.error('Error checking project context:', error);
    }
}

async function scanForEnvFiles(projectPath: string) {
    try {
        const envFiles = await vscode.workspace.findFiles('**/.env*', '**/node_modules/**', 10);
        
        if (envFiles.length > 0) {
            const envFilePaths = envFiles.map(file => file.fsPath);
            
            vscode.window.showInformationMessage(
                `Found ${envFiles.length} .env file(s) in this project. Would you like to import them into KeyKeeper?`,
                'Import Now',
                'Ask Later',
                'Never'
            ).then(async selection => {
                if (selection === 'Import Now') {
                    await importEnvFiles(envFilePaths);
                } else if (selection === 'Never') {
                    // Save preference to not ask again for this project
                    const config = vscode.workspace.getConfiguration('keykeeper');
                    const ignoredProjects = config.get<string[]>('ignoredProjects', []);
                    ignoredProjects.push(projectPath);
                    await config.update('ignoredProjects', ignoredProjects, vscode.ConfigurationTarget.Global);
                }
            });
        }
    } catch (error) {
        console.error('Error scanning for .env files:', error);
    }
}

async function importEnvFiles(envFilePaths: string[]) {
    try {
        let successCount = 0;
        let errorCount = 0;

        for (const filePath of envFilePaths) {
            try {
                const result = await keykeeperService.parseAndRegisterEnvFile(filePath);
                
                if (result.keys.filter(k => k.is_secret).length > 0) {
                    // Show import dialog
                    const importSelection = await vscode.window.showInformationMessage(
                        `Import ${result.keys.filter(k => k.is_secret).length} API keys from ${result.file_name}?`,
                        { detail: `Project: ${result.project_path}` },
                        'Import',
                        'Skip'
                    );

                    if (importSelection === 'Import') {
                        await keykeeperService.associateProjectWithEnv(
                            result.project_path,
                            result.path,
                            result.file_name
                        );
                        successCount++;
                    }
                }
            } catch (error) {
                console.error(`Error importing ${filePath}:`, error);
                errorCount++;
            }
        }

        if (successCount > 0) {
            vscode.window.showInformationMessage(
                `Successfully imported ${successCount} .env file(s) into KeyKeeper!`
            );
            await refreshProviders();
        }

        if (errorCount > 0) {
            vscode.window.showWarningMessage(
                `Failed to import ${errorCount} .env file(s). Check the output panel for details.`
            );
        }
    } catch (error) {
        console.error('Error importing .env files:', error);
        vscode.window.showErrorMessage('Failed to import .env files. Please try again.');
    }
}

async function handleEnvFileDetected(filePath: string) {
    try {
        // Check if this project is ignored
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) return;

        const config = vscode.workspace.getConfiguration('keykeeper');
        const ignoredProjects = config.get<string[]>('ignoredProjects', []);
        
        if (ignoredProjects.includes(workspaceFolder.uri.fsPath)) {
            return;
        }

        // Parse the new .env file
        const result = await keykeeperService.parseAndRegisterEnvFile(filePath);
        
        if (result.keys.filter(k => k.is_secret).length > 0) {
            vscode.window.showInformationMessage(
                `New .env file detected with ${result.keys.filter(k => k.is_secret).length} API keys. Import into KeyKeeper?`,
                'Import',
                'Ignore'
            ).then(async selection => {
                if (selection === 'Import') {
                    await keykeeperService.associateProjectWithEnv(
                        result.project_path,
                        result.path,
                        result.file_name
                    );
                    await refreshProviders();
                }
            });
        }
    } catch (error) {
        console.error('Error handling new .env file:', error);
    }
}

async function handleEnvFileChanged(filePath: string) {
    try {
        // Re-parse the changed .env file and update associations if needed
        const result = await keykeeperService.parseAndRegisterEnvFile(filePath);
        
        // Check if this file is already associated
        const associations = await keykeeperService.getProjectEnvAssociations();
        const existingAssociation = associations.find(a => a.env_file_path === filePath);
        
        if (existingAssociation) {
            const newSecrets = result.keys.filter(k => k.is_secret).length;
            
            if (newSecrets > 0) {
                vscode.window.showInformationMessage(
                    `${result.file_name} updated with ${newSecrets} API keys. Update KeyKeeper?`,
                    'Update',
                    'Ignore'
                ).then(async selection => {
                    if (selection === 'Update') {
                        await keykeeperService.associateProjectWithEnv(
                            result.project_path,
                            result.path,
                            result.file_name
                        );
                        await refreshProviders();
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error handling .env file change:', error);
    }
}

function isEnvFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    return fileName.startsWith('.env') || fileName.includes('.env.');
}

async function refreshProviders() {
    try {
        await apiKeysProvider.refresh();
        await projectsProvider.refresh();
        await recentProvider.refresh();
    } catch (error) {
        console.error('Error refreshing providers:', error);
    }
}

async function sendCurrentWorkspaceFolders() {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // Send empty array to indicate no workspaces open
            await keykeeperService.sendWorkspaceFolders([]);
            return;
        }

        const workspacePaths = workspaceFolders.map(folder => folder.uri.fsPath);
        const success = await keykeeperService.sendWorkspaceFolders(workspacePaths);
        
        if (success) {
            console.log(`Successfully sent ${workspacePaths.length} workspace folders to KeyKeeper`);
        } else {
            console.warn('Failed to send workspace folders to KeyKeeper');
        }
    } catch (error) {
        console.error('Error sending workspace folders:', error);
    }
}

function startWorkspaceSync() {
    // Send workspace folders every 30 seconds to keep main app in sync
    setInterval(async () => {
        try {
            await sendCurrentWorkspaceFolders();
        } catch (error) {
            console.error('Workspace sync error:', error);
        }
    }, 30000);
} 