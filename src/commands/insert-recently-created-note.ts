import { App, MarkdownView, Notice, TFile, moment } from "obsidian";
import { ConductorSelectorModal } from "src/conductor-selector-modal";
import { TextInputModal } from "src/text-input-modal";

const getCreatedTime = (file: TFile): string =>
	moment(file.stat.ctime).format("HH:mm");

export const insertRecentlyCreatedNote = async (app: App): Promise<boolean> => {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) {
		new Notice("No active editor to insert into");
		return false;
	}

	const today = moment().format("YYYY-MM-DD");
	const notes = app.vault
		.getMarkdownFiles()
		.filter(
			(file) =>
				file.path !== activeView.file?.path &&
				!file.path.startsWith("_templates/") &&
				moment(file.stat.ctime).format("YYYY-MM-DD") === today,
		)
		.sort(
			(a, b) =>
				b.stat.ctime - a.stat.ctime || a.basename.localeCompare(b.basename),
		);
	if (notes.length === 0) {
		new Notice("No notes created today");
		return false;
	}

	const selected = await ConductorSelectorModal.show(app, {
		items: notes,
		placeholder: "Select a note created today...",
		emptyText: "No notes created today",
		getText: (file) => file.basename,
		getTitlePrefix: getCreatedTime,
		getSearchText: (file) => `${getCreatedTime(file)} ${file.basename}`,
		sortItems: (a, b) =>
			b.stat.ctime - a.stat.ctime || a.basename.localeCompare(b.basename),
	});
	if (!selected) return false;

	const label = selected.basename;
	const prompt = await TextInputModal.show(app, {
		title: "Text to display",
		placeholder: "Text to display",
		value: label,
	});
	if (prompt.cancelled) return false;

	const displayText = prompt.value.trim() || label;
	activeView.editor.replaceSelection(`[[${selected.basename}|${displayText}]]`);
	new Notice(`Inserted link to "${displayText}"`);
	return true;
};
