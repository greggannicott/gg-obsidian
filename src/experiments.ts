import { App, TFile, parseFrontMatterStringArray } from "obsidian";
import {
	createFileFromTemplate,
	sanitizeFileName,
	vaultFileExists,
} from "./utilities";

export type ExperimentKind = "short" | "long" | "other";

export type Experiment = {
	name: string;
	path: string;
	file: TFile;
	kind: ExperimentKind;
	status?: string;
};

function getUniqueExperimentFileName(app: App, sanitizedName: string): string {
	let candidate = sanitizedName;
	let postfix = 2;
	while (vaultFileExists(app, `${candidate}.md`)) {
		candidate = `${sanitizedName} - ${postfix}`;
		postfix++;
	}
	return candidate;
}

export async function createNewExperiment(
	app: App,
	name: string,
): Promise<TFile | null> {
	const sanitizedName = sanitizeFileName(name);
	if (!sanitizedName) return null;
	const fileName = getUniqueExperimentFileName(app, sanitizedName);
	return createFileFromTemplate(app, `${fileName}.md`, "Short Experiment");
}

export function getExperiments(app: App): Experiment[] {
	return app.vault
		.getMarkdownFiles()
		.filter((file) => isNoteExperiment(app, file))
		.map((file) => ({
			name: file.basename,
			path: file.path,
			file,
			kind: getExperimentKind(app, file),
			status: getExperimentStatus(app, file),
		}));
}

export function isNoteExperiment(app: App, file: TFile): boolean {
	if (file.path.startsWith("_templates/")) return false;
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	const categories = parseFrontMatterStringArray(frontmatter, "categories");
	return categories?.includes("[[Experiment]]") ?? false;
}

function getExperimentKind(app: App, file: TFile): ExperimentKind {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	const types = parseFrontMatterStringArray(frontmatter, "type") ?? [];
	for (const link of types) {
		const value = link
			.replace(/^\[\[|\]\]$/g, "")
			.split("|")[0]
			.trim();
		if (value === "Short Experiment") return "short";
		if (value === "Long Experiment") return "long";
	}
	return "other";
}

function getExperimentStatus(app: App, file: TFile): string | undefined {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter) return undefined;

	// Check for on-hold first
	if (frontmatter["on-hold"] === true) {
		return "On Hold";
	}

	const started = frontmatter["started"];
	const ended = frontmatter["ended"];
	const willNotDo = frontmatter["will-not-do"];

	// Finished if ended is set
	if (ended !== undefined && ended !== null && ended !== "") {
		return "Finished";
	}

	// Ongoing if started and not ended
	if (started !== undefined && started !== null && started !== "") {
		return "Ongoing";
	}

	// Will Not Do
	if (willNotDo === true) {
		return "Will Not Do";
	}

	// Proposed if not started, not ended
	return "Proposed";
}
