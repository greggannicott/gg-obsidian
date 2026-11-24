import { App, Modal } from "obsidian";
import { showModalBusy } from "./modal-busy";

export type TextInputKeybinding = {
	id: string;
	commandText: string;
	check: (e: KeyboardEvent) => boolean;
	instruction: string;
};

export type TextInputModalConfiguration = {
	title: string;
	placeholder?: string;
	// Optional explanatory text shown beneath the input.
	description?: string;
	// Optional initial value, pre-selected so typing replaces it.
	value?: string;
	// Validation message shown beneath the input when a previous attempt was
	// rejected, so the user can see what needs correcting.
	error?: string;
	// Render a multi-line textarea instead of a single-line input.
	multiline?: boolean;
	keybindings?: TextInputKeybinding[];
	// Optional formatter that derives a live preview string from the current
	// input value, rendered beneath the input and updated as the user types.
	preview?: (value: string) => string;
	// When set, submitting runs this handler while the modal stays open behind
	// a spinner. Return false to keep the prompt open for another attempt.
	onSubmit?: (value: string, submitKeybinding: string) => Promise<boolean>;
	busyMessage?: string;
};

type SubmitEvent = {
	value: string;
	submitKeybinding: string;
	// True when the modal was closed without submitting (e.g. Esc).
	cancelled: boolean;
};

const DEFAULT_SINGLE_LINE_KEYBINDINGS: TextInputKeybinding[] = [
	{
		id: "enter",
		commandText: "↵",
		check: (e) => e.key === "Enter",
		instruction: "submit",
	},
];

const DEFAULT_MULTILINE_KEYBINDINGS: TextInputKeybinding[] = [
	{
		id: "meta-enter",
		commandText: "⌘+↵",
		check: (e) => e.metaKey && e.key === "Enter",
		instruction: "submit",
	},
];

export class TextInputModal extends Modal {
	private resolve: (value: SubmitEvent) => void;
	private keybindings: TextInputKeybinding[];
	private input: HTMLInputElement | HTMLTextAreaElement;
	private submitted = false;
	private previewFn?: (value: string) => string;
	private previewEl?: HTMLElement;
	private readonly config: TextInputModalConfiguration;
	private busy = false;
	private closedWhileBusy = false;
	private hideBusy: (() => void) | null = null;

	constructor(app: App, config: TextInputModalConfiguration) {
		super(app);
		this.config = config;

		this.keybindings =
			config.keybindings ??
			(config.multiline
				? DEFAULT_MULTILINE_KEYBINDINGS
				: DEFAULT_SINGLE_LINE_KEYBINDINGS);

		if (config.multiline) {
			this.input = this.contentEl.createEl("textarea", {
				cls: ["text-input", "input", "text-input-multiline"],
			});
		} else {
			this.input = this.contentEl.createEl("input", {
				cls: ["text-input", "input"],
			});
		}

		if (config.value) {
			this.input.value = config.value;
		}

		this.previewFn = config.preview;
		if (config.preview) {
			this.previewEl = this.contentEl.createEl("div", {
				cls: "text-input-preview",
				text: config.preview(this.input.value),
			});
			this.input.addEventListener("input", () => {
				if (this.previewEl && this.previewFn) {
					this.previewEl.setText(this.previewFn(this.input.value));
				}
			});
		}

		if (config.description) {
			this.contentEl.createEl("div", {
				cls: "text-input-description",
				text: config.description,
			});
		}

		if (config.error) {
			this.contentEl.createEl("div", {
				cls: "text-input-error",
				text: config.error,
			});
		}

		const promptInstructions = this.contentEl.createEl("div", {
			cls: "prompt-instructions",
		});

		for (const kb of this.keybindings) {
			const instructionEl = promptInstructions.createEl("div", {
				cls: "prompt-instruction",
			});
			instructionEl.createEl("span", {
				cls: "prompt-instruction-command",
				text: kb.commandText,
			});
			instructionEl.createEl("span", { text: kb.instruction });
		}

		if (config.placeholder) {
			this.input.placeholder = config.placeholder;
		}

		this.input.addEventListener("keydown", (e) => {
			// input/textarea union loses the specific event map, so narrow here.
			const keyEvent = e as KeyboardEvent;
			for (const kb of this.keybindings) {
				if (kb.check(keyEvent)) {
					keyEvent.preventDefault();
					if (this.busy) break;

					const value = this.input.value;
					const submitKeybinding = kb.id;

					const onSubmit = this.config.onSubmit;
					if (!onSubmit) {
						this.submitted = true;
						this.resolve({ value, submitKeybinding, cancelled: false });
						this.close();
						break;
					}

					this.setBusy(this.config.busyMessage ?? "Working…");
					void onSubmit(value, submitKeybinding)
						.then((ok) => {
							if (ok !== false) {
								this.submitted = true;
								this.resolve({
									value,
									submitKeybinding,
									cancelled: false,
								});
								this.close();
								return;
							}
							this.setIdle();
							if (this.closedWhileBusy) this.finishCancelled();
						})
						.catch((error) => {
							console.error(error);
							this.setIdle();
							if (this.closedWhileBusy) this.finishCancelled();
						});
					break;
				}
			}
		});
	}

	onOpen(): void {
		super.onOpen();
		this.input.focus();
		this.input.select();
	}

	onClose(): void {
		// Resolve even when closed without submitting (e.g. Esc) so
		// awaited callers are not left hanging. An async submit owns the
		// resolver while it is running, so don't race it with a cancel.
		if (this.busy) {
			this.closedWhileBusy = true;
		} else if (!this.submitted) {
			this.finishCancelled();
		}
		super.onClose();
	}

	private setBusy(message: string): void {
		this.busy = true;
		this.input.disabled = true;
		this.hideBusy = showModalBusy(this.modalEl, message);
	}

	private setIdle(): void {
		this.busy = false;
		this.input.disabled = false;
		this.hideBusy?.();
		this.hideBusy = null;
		if (!this.closedWhileBusy) {
			this.input.focus();
			this.input.select();
		}
	}

	private finishCancelled(): void {
		if (this.submitted) return;
		this.submitted = true;
		this.resolve({
			value: "",
			submitKeybinding: "cancel",
			cancelled: true,
		});
	}

	static show(
		app: App,
		config: TextInputModalConfiguration,
	): Promise<SubmitEvent> {
		return new Promise((resolve) => {
			const modal = new TextInputModal(app, config);
			modal.setTitle(config.title);
			modal.resolve = resolve;
			modal.open();
		});
	}

	// Re-shows the prompt until the value passes `validate`, keeping the rejected
	// input so it can be corrected. `validate` returns a message to display, or
	// null when the value is acceptable.
	static async showValidated(
		app: App,
		config: TextInputModalConfiguration,
		validate: (value: string) => string | null,
	): Promise<{ value: string; cancelled: boolean }> {
		let error = config.error;
		let value = config.value;

		while (true) {
			const result = await TextInputModal.show(app, {
				...config,
				value,
				error,
			});
			if (result.cancelled) return { value: "", cancelled: true };

			const trimmed = result.value.trim();
			const message = validate(trimmed);
			if (message === null) return { value: trimmed, cancelled: false };

			error = message;
			value = result.value;
		}
	}
}
