import * as vscode from 'vscode';
import { KeyKeeperService } from '../utils/keykeeperService';

let keykeeperService: KeyKeeperService;

// Initialize service instance
function getService(): KeyKeeperService {
    if (!keykeeperService) {
        keykeeperService = new KeyKeeperService();
    }
    return keykeeperService;
}

export async function autoDetectAndGenerate(): Promise<void> {
    try {
        const service = getService();
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const filePath = activeEditor.document.uri.fsPath;

        // Show progress while detecting
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "🤖 Auto-detecting API providers...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                // Auto-detect API provider from current file/context
                const detectionResult = await service.autoDetectAPIProvider(filePath);
                progress.report({ increment: 50 });

                if (detectionResult && detectionResult.data) {
                    const provider = detectionResult.data.provider;
                    const confidence = detectionResult.data.confidence;

                    progress.report({ increment: 100 });

                    // Show detection result and ask if user wants to generate config
                    const action = await vscode.window.showInformationMessage(
                        `🎯 Detected ${provider.name} (${Math.round(confidence * 100)}% confidence). Generate configuration?`,
                        'Generate Config',
                        'Preview First',
                        'Cancel'
                    );

                    if (action === 'Generate Config') {
                        await generateProviderConfig(provider.id);
                    } else if (action === 'Preview First') {
                        await previewProviderConfig(provider.id);
                    }
                } else {
                    progress.report({ increment: 100 });
                    vscode.window.showInformationMessage('No API providers detected in current context');
                }
            } catch (error: any) {
                progress.report({ increment: 100 });
                vscode.window.showErrorMessage(`Auto-detection failed: ${error.message}`);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Auto-detect failed: ${error.message}`);
    }
}

export async function generateProviderConfig(providerId?: string): Promise<void> {
    try {
        const service = getService();
        let selectedProviderId = providerId;

        if (!selectedProviderId) {
            // Let user select from available providers
            const providers = await service.getAPIProviders();

            const items = providers.map(p => ({
                label: p.name,
                description: p.description,
                id: p.id
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select API provider to generate configuration for'
            });

            if (!selected) return;
            selectedProviderId = selected.id;
        }

        // Get current workspace info for context
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const options = {
            workspace_path: workspaceFolder?.uri.fsPath,
            framework: await detectFramework(),
            output_format: 'typescript' // Default, could be configurable
        };

        // Show progress while generating
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "📝 Generating API configuration...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                if (!selectedProviderId) {
                    vscode.window.showInformationMessage('No provider selected');
                    return;
                }
                const result = await service.generateAPIConfiguration(selectedProviderId, options);
                progress.report({ increment: 100 });

                if (result.success) {
                    // Show success and offer to open generated files
                    const action = await vscode.window.showInformationMessage(
                        `✅ Configuration generated successfully!`,
                        'Open Files',
                        'View Details'
                    );

                    if (action === 'Open Files') {
                        await openGeneratedFiles(result.data);
                    } else if (action === 'View Details') {
                        await showGenerationDetails(result.data);
                    }
                } else {
                    vscode.window.showErrorMessage(`Generation failed: ${result.message}`);
                }
            } catch (error: any) {
                progress.report({ increment: 100 });
                vscode.window.showErrorMessage(`Configuration generation failed: ${error.message}`);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to generate configuration: ${error.message}`);
    }
}

export async function smartGenerate(): Promise<void> {
    try {
        const service = getService();
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        // Analyze current context for smart suggestions
        const context = {
            file_path: activeEditor.document.uri.fsPath,
            file_content: activeEditor.document.getText(),
            cursor_position: activeEditor.selection.active,
            workspace_folder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        };

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "✨ Smart generating based on context...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                // First detect what's needed in current context
                const detectionResult = await service.autoDetectAPIProvider(context.file_path);
                progress.report({ increment: 30 });

                if (detectionResult && detectionResult.data) {
                    const provider = detectionResult.data.provider;

                    // Generate context-aware configuration
                    const options = {
                        context: context,
                        smart_mode: true,
                        auto_insert: false // Don't auto-insert, let user review
                    };

                    const result = await service.generateAPIConfiguration(provider.id, options);
                    progress.report({ increment: 100 });

                    if (result.success) {
                        // Show smart generation result
                        await showSmartGenerationResult(result.data, context);
                    } else {
                        vscode.window.showErrorMessage(`Smart generation failed: ${result.message}`);
                    }
                } else {
                    progress.report({ increment: 100 });

                    // Fallback to manual provider selection
                    vscode.window.showInformationMessage(
                        'No specific API detected. Choose a provider manually?',
                        'Choose Provider'
                    ).then(action => {
                        if (action === 'Choose Provider') {
                            generateProviderConfig();
                        }
                    });
                }
            } catch (error: any) {
                progress.report({ increment: 100 });
                vscode.window.showErrorMessage(`Smart generation failed: ${error.message}`);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Smart generation failed: ${error.message}`);
    }
}

async function previewProviderConfig(providerId: string): Promise<void> {
    try {
        const service = getService();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        const options = {
            workspace_path: workspaceFolder?.uri.fsPath,
            framework: await detectFramework(),
            preview_mode: true
        };

        const result = await service.previewGeneratedConfig(providerId, options);

        if (result.success) {
            // Show preview in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(result.data, null, 2),
                language: 'json'
            });

            await vscode.window.showTextDocument(doc);

            // Ask if user wants to proceed with actual generation
            const action = await vscode.window.showInformationMessage(
                'Preview shown. Generate actual configuration?',
                'Generate',
                'Cancel'
            );

            if (action === 'Generate') {
                await generateProviderConfig(providerId);
            }
        } else {
            vscode.window.showErrorMessage(`Preview failed: ${result.message}`);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Preview failed: ${error.message}`);
    }
}

async function detectFramework(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return 'typescript';

    // Check for common framework files
    const files = await vscode.workspace.findFiles('package.json', null, 1);
    if (files.length > 0) {
        try {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            const content = JSON.parse(doc.getText());

            if (content.dependencies) {
                if (content.dependencies['next']) return 'nextjs';
                if (content.dependencies['react']) return 'react';
                if (content.dependencies['vue']) return 'vue';
                if (content.dependencies['@angular/core']) return 'angular';
                if (content.dependencies['express']) return 'express';
            }
        } catch (error) {
            // Ignore parsing errors
        }
    }

    return 'typescript';
}

async function openGeneratedFiles(generatedData: any): Promise<void> {
    if (generatedData.files && Array.isArray(generatedData.files)) {
        for (const file of generatedData.files) {
            try {
                const uri = vscode.Uri.file(file.path);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                console.error(`Failed to open file ${file.path}:`, error);
            }
        }
    }
}

async function showGenerationDetails(generatedData: any): Promise<void> {
    const details = [
        `## Generated Configuration`,
        ``,
        `**Files created:** ${generatedData.files?.length || 0}`,
        `**Dependencies:** ${generatedData.dependencies?.length || 0}`,
        ``,
        `### Setup Instructions:`,
        ...(generatedData.setup_instructions || []).map((instruction: string) => `- ${instruction}`),
        ``,
        `### Next Steps:`,
        ...(generatedData.next_steps || []).map((step: string) => `- ${step}`)
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

async function showSmartGenerationResult(generatedData: any, context: any): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        `✨ Smart generation complete! Generated ${generatedData.files?.length || 0} files based on your context.`,
        'Insert at Cursor',
        'Open Files',
        'View Details'
    );

    if (action === 'Insert at Cursor') {
        // Insert the main generated code at cursor position
        const editor = vscode.window.activeTextEditor;
        if (editor && generatedData.files && generatedData.files.length > 0) {
            const mainFile = generatedData.files[0];
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, mainFile.content);
            });
        }
    } else if (action === 'Open Files') {
        await openGeneratedFiles(generatedData);
    } else if (action === 'View Details') {
        await showGenerationDetails(generatedData);
    }
}