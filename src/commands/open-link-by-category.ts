import { App } from "obsidian";
import { selectNoteByCategory } from "src/choose-note-by-category-modal";
import { getAssociationsForFile } from "src/note-associations";

export const openNoteByCategory = async (app: App): Promise<void> => {
	const activeFile = app.workspace.activeEditor?.file ?? null;
	const selected = await selectNoteByCategory(app, {
		currentFile: activeFile,
		associations: activeFile
			? getAssociationsForFile(app, activeFile)
			: null,
	});
	if (!selected) return;

	await app.workspace.getLeaf(false).openFile(selected.file);
};