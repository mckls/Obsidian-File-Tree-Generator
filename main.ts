import { App, Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice, MarkdownView } from 'obsidian';

interface FileTreePluginSettings {
	useRelativePaths: boolean;
}

const DEFAULT_SETTINGS: FileTreePluginSettings = {
	useRelativePaths: false,
};

export default class FileTreePlugin extends Plugin {
	settings: FileTreePluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FileTreeSettingTab(this.app, this));
		this.addCommand({
			id: 'file-tree',
			name: 'Generate File Tree',
			callback: () => this.insertFileTreeInCurrentFile(),
		});
	}

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	private async saveSettings() {
		await this.saveData(this.settings);
	}

	private insertFileTreeInCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();
		const activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

		if (!activeFile || !activeEditor) {
			new Notice('No active file or editor found.');
			return;
		}

		const folderPath = this.getFolderPathFromFile(activeFile);
		const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
		if (!folder || !(folder instanceof TFolder)) {
			new Notice(`Folder not found: ${folderPath}`);
			return;
		}

		const fileTreeMarkdown = this.generateMarkdownTree(folder, activeFile);
		const cursor = activeEditor.getCursor();
		activeEditor.replaceRange(fileTreeMarkdown, cursor);
		new Notice('File tree inserted successfully!');
	}

	private getFolderPathFromFile(file: TFile): string {
		const filePath = file.path;
		return filePath.substring(0, filePath.lastIndexOf('/')) || '/';
	}

	private generateMarkdownTree(folder: TFolder, activeFile: TFile, indent: string = ''): string {
		const folderLink = this.settings.useRelativePaths 
			? this.getManualRelativePath(activeFile, folder.path) 
			: `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&folder=${encodeURIComponent(folder.path)}`;
		let markdown = `${indent}- [📂 ${folder.name}](${folderLink})\n`;

		const children = folder.children.sort((a, b) => a.name.localeCompare(b.name));

		for (const child of children) {
			if (child instanceof TFolder) {
				markdown += this.generateMarkdownTree(child, activeFile, indent + '  ');
			} else if (child instanceof TFile) {
				const link = this.settings.useRelativePaths 
					? this.getManualRelativePath(activeFile, child.path) 
					: `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(child.path)}`;
				markdown += `${indent}  - [${child.name}](${link})\n`;
			}
		}

		return markdown;
	}

	private getManualRelativePath(activeFile: TFile, targetPath: string): string {
		const activeDir = activeFile.path.substring(0, activeFile.path.lastIndexOf('/'));
		const relativePath = targetPath.replace(activeDir + '/', '');
		return encodeURI(relativePath);
	}
}

class FileTreeSettingTab extends PluginSettingTab {
	plugin: FileTreePlugin;

	constructor(app: App, plugin: FileTreePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'File Tree Generator' });
		new Setting(containerEl)
			.setName('Generate Relative Paths')
			.setDesc('Generate links with relative paths instead of Obsidian URLs.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useRelativePaths)
				.onChange(async (value) => {
					this.plugin.settings.useRelativePaths = value;
					await this.plugin['saveSettings'](); // Zugriff auf private Methode über Indexzugriff
				}));
	}
}