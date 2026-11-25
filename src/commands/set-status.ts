import type { WorkspaceLeaf } from "obsidian";
import { App, MarkdownView, Notice, TFile, moment } from "obsidian";
import {
	getTask,
	getActiveTask,
	TaskStatus,
	Task,
	isQuestionTask,
	taskHasAnswer,
	promptForOptionalQuestionAnswer,
	closedTaskTypes,
} from "src/tasks";
import {
	getProjectFromFile,
	getActiveProject,
	ProjectStatus,
	updateProject,
} from "src/projects";
import { getStatusDisplay } from "src/utilities";

export const setTaskStatusForFiles = async (
	app: App,
	files: TFile[],
	status: TaskStatus,
	options?: { openParentProjectIfTaskClosed?: boolean },
): Promise<void> => {
	const statusChangeDt = moment().format("YYYY-MM-DDTHH:mm:ss");
	let updatedCount = 0;
	let lastUpdatedTaskName: string | null = null;

	for (const file of files) {
		const task = getTask(app, file.path);
		if (!task) continue;
		const answerToSave =
			status === TaskStatus.Done &&
			task.status !== TaskStatus.Done &&
			isQuestionTask(task) &&
			!taskHasAnswer(app, file)
				? await promptForOptionalQuestionAnswer(app, task.name)
				: null;

		let didChange = false;
		await app.fileManager.processFrontMatter(file, (fm) => {
			if (fm["status"] !== status) {
				fm["status"] = status;
				fm["meta-last-status-change-dt"] = statusChangeDt;
				didChange = true;
			}
			if (answerToSave) {
				fm["answer"] = answerToSave;
				didChange = true;
			}
			if (status === TaskStatus.Done && Array.isArray(fm["tags"])) {
				const idx = fm["tags"].indexOf("inbox");
				if (idx !== -1) {
					fm["tags"].splice(idx, 1);
					didChange = true;
				}
			}
		});

		if (!didChange) continue;
		updatedCount++;
		lastUpdatedTaskName = task.name;
	}

	if (updatedCount === 0) return;

	if (updatedCount === 1 && lastUpdatedTaskName) {
		new Notice(
			`Task [${lastUpdatedTaskName}] set to [${getStatusDisplay(status)}]...`,
		);
	} else {
		new Notice(
			`Status set to ${getStatusDisplay(status)} for ${updatedCount} tasks`,
		);
	}

	if (
		options?.openParentProjectIfTaskClosed &&
		closedTaskTypes.includes(status) &&
		updatedCount > 0
	) {
		const activeProject = getActiveProject(app);
		if (
			activeProject &&
			!isFileOpenInAnyTab(app, activeProject.file)
		) {
			await app.workspace.getLeaf(false).openFile(activeProject.file);
		}
	}
};

// If the project is already open anywhere, do not open another instance and
// do not change focus. Getting a leaf is deliberately delayed until we know
// one is actually needed, because getLeaf(false) can itself change focus.
const isFileOpenInAnyTab = (app: App, file: TFile): boolean => {
	let found = false;
	app.workspace.iterateAllLeaves((leaf) => {
		if (found) return;
		if (getOpenFilePath(leaf) === file.path) found = true;
	});
	return found;
};

const getOpenFilePath = (leaf: WorkspaceLeaf): string | null => {
	const viewFile = (leaf.view as MarkdownView).file;
	if (viewFile) return viewFile.path;

	const stateFile = leaf.getViewState().state?.file;
	return typeof stateFile === "string" ? stateFile : null;
};

export const setActiveTaskStatus = (
	app: App,
	status: TaskStatus,
): void => {
	const activeTask = getActiveTask(app);
	if (!activeTask) return;
	void setTaskStatusForFiles(app, [activeTask.file], status, {
		openParentProjectIfTaskClosed: true,
	});
};

export const setTaskStatus = (
	app: App,
	file: TFile,
	status: TaskStatus,
): void => {
	void setTaskStatusForFiles(app, [file], status, {
		openParentProjectIfTaskClosed: false,
	});
};

export const setActiveProjectStatus = (
	app: App,
	status: ProjectStatus,
): void => {
	const activeFile = app.workspace.activeEditor?.file;
	if (!activeFile) return;
	setProjectStatus(app, activeFile, status);
};

export const setProjectStatus = (
	app: App,
	file: TFile,
	status: ProjectStatus,
): void => {
	const project = getProjectFromFile(app, file);
	if (project) {
		project.status = status;
		updateProject(app, project);
		new Notice(
			`Project [${project.name}] set to [${getStatusDisplay(status)}]...`,
		);
	}
};
