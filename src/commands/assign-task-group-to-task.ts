import { App, Notice, TFile } from "obsidian";
import { getTask, getActiveTask } from "src/tasks";
import { isActiveFileTask } from "src/utilities";
import { getTaskGroups } from "src/tasks";
import { taskGroupSelectorOptions } from "src/choose-task-group-modal";
import { ConductorSelectorModal } from "src/conductor-selector-modal";

export function isTaskTaskGroupAssignable(app: App): boolean {
	return isActiveFileTask(app);
}

export async function assignTaskGroupToTask(
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

	const currentGroup = task.taskGroups?.[0]?.trim() || null;
	const groups = getTaskGroups(app);
	const options = taskGroupSelectorOptions(groups, currentGroup);

	let selectedByUser = false;
	const chosen = await ConductorSelectorModal.show<string | null>(app, {
		...options,
		onSelectAsync: async () => {
			selectedByUser = true;
			return true;
		},
	});

	if (!selectedByUser) return;

	await app.fileManager.processFrontMatter(targetFile, (fm) => {
		if (chosen) {
			fm["task-groups"] = [chosen];
		} else {
			delete fm["task-groups"];
			delete fm["task-group"];
		}
	});

	new Notice(
		chosen
			? `Task [${task.name}] assigned to task group [${chosen}]...`
			: `Task group cleared for task [${task.name}]...`,
	);
}

export async function assignTaskGroupToActiveTask(app: App): Promise<void> {
	await assignTaskGroupToTask(app);
}
