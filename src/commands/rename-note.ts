import { App, Notice, TFile } from "obsidian";

import { TextInputModal } from "src/text-input-modal";

/**
 * Prompt for a new name and rename the note in place, preserving its folder
 * and file extension. A no-op (no rename) when the user cancels or enters
 * the same name.
 */
export async function renameNote(app: App, file: TFile): Promise<void> {
	const { value, cancelled } = await TextInputModal.showValidated(app, {
		title: "Rename Note",
		value: file.basename,
		description: "Enter a new name for the note.",
	}, (trimmed) => {
		if (!trimmed) return "Name cannot be empty.";
		if (trimmed.includes("/") || trimmed.includes("\\")) {
			return "Name cannot contain path separators.";
		}
		const ext = file.extension ? `.${file.extension}` : "";
		const folder =
			file.parent && file.parent.path && file.parent.path !== "/"
				? file.parent.path
				: "";
		const newPath = folder
			? `${folder}/${trimmed}${ext}`
			: `${trimmed}${ext}`;
		if (newPath === file.path) return null;
		if (app.vault.getFileByPath(newPath)) {
			return "A file with that name already exists.";
		}
		return null;
	});

	if (cancelled) return;
	if (!value || value === file.basename) return;

	const ext = file.extension ? `.${file.extension}` : "";
	const folder =
		file.parent && file.parent.path && file.parent.path !== "/"
			? file.parent.path
			: "";
	const newPath = folder ? `${folder}/${value}${ext}` : `${value}${ext}`;
	if (newPath === file.path) return;

	await app.vault.rename(file, newPath);
	new Notice(`Renamed to ${value}`);
}