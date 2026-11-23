import { App } from "obsidian";
import {
	ConductorSelectorGrouping,
	ConductorSelectorMeta,
	ConductorSelectorModal,
	ConductorSelectorOptions,
} from "./conductor-selector-modal";
import {
	compareEpics,
	Epic,
	getEpicForActiveFile,
	getEpics,
	getOutstandingEpics,
} from "./epics";
import { Context } from "./projects";
import { STATUS_EMOJI } from "./tasks";

const NO_EPIC_LABEL = "No epic";

// Epic selectors offer `null` as a real row so "no epic" is an explicit
// choice rather than something the user has to know to do with Esc.
export type EpicChoice = Epic | null;

const statusLabel = (epic: Epic): string => {
	if (!epic.status) return "No Status";
	const label = epic.status.replace(/^\d+ - /, "");
	const emoji = STATUS_EMOJI[epic.status];
	return emoji ? `${emoji} ${label}` : label;
};

// Rows show a single combined meta line, e.g. "Personal · 🔄 In Progress".
const epicMetaLine = (epic: Epic): string =>
	`${epic.context} · ${statusLabel(epic)}`;

const contextGrouping: ConductorSelectorGrouping<EpicChoice> = {
	id: "context",
	label: "Group by Context",
	toggleKey: "c",
	buildGroups: (items) => {
		const buckets = new Map<string, EpicChoice[]>();
		for (const item of items) {
			if (!item) continue;
			if (!buckets.has(item.context)) buckets.set(item.context, []);
			buckets.get(item.context)!.push(item);
		}
		const groups = [...buckets.entries()]
			.sort(([headerA], [headerB]) => headerA.localeCompare(headerB))
			.map(([header, bucket]) => ({ header, items: bucket }));
		const noEpic = items.filter((item) => item === null);
		return noEpic.length > 0
			? [{ header: "General", items: noEpic }, ...groups]
			: groups;
	},
};

function compareEpicChoices(a: EpicChoice, b: EpicChoice): number {
	if (a === null) return b === null ? 0 : -1;
	if (b === null) return 1;
	return compareEpics(a, b);
}

export function epicSelectorOptions(
	epics: Epic[],
): ConductorSelectorOptions<EpicChoice> {
	return {
		items: [null, ...[...epics].sort(compareEpics)],
		placeholder: `Select an epic or “${NO_EPIC_LABEL}”`,
		emptyText: "No epics found",
		getText: (epic) => epic?.name ?? NO_EPIC_LABEL,
		getMeta: (epic): ConductorSelectorMeta[] | null =>
			epic ? [{ value: epicMetaLine(epic) }] : null,
		sortItems: compareEpicChoices,
		groupings: [contextGrouping],
		initialGroupingId: null,
	};
}

export function showEpicSelector(
	app: App,
	epics: Epic[],
	preselectedEpic: Epic | null = null,
): Promise<Epic | null> {
	const preselected = epics.find(
		(epic) => epic.path === preselectedEpic?.path,
	);
	return ConductorSelectorModal.show<EpicChoice>(app, {
		...epicSelectorOptions(epics),
		initialValue: preselected?.name,
	});
}

// The "which epic?" prompt. Every epic is offered — including closed ones — so
// an older epic can still be picked for a retrospective. A preselected epic
// pre-fills the search box, leaving Enter to confirm it. "No epic" is a row,
// so dismissing the modal isn't the only way to skip.
export function showEpicSelectorSingle(
	app: App,
	preselectedEpic: Epic | null = null,
): Promise<Epic | null> {
	const epics = getEpics(app);
	// Only pre-fill when the epic is one of the offered rows: anything else
	// would filter the list down to nothing.
	const preselected = epics.find(
		(epic) => epic.path === preselectedEpic?.path,
	);
	return ConductorSelectorModal.show<EpicChoice>(app, {
		...epicSelectorOptions(epics),
		placeholder: `Select an epic or “${NO_EPIC_LABEL}”...`,
		initialValue: preselected?.name,
	});
}

// The optional "which epic is this for?" prompt. Normally only Personal work
// is offered an epic, but being inside an epic note is a strong signal, so the
// epic is preselected and the picker is offered even in other contexts.
export async function promptForOptionalEpic(
	app: App,
	context: Context,
): Promise<Epic | null> {
	const preselected = getEpicForActiveFile(app);
	if (context !== Context.Personal && !preselected) return null;

	const epics = getOutstandingEpics(app);
	if (preselected && !epics.some((epic) => epic.path === preselected.path)) {
		epics.push(preselected);
	}
	if (epics.length === 0) return null;
	return showEpicSelector(app, epics, preselected);
}
