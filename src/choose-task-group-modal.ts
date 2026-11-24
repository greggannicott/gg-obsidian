import { App } from "obsidian";
import { ConductorSelectorModal } from "./conductor-selector-modal";
import { getTaskGroupForActiveFile, getTaskGroups } from "./tasks";

const NO_TASK_GROUP_LABEL = "No Task Group";

export function taskGroupSelectorOptions(
	taskGroups: string[],
	preselectedTaskGroup: string | null = null,
): {
	items: (string | null)[];
	placeholder: string;
	getText: (group: string | null) => string;
	getCustomItem: (text: string) => string | null;
	initialValue?: string;
} {
	const normalized = new Map<string, string>();
	for (const group of taskGroups ?? []) {
		const trimmed = group?.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (!normalized.has(key)) normalized.set(key, trimmed);
	}

	const preselected = preselectedTaskGroup?.trim();
	if (preselected) {
		const key = preselected.toLowerCase();
		if (!normalized.has(key)) normalized.set(key, preselected);
	}

	const groups = [...normalized.values()].sort((a, b) =>
		a.localeCompare(b),
	);
	const items: (string | null)[] = [null, ...groups];

	const initialValue =
		preselected &&
		groups.find((group) => group.toLowerCase() === preselected.toLowerCase());

	return {
		items,
		placeholder: `Select a task group or “${NO_TASK_GROUP_LABEL}”...`,
		getText: (group) => group ?? NO_TASK_GROUP_LABEL,
		getCustomItem: (text) => {
			const trimmed = text.trim();
			return trimmed.length > 0 ? trimmed : null;
		},
		initialValue: initialValue ?? undefined,
	};
}

export function showTaskGroupSelector(
	app: App,
	taskGroups: string[],
	preselectedTaskGroup: string | null = null,
): Promise<string | null> {
	return ConductorSelectorModal.show<string | null>(
		app,
		taskGroupSelectorOptions(taskGroups, preselectedTaskGroup),
	);
}

export async function promptForOptionalTaskGroup(app: App): Promise<string | null> {
	const preselected = getTaskGroupForActiveFile(app);
	const groups = getTaskGroups(app);
	return showTaskGroupSelector(app, groups, preselected);
}