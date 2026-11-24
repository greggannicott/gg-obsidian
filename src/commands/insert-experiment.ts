import { App, MarkdownView, Notice, TFile } from "obsidian";
import { showExperimentSelectorWithCreate } from "src/choose-experiment-modal";
import {
	replaceSelectionRangeOrInsert,
	SelectionRange,
} from "src/editor-utils";
import { createNewExperiment } from "src/experiments";
import { TextInputModal } from "src/text-input-modal";

export const insertExperiment = async (app: App): Promise<boolean> => {
	const activeView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeView) {
		new Notice("No active editor to insert into");
		return false;
	}

	const editor = activeView.editor;
	const selectedText = editor.getSelection() ?? "";
	const selectedRange: SelectionRange | null = selectedText
		? { from: editor.getCursor("from"), to: editor.getCursor("to") }
		: null;

	const choice = await showExperimentSelectorWithCreate(app);
	if (!choice) return false;

	let file: TFile;
	if (choice.kind === "create") {
		const result = await TextInputModal.show(app, {
			title: "Experiment Name",
			placeholder: "Enter experiment name...",
			value: selectedText,
		});
		if (result.cancelled) return false;

		const name = result.value.trim();
		if (!name) {
			new Notice("An experiment name is required");
			return false;
		}

		const created = await createNewExperiment(app, name);
		if (!created) {
			new Notice(
				'Failed to create experiment. Check the name and that the "Short Experiment" template is available.',
			);
			return false;
		}
		file = created;
		new Notice(`Created experiment: ${file.basename}`);
	} else {
		file = choice.experiment.file;
	}

	const defaultDisplay = selectedText || file.basename;
	const prompt = await TextInputModal.show(app, {
		title: "Text to display",
		placeholder: "Text to display",
		value: defaultDisplay,
	});
	if (prompt.cancelled) return false;

	const displayText = prompt.value.trim() || defaultDisplay;
	const sanitizedDisplay = displayText.replace(/\|/g, "").replace(/]]/g, "]");
	const link = sanitizedDisplay
		? `[[${file.basename}|${sanitizedDisplay}]]`
		: `[[${file.basename}]]`;
	const inserted = replaceSelectionRangeOrInsert(
		editor,
		selectedRange,
		selectedText,
		link,
	);
	if (!inserted) return false;

	new Notice(`Inserted link to "${sanitizedDisplay || file.basename}"`);
	return true;
};
