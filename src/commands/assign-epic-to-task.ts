import { App, Notice, TFile } from "obsidian";
import { getTask, getActiveTask } from "src/tasks";
import { isActiveFileTask } from "src/utilities";
import { getEpics, getEpicFromFrontmatter } from "src/epics";
import { epicSelectorOptions } from "src/choose-epic-modal";
import { ConductorSelectorModal } from "src/conductor-selector-modal";
import type { EpicChoice } from "src/choose-epic-modal";

export function isTaskEpicAssignable(app: App): boolean {
	return isActiveFileTask(app);
}

export async function assignEpicToTask(
	app: App,
	file?: TFile,
): Promise<void> {
	const targetFile = file ?? app.workspace.activeEditor?.file;
	if (!targetFile) {
		new Notice("No active task.");
		return;
	}

	const task = getTask(app, targetFile.path);
	if (!task) {
		new Notice(`[${targetFile.name}] is not a task.`);
		return;
	}

	const currentEpic = getEpicFromFrontmatter(app, targetFile);
	const epics = getEpics(app);
	const preselected = epics.find(
		(epic) => epic.path === currentEpic?.path,
	);

	let selectedByUser = false;
	const chosen = await ConductorSelectorModal.show<EpicChoice>(app, {
		...epicSelectorOptions(epics),
		placeholder: `Select an epic or “No epic”...`,
		initialValue: preselected?.name,
		onSelectAsync: async () => {
			selectedByUser = true;
			return true;
		},
	});

	if (!selectedByUser) return;

	await app.fileManager.processFrontMatter(targetFile, (fm) => {
		if (chosen) {
			fm["epic"] = [`[[${chosen.name}]]`];
		} else {
			delete fm["epic"];
		}
	});

	new Notice(
		chosen
			? `Task [${task.name}] assigned to epic [${chosen.name}]...`
			: `Epic cleared for task [${task.name}]...`,
	);
}

export async function assignEpicToActiveTask(app: App): Promise<void> {
	await assignEpicToTask(app);
}
