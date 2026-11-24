// Small shared overlay used by modals that need to stay open while an async
// operation (currently ID minting plus note creation) is in flight.

export function showModalBusy(
	modalEl: HTMLElement,
	message: string,
): () => void {
	modalEl.addClass("gg-modal-busy-host");
	const overlay = modalEl.createDiv({ cls: "gg-modal-busy" });
	overlay.createSpan({ cls: "gg-modal-busy-spinner" });
	overlay.createSpan({ cls: "gg-modal-busy-message", text: message });

	return () => {
		overlay.remove();
		modalEl.removeClass("gg-modal-busy-host");
	};
}
