import { App, TFile } from "obsidian";
import {
	ConductorSelectorModal,
	ConductorSelectorOptions,
} from "./conductor-selector-modal";
import {
	getAssociationsForFile,
	matchesAssociations,
	NoteAssociations,
} from "./note-associations";
import { stripProjectNotePrefix } from "./project-note-naming";
import { getFilesWithCategory, getNoteTitle } from "./utilities";

export type ProjectNoteChoice =
	| { kind: "create" }
	| { kind: "note"; file: TFile };

export type ProjectNoteSelectorOptions = {
	includeCreate?: boolean;
	// When supplied, only project notes sharing a project or epic are listed.
	associations?: NoteAssociations | null;
};

// A sentinel row that, when selected, tells the caller to run the full
// "Create New Project Note" flow instead of inserting an existing note.
const CREATE_ITEM: ProjectNoteChoice = { kind: "create" };

export function projectNoteSelectorOptions(
	app: App,
	options: ProjectNoteSelectorOptions = {},
): ConductorSelectorOptions<ProjectNoteChoice> {
	const includeCreate = options.includeCreate ?? true;
	// An active note with no detectable associations keeps the full list.
	const associations =
		options.associations &&
		(options.associations.projects.length || options.associations.epics.length)
			? options.associations
			: null;
	const files = getFilesWithCategory(app, "Project Note").filter((file) =>
		associations
			? matchesAssociations(
					associations,
					getAssociationsForFile(app, file),
			  )
			: true,
	);

	const items: ProjectNoteChoice[] = [];
	if (includeCreate) items.push(CREATE_ITEM);
	items.push(...files.map((file) => ({ kind: "note" as const, file })));

	const groups = [
		...(includeCreate
			? [
					{
						id: "actions",
						label: "Actions",
						buildGroups: (entries: ProjectNoteChoice[]) => {
							const create = entries.filter(
								(e) => e.kind === "create",
							);
							return create.length
								? [{ header: "Actions", items: create }]
								: [];
						},
					},
			  ]
			: []),
		{
			id: "project",
			label: "By Project",
			toggleKey: "p",
			buildGroups: (entries: ProjectNoteChoice[]) => {
				const buckets = new Map<string, ProjectNoteChoice[]>();
				for (const entry of entries) {
					if (entry.kind !== "note") continue;
					const parent = getProjectName(app, entry.file);
					const key = parent ?? "No Project";
					if (!buckets.has(key)) buckets.set(key, []);
					buckets.get(key)!.push(entry);
				}
				return [...buckets.entries()]
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([header, bucket]) => ({ header, items: bucket }));
			},
		},
		{
			id: "epic",
			label: "By Epic",
			toggleKey: "e",
			buildGroups: (entries: ProjectNoteChoice[]) => {
				const buckets = new Map<string, ProjectNoteChoice[]>();
				for (const entry of entries) {
					if (entry.kind !== "note") continue;
					const epic = getEpicName(app, entry.file);
					const key = epic ?? "No Epic";
					if (!buckets.has(key)) buckets.set(key, []);
					buckets.get(key)!.push(entry);
				}
				return [...buckets.entries()]
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([header, bucket]) => ({ header, items: bucket }));
			},
		},
		{
			id: "type",
			label: "By Type",
			toggleKey: "t",
			buildGroups: (entries: ProjectNoteChoice[]) => {
				const buckets = new Map<string, ProjectNoteChoice[]>();
				for (const entry of entries) {
					if (entry.kind !== "note") continue;
					const type = getProjectNoteType(app, entry.file) ?? "Other";
					if (!buckets.has(type)) buckets.set(type, []);
					buckets.get(type)!.push(entry);
				}
				return [...buckets.entries()]
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([header, bucket]) => ({ header, items: bucket }));
			},
		},
	];

	return {
		items,
		placeholder: associations
			? "Select a project note from a project or epic associated with this note..."
			: "Select a project note...",
		emptyText: associations
			? "No linked project notes found. Create a new one instead."
			: undefined,
		titleMaxLength: 120,
		getText: (entry) =>
			entry.kind === "create"
				? "Create New Project Note"
				: getProjectNoteDisplayTitle(app, entry.file),
		getSearchTexts: (entry) => {
			if (entry.kind === "create") return ["create", "new", "project note"];
			const file = entry.file;
			const searches = [
				getProjectNoteDisplayTitle(app, file),
				getNoteTitle(app, file),
				file.basename,
			];
			searches.push(...getLinkedNames(app, file, "parents"));
			searches.push(...getLinkedNames(app, file, "epic"));
			const type = getProjectNoteType(app, file);
			if (type) searches.push(type);
			return searches;
		},
		getMeta: (entry, ctx) => {
			if (entry.kind === "create") {
				return [{ value: "Create a new project note" }];
			}
			const grouping = ctx?.activeGrouping ?? null;
			const meta = [];
			// Don't repeat what the active grouping already shows as a header.
			const project = grouping === "project" ? null : getProjectName(app, entry.file);
			const epic = grouping === "epic" ? null : getEpicName(app, entry.file);
			const type = grouping === "type" ? null : getProjectNoteType(app, entry.file);
			if (project) meta.push({ value: project });
			if (epic) meta.push({ value: epic });
			if (type) meta.push({ value: type });
			return meta.length ? meta : null;
		},
		sortItems: (a, b) => {
			// Keep the create row pinned to the top.
			if (a.kind === "create" && b.kind !== "create") return -1;
			if (b.kind === "create" && a.kind !== "create") return 1;
			if (a.kind === "note" && b.kind === "note") {
				const projectOrder = (getProjectName(app, a.file) ?? "").localeCompare(
					getProjectName(app, b.file) ?? "",
				);
				if (projectOrder !== 0) return projectOrder;
				return getProjectNoteDisplayTitle(app, a.file).localeCompare(
					getProjectNoteDisplayTitle(app, b.file),
				);
			}
			return 0;
		},
		groupings: groups,
		initialGroupingId: "type",
	};
}

export function showProjectNoteSelector(
	app: App,
	options: ProjectNoteSelectorOptions = {},
): Promise<ProjectNoteChoice | null> {
	return ConductorSelectorModal.show(
		app,
		projectNoteSelectorOptions(app, options),
	);
}

// Display title without the filename prefix (e.g. "Project Notes - ").
function getProjectNoteDisplayTitle(app: App, file: TFile): string {
	return stripProjectNotePrefix(getNoteTitle(app, file));
}

function getProjectName(app: App, file: TFile): string | null {
	return getLinkedName(app, file, "parents");
}

function getEpicName(app: App, file: TFile): string | null {
	return getLinkedName(app, file, "epic");
}

// Links can be path-qualified (e.g. "Projects/Work/Foo/Foo"); show only the
// linked note's name.
function getLinkedName(app: App, file: TFile, field: string): string | null {
	const names = getLinkedNames(app, file, field);
	if (!names.length) return null;
	return names[0].split("/").pop()?.replace(/\.md$/i, "").trim() || null;
}

function getProjectNoteType(app: App, file: TFile): string | null {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	const type = fm?.type;
	if (Array.isArray(type)) return typeof type[0] === "string" ? type[0].replace(/^\[\[|\]\]$/g, "") : null;
	if (typeof type === "string") return type.replace(/^\[\[|\]\]$/g, "");
	return null;
}

function getLinkedNames(app: App, file: TFile, field: string): string[] {
	const value = app.metadataCache.getFileCache(file)?.frontmatter?.[field];
	if (!Array.isArray(value)) return [];
	return value.map((name) =>
		String(name).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim(),
	);
}
