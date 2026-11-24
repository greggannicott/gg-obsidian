import { App, Notice, TFile } from "obsidian";
import { mintId } from "src/bff";
import { ConductorSelectorModal } from "src/conductor-selector-modal";
import { Context } from "src/projects";
import { TextInputModal } from "src/text-input-modal";
import {
	createFileFromTemplate,
	sanitizeFileName,
	vaultFileExists,
} from "src/utilities";

// Creates a project from the standard template with the minimal set of
// details: a name and a context. Everything else is left for the user to fill
// in once the note is open.
export async function createProject(app: App): Promise<void> {
	const nameResult = await TextInputModal.show(app, {
		title: "Create New Project",
		placeholder: "Enter the project name...",
	});
	if (nameResult.cancelled) return;

	const name = sanitizeFileName(nameResult.value);
	if (!name) {
		new Notice("A project name is required.");
		return;
	}

	const context = await ConductorSelectorModal.show<Context>(app, {
		items: [Context.Personal, Context.Work],
		placeholder: "Choose a context...",
		getText: (value) => value,
		busyMessage: "Creating project…",
		// Keep the Context picker open with a spinner until the ID has been
		// minted and the note is ready to open.
		onSelectAsync: async (selectedContext) => {
			// Get the ID before creating the file so a BFF failure cannot leave
			// a project note behind without one.
			let id: string;
			try {
				id = await mintId();
			} catch (error) {
				new Notice(
					`Could not get a project ID: ${error instanceof Error ? error.message : error}`,
				);
				return false;
			}

			const filePath = getUniqueProjectPath(app, selectedContext, name);
			let file: TFile | null;
			try {
				file = await createFileFromTemplate(app, filePath, "Project");
			} catch (error) {
				new Notice(
					`Failed to create project [${name}]: ${error instanceof Error ? error.message : error}`,
				);
				return false;
			}
			if (!file) {
				new Notice("Project template not found.");
				return false;
			}

			await app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter["id"] = id;
			});

			await app.workspace.getLeaf(false).openFile(file);
			new Notice(`Created project [${file.basename}] with ID ${id}`);
			return true;
		},
	});
	if (!context) return;
}

function getUniqueProjectPath(
	app: App,
	context: Context,
	name: string,
): string {
	const basePath = `Projects/${context}/${name}`;
	if (!vaultFileExists(app, `${basePath}.md`)) return `${basePath}.md`;

	let suffix = 1;
	while (vaultFileExists(app, `${basePath} ${suffix}.md`)) {
		suffix += 1;
	}
	return `${basePath} ${suffix}.md`;
}
