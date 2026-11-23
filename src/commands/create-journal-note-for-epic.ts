import { App } from "obsidian";
import { showEpicSelectorSingle } from "src/choose-epic-modal";
import { getEpicForActiveFile } from "src/epics";
import { createJournalNote, promptJournalNoteTitle } from "src/journal";

export const createJournalNoteForEpic = async (app: App): Promise<void> => {
	const epic = await showEpicSelectorSingle(app, getEpicForActiveFile(app));
	if (!epic) return;

	const title = await promptJournalNoteTitle(app);
	if (!title) return;

	await createJournalNote(app, title, (fm) => {
		fm.topics = [`[[${epic.name}]]`];
	});
};
