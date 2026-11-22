import { App, Notice } from "obsidian";

import {
	convertNoteToTask,
	isNoteConvertible,
} from "../commands/convert-note-to-task";
import {
	createTaskFromNote,
	isNoteTaskCreatable,
} from "../commands/create-task-from-note";
import { renameNote } from "../commands/rename-note";
import { removeTag, toggleTag, fileHasTag } from "../utilities";
import type { TriageAction } from "./triage-view";

/**
 * The actions behind the Inbox Triage buttons. The file context menu reuses
 * these so its items always match the buttons in the view.
 */
export function getInboxTriageActions(app: App): TriageAction[] {
	return [
		{
			icon: "tag",
			tooltip: "Remove #inbox tag",
			menuTitle: "Remove #inbox Tag",
			run: (target) => removeTag(app, target, "inbox"),
		},
		{
			icon: "brain",
			tooltip: (target) =>
				fileHasTag(app, target, "requires-thought")
					? "Remove #requires-thought tag"
					: "Add #requires-thought tag",
			menuTitle: (target) =>
				fileHasTag(app, target, "requires-thought")
					? "Remove #requires-thought Tag"
					: "Add #requires-thought Tag",
			active: (target) => fileHasTag(app, target, "requires-thought"),
			run: async (target) => {
				const wasSet = fileHasTag(app, target, "requires-thought");
				await toggleTag(app, target, "requires-thought");
				new Notice(
					wasSet
						? "Removed #requires-thought"
						: "Added #requires-thought",
				);
			},
		},
		{
			icon: "pencil",
			tooltip: "Rename note",
			menuTitle: "Rename Note",
			run: (target) => renameNote(app, target),
		},
		{
			icon: "circle-arrow-right",
			tooltip: "Convert note to task",
			menuTitle: "Convert to Task",
			disabled: (target) => !isNoteConvertible(app, target),
			run: (target) => convertNoteToTask(app, target),
		},
		{
			icon: "file-plus",
			tooltip: "Create task from note",
			menuTitle: "Create Task from Note",
			disabled: (target) => !isNoteTaskCreatable(app, target),
			run: (target) => createTaskFromNote(app, target),
		},
		{
			icon: "trash",
			tooltip: "Delete note",
			menuTitle: "Delete Note",
			cls: "conductor-triage-action--delete",
			warning: true,
			run: (target) => app.fileManager.trashFile(target),
		},
	];
}