(() => {
	const HIDE_DELAY = 2000;
	let notif, hideTimer;

	// injeta CSS uma única vez
	const style = document.createElement("style");
	style.textContent = `
    code { cursor: pointer; }

    #copy-notification {
      position: fixed;
      bottom: 10px;
      right: 20px;
      padding: 0.8rem 1.7rem;
      border-radius: var(--b-radius);
      font-family: inherit;
      font-size: 1.1em;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity .3s, transform .3s;
      z-index: 1000;
      background-color: var(--clr-black-a10);
      color: var(--clr-white);
      border-width: 0 0 0 4px;
      border-style: solid;
	  outline: 1px solid var(--clr-gray-a20);
    }

    #copy-notification.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;
	document.head.appendChild(style);

	function ensureNotification() {
		if (notif) return notif;

		notif = document.createElement("div");
		notif.id = "copy-notification";
		document.body.appendChild(notif);
		return notif;
	}

	function notify(text, isError = false) {
		const el = ensureNotification();

		el.textContent = text;
		el.style.borderColor = isError
			? "var(--clr-red-a30)"
			: "var(--clr-green-a30)";

		el.classList.remove("show");
		void el.offsetWidth; // garante animação sempre
		el.classList.add("show");

		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			el.classList.remove("show");
		}, HIDE_DELAY);
	}

	document.body.addEventListener("click", (e) => {
		const code = e.target.closest("code");
		if (!code) return;

		navigator.clipboard
			.writeText(code.textContent)
			.then(() => notify("Copiado! ദ്ദി(˶>⩊<˵)"))
			.catch(() => notify("Erro ao copiar. (ᗒᗣᗕ)՞", true));
	});
})();
