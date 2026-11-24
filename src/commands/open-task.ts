import { App, Notice, moment } from "obsidian";
import {
	ANY_PROJECT,
	showProjectSelectorWithAnyOption,
} from "src/choose-project-modal";
import { getTaskText, showTaskSelector } from "src/choose-task.modal";
import type { ConductorSelectorGrouping } from "src/conductor-selector-modal";
import {
	getProjects,
	getActiveProject,
	ProjectFilters,
	ProjectStatus,
	outstandingProjectTypes,
} from "src/projects";
import {
	getTasks,
	Task,
	TaskFilters,
	TaskType,
	TaskStatus,
	outstandingTaskTypes,
} from "src/tasks";

const openTaskFile = async (app: App, task: Task): Promise<void> => {
	await app.workspace.getLeaf(false).openFile(task.file);
};

export const openTask = async (app: App): Promise<void> => {
	const activeProject = getActiveProject(app);
	if (!activeProject) {
		await openTaskFromAnyProject(app);
		return;
	}

	const task = await showTaskSelector(
		app,
		getTasks(app, {
			projectFilter: {
				projectIs: [activeProject.name],
			},
		}),
		{
			groupModes: ["status", "priority"],
			omitProjectName: true,
		},
	);
	if (!task) return;
	await openTaskFile(app, task);
};

export const openInProgressTask = async (app: App): Promise<void> => {
	const filters: TaskFilters = {
		statusFilter: {
			statusIs: [TaskStatus.InProgress],
		},
		typeFilter: {
			typeExcludes: [TaskType.BlogPost],
		},
		impededFilter: {
			impededIs: false,
		},
	};
	const task = await showTaskSelector(app, getTasks(app, filters));
	if (!task) return;
	await openTaskFile(app, task);
};

export const openTaskFromAnyProject = async (app: App): Promise<void> => {
	const project = await showProjectSelectorWithAnyOption(
		app,
		getProjects(app),
	);
	if (!project) return;

	const taskFilters: TaskFilters = {};
	if (project !== ANY_PROJECT) {
		taskFilters.projectFilter = {
			projectIs: [project.name],
		};
	}
	const task = await showTaskSelector(
		app,
		getTasks(app, taskFilters),
		project === ANY_PROJECT
			? { groupModes: ["status", "project", "priority"] }
			: undefined,
	);
	if (!task) return;
	await openTaskFile(app, task);
};

const RECENT_TASK_DAYS = 3;

const creationDayGrouping: ConductorSelectorGrouping<Task> = {
	id: "creation-day",
	label: "Group by Day",
	buildGroups: (tasks) => {
		const buckets = new Map<string, Task[]>();
		for (const task of tasks) {
			const day = moment(task.file.stat.ctime).format("YYYY-MM-DD");
			const bucket = buckets.get(day);
			if (bucket) {
				bucket.push(task);
			} else {
				buckets.set(day, [task]);
			}
		}
		return [...buckets.entries()]
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([day, items]) => {
				const date = moment(day, "YYYY-MM-DD");
				const header = date.isSame(moment(), "day")
					? "Today"
					: date.isSame(moment().subtract(1, "day"), "day")
						? "Yesterday"
						: date.format("dddd D MMMM");
				return { header, items };
			});
	},
};

export const openRecentlyCreatedTask = async (app: App): Promise<void> => {
	const cutoff = moment().subtract(RECENT_TASK_DAYS - 1, "days").startOf("day");
	const tasks = getTasks(app)
		.filter((task): task is Task => task !== null)
		.filter((task) => moment(task.file.stat.ctime).isSameOrAfter(cutoff));
	if (tasks.length === 0) {
		new Notice(`No tasks created in the last ${RECENT_TASK_DAYS} days`);
		return;
	}

	const task = await showTaskSelector(app, tasks, {
		placeholder: "Select a recently created task...",
		groupings: [creationDayGrouping],
		omitProjectName: true,
		sortItems: (a, b) =>
			b.file.stat.ctime - a.file.stat.ctime ||
			getTaskText(a).localeCompare(getTaskText(b)),
		getTitlePrefix: (task) => moment(task.file.stat.ctime).format("HH:mm"),
		getTitleRightMeta: (task) =>
			task.parents?.map((parent) => parent.name).join(", ") || null,
	});
	if (!task) return;
	await openTaskFile(app, task);
};

export const openTaskFromAnOutstandingProject = async (
	app: App,
): Promise<void> => {
	const projectFilter: ProjectFilters = {
		statusFilter: {
			statusIs: outstandingProjectTypes,
		},
		ongoingFilter: {
			ongoingIs: false,
		},
	};
	const outstandingProjects = getProjects(app, projectFilter);

	const task = await showTaskSelector(
		app,
		getTasks(app, {
			projectFilter: {
				projectIs: outstandingProjects.map((p) => p.name),
			},
			statusFilter: {
				statusIs: outstandingTaskTypes,
			},
		}),
	);
	if (!task) return;
	await openTaskFile(app, task);
};

export const openInProgressTaskFromInProgressProject = async (
	app: App,
): Promise<void> => {
	const projectFilter: ProjectFilters = {
		or: [
			{
				ongoingIs: true,
				statusIsNot: [
					ProjectStatus.Done,
					ProjectStatus.Abandoned,
					ProjectStatus.WontDo,
				],
			},
			{ statusIs: [ProjectStatus.InProgress] },
		],
	};
	const inProgressProjects = getProjects(app, projectFilter);

	const taskFilters: TaskFilters = {
		projectFilter: {
			projectIs: inProgressProjects.map((p) => p.name),
		},
		statusFilter: {
			statusIs: [TaskStatus.InProgress],
		},
	};

	const tasks = getTasks(app, taskFilters);

	if (tasks.length === 1 && tasks[0]?.file) {
		await openTaskFile(app, tasks[0]);
		return;
	}

	const task = await showTaskSelector(app, tasks, {
		groupModes: ["priority", "project"],
	});
	if (!task) return;
	await openTaskFile(app, task);
};
