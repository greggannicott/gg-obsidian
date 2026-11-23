import { App, TFile } from "obsidian";
import { Epic, getEpicsForFile } from "./epics";
import { Project, getProjectsForFile } from "./projects";

export type NoteAssociations = {
	projects: Project[];
	epics: Epic[];
};

// Uses the same detection as Create Task / Create Project Note, but keeps all
// associations rather than only the first one used for preselection.
export function getAssociationsForFile(app: App, file: TFile): NoteAssociations {
	return {
		projects: getProjectsForFile(app, file),
		epics: getEpicsForFile(app, file),
	};
}

// A candidate matches when it shares any project or epic with the note being
// edited. With no detectable associations, keep the full list.
export function matchesAssociations(
	active: NoteAssociations,
	candidate: NoteAssociations,
): boolean {
	if (!active.projects.length && !active.epics.length) return true;

	const projectPaths = new Set(active.projects.map((project) => project.path));
	const epicPaths = new Set(active.epics.map((epic) => epic.path));
	return (
		candidate.projects.some((project) => projectPaths.has(project.path)) ||
		candidate.epics.some((epic) => epicPaths.has(epic.path))
	);
}
