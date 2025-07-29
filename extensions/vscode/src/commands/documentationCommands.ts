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

export async function showDocumentationViewer(): Promise<void> {
    try {
        const service = getService();
        
        // Get all documentation entries
        const docs = await service.getAllDocumentation();
        
        if (docs.length === 0) {
            const action = await vscode.window.showInformationMessage(
                'No documentation found. Would you like to add some?',
                'Add Documentation',
                'Search API Docs'
            );
            
            if (action === 'Add Documentation') {
                await addDocumentationForContext();
            } else if (action === 'Search API Docs') {
                await searchAllDocumentation();
            }
            return;
        }

        // Create documentation browser
        const items = docs.map(doc => ({
            label: doc.title,
            description: doc.provider_id || doc.doc_type,
            detail: doc.content.substring(0, 100) + '...',
            doc: doc
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '📚 Browse API Documentation',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await showDocumentationDetail(selected.doc);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to show documentation: ${error.message}`);
    }
}

export async function addDocumentationForContext(): Promise<void> {
    try {
        const service = getService();
        const activeEditor = vscode.window.activeTextEditor;
        
        // Get documentation details from user
        const title = await vscode.window.showInputBox({
            placeHolder: 'Enter documentation title',
            prompt: 'Title for this documentation entry'
        });
        if (!title) return;

        const docTypeItems = [
            { label: 'API Reference', value: 'api' },
            { label: 'Guide', value: 'guide' },
            { label: 'Code Snippet', value: 'snippet' },
            { label: 'Notes', value: 'notes' }
        ];

        const docType = await vscode.window.showQuickPick(docTypeItems, {
            placeHolder: 'Select documentation type'
        });
        if (!docType) return;

        // Check if we should scrape from URL or get manual content
        const sourceMethod = await vscode.window.showQuickPick([
            { label: '🌐 Scrape from URL', value: 'url' },
            { label: '✏️ Manual Entry', value: 'manual' },
            { label: '📄 From Current Selection', value: 'selection' }
        ], {
            placeHolder: 'How would you like to add the documentation?'
        });

        if (!sourceMethod) return;

        let content: string = '';
        let url: string | undefined;
        let tags: string[] = [];

        switch (sourceMethod.value) {
            case 'url':
                url = await vscode.window.showInputBox({
                    placeHolder: 'Enter documentation URL',
                    prompt: 'URL to scrape documentation from'
                });
                if (!url) return;

                // Show progress while scraping
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "🌐 Scraping documentation...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0 });
                    
                    try {
                        const result = await service.scrapeAndSaveDocumentation(url!, title);
                        progress.report({ increment: 100 });
                        
                        vscode.window.showInformationMessage(`✅ Documentation scraped and saved: ${title}`);
                        return;
                    } catch (error: any) {
                        progress.report({ increment: 100 });
                        vscode.window.showErrorMessage(`Scraping failed: ${error.message}`);
                        // Continue with manual entry as fallback
                    }
                });
                break;

            case 'manual':
                content = await vscode.window.showInputBox({
                    placeHolder: 'Enter documentation content',
                    prompt: 'Documentation content (supports Markdown)'
                }) || '';
                break;

            case 'selection':
                if (activeEditor && !activeEditor.selection.isEmpty) {
                    content = activeEditor.document.getText(activeEditor.selection);
                } else {
                    vscode.window.showErrorMessage('No text selected in active editor');
                    return;
                }
                break;
        }

        // Get tags
        const tagsInput = await vscode.window.showInputBox({
            placeHolder: 'Enter tags (comma-separated, optional)',
            prompt: 'Tags to help categorize this documentation'
        });
        
        if (tagsInput) {
            tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        // Add the documentation
        await service.addDocumentationForCurrentAPI(title, content, url, tags);
        
        vscode.window.showInformationMessage(`✅ Documentation added: ${title}`);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to add documentation: ${error.message}`);
    }
}

export async function searchAllDocumentation(): Promise<void> {
    try {
        const service = getService();
        
        // Get search query from user
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search documentation...',
            prompt: 'Enter search terms to find relevant documentation'
        });

        if (!query) return;

        // Show progress while searching
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "🔍 Searching documentation...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            try {
                const results = await service.searchDocumentation(query);
                progress.report({ increment: 100 });
                
                if (results.length === 0) {
                    vscode.window.showInformationMessage(`No documentation found for "${query}"`);
                    return;
                }

                // Show search results
                const items = results.map(result => ({
                    label: result.title,
                    description: `${result.provider_id || result.doc_type} • Score: ${Math.round((result.relevance_score || 1) * 100)}%`,
                    detail: result.snippet || result.content?.substring(0, 100) + '...',
                    doc: result
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `🔍 Search results for "${query}" (${results.length} found)`,
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    await showDocumentationDetail(selected.doc);
                }

            } catch (error: any) {
                progress.report({ increment: 100 });
                vscode.window.showErrorMessage(`Search failed: ${error.message}`);
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to search documentation: ${error.message}`);
    }
}

async function showDocumentationDetail(doc: any): Promise<void> {
    try {
        // Create a detailed view of the documentation
        const content = [
            `# ${doc.title}`,
            '',
            `**Type:** ${doc.doc_type || 'Unknown'}`,
            `**Provider:** ${doc.provider_id || 'None'}`,
            doc.url ? `**URL:** ${doc.url}` : '',
            `**Created:** ${new Date(doc.created_at).toLocaleDateString()}`,
            doc.tags && doc.tags.length > 0 ? `**Tags:** ${doc.tags.join(', ')}` : '',
            '',
            '---',
            '',
            doc.content || 'No content available'
        ].filter(line => line !== '').join('\n');

        // Open in a new document
        const document = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });

        const editor = await vscode.window.showTextDocument(document);

        // Show action buttons
        const action = await vscode.window.showInformationMessage(
            `Viewing: ${doc.title}`,
            'Copy Content',
            'Edit',
            'Delete',
            'Open URL'
        );

        switch (action) {
            case 'Copy Content':
                await vscode.env.clipboard.writeText(doc.content || '');
                vscode.window.showInformationMessage('Content copied to clipboard');
                break;

            case 'Edit':
                await editDocumentation(doc);
                break;

            case 'Delete':
                await deleteDocumentation(doc);
                break;

            case 'Open URL':
                if (doc.url) {
                    vscode.env.openExternal(vscode.Uri.parse(doc.url));
                } else {
                    vscode.window.showInformationMessage('No URL available for this documentation');
                }
                break;
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to show documentation detail: ${error.message}`);
    }
}

async function editDocumentation(doc: any): Promise<void> {
    try {
        const service = getService();
        
        // Get updated content from user
        const newTitle = await vscode.window.showInputBox({
            value: doc.title,
            prompt: 'Update documentation title'
        });
        if (newTitle === undefined) return;

        const newContent = await vscode.window.showInputBox({
            value: doc.content,
            prompt: 'Update documentation content'
        });
        if (newContent === undefined) return;

        const newTags = await vscode.window.showInputBox({
            value: doc.tags ? doc.tags.join(', ') : '',
            prompt: 'Update tags (comma-separated)'
        });

        const updates: any = {
            title: newTitle,
            content: newContent
        };

        if (newTags !== undefined) {
            updates.tags = newTags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
        }

        await service.updateDocumentation(doc.id, updates);
        vscode.window.showInformationMessage(`✅ Documentation updated: ${newTitle}`);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to edit documentation: ${error.message}`);
    }
}

async function deleteDocumentation(doc: any): Promise<void> {
    try {
        const service = getService();
        
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${doc.title}"?`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirmation === 'Delete') {
            await service.deleteDocumentation(doc.id);
            vscode.window.showInformationMessage(`🗑️ Documentation deleted: ${doc.title}`);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to delete documentation: ${error.message}`);
    }
}

export async function addQuickDocumentation(): Promise<void> {
    try {
        const service = getService();
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor || activeEditor.selection.isEmpty) {
            vscode.window.showErrorMessage('Please select some code to document');
            return;
        }

        const selectedText = activeEditor.document.getText(activeEditor.selection);
        const fileName = activeEditor.document.fileName;
        
        // Auto-generate title based on context
        const title = `Code Documentation - ${fileName.split('/').pop()}`;
        
        // Auto-detect API provider if possible
        const detectionResult = await service.autoDetectAPIProvider(fileName);
        let providerId: string | undefined;
        
        if (detectionResult && detectionResult.data) {
            providerId = detectionResult.data.provider.id;
        }

        // Create documentation with selected code
        await service.addDocumentationForCurrentAPI(
            title,
            `\`\`\`${activeEditor.document.languageId}\n${selectedText}\n\`\`\``,
            undefined,
            ['code-snippet', 'auto-generated']
        );
        
        vscode.window.showInformationMessage(`✅ Quick documentation added for selected code`);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to add quick documentation: ${error.message}`);
    }
}