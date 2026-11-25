// Shared naming convention for Project Notes. Both the create command and the
// backend (gg-bff) produce filenames of the form
// "Project Note - {Project ID} - {name}.md" (or, for older notes,
// "Project Note - {name}.md"), so callers should pass only the bare name;
// these helpers make that contract explicit and keep the two sides from
// drifting.

export const PROJECT_NOTE_NAME_PREFIX = "Project Note - ";

const KNOWN_PREFIXES = [
	"Project Note - ",
	"Project Notes - ",
	"project-note - ",
	"project-notes - ",
];

// Matches the newer, project-id-qualified form so it can be stripped back to
// the bare note name: "Project Note - gg-10001 - Foo" -> "Foo".
const PROJECT_ID_PREFIX_PATTERN =
	/^project notes? - [a-z0-9-]+ - /i;

// Strips a leading known prefix (if present) and trims surrounding whitespace,
// returning the bare note name. Safe to call on already-bare names.
export function stripProjectNotePrefix(name: string): string {
	const trimmed = name.trim();
	// Newer, project-id-qualified form: "Project Note - {id} - {name}".
	if (PROJECT_ID_PREFIX_PATTERN.test(trimmed)) {
		return trimmed.replace(PROJECT_ID_PREFIX_PATTERN, "").trim();
	}
	const lower = trimmed.toLowerCase();
	for (const prefix of KNOWN_PREFIXES) {
		if (lower.startsWith(prefix.toLowerCase())) {
			return trimmed.slice(prefix.length).trim();
		}
	}
	return trimmed;
}

// A bare, prefix-free title suitable for template variables and filenames.
export function normalizeProjectNoteTitle(name: string): string {
	return stripProjectNotePrefix(name);
}

// Builds the full filename (without extension) for a note from a (possibly
// prefixed) input name. When a project ID is supplied the note is qualified
// with it to keep names unique across projects: "Project Note - {id} - {name}".
export function formatProjectNoteName(name: string, projectId?: string): string {
	const bare = stripProjectNotePrefix(name);
	if (!bare) return "";
	if (projectId && projectId.trim()) {
		return `${PROJECT_NOTE_NAME_PREFIX}${projectId.trim()} - ${bare}`;
	}
	return `${PROJECT_NOTE_NAME_PREFIX}${bare}`;
}