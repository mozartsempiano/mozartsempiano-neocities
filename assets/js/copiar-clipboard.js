// copiar-clipboard.js
const textoTitle = "Clique para copiar";
const timeout = 6000;

// Função para inicializar o <pre>
function setupPre(el) {
	el.style.cursor = "pointer";
	/* el.setAttribute("title", textoTitle);
	el.setAttribute("data-smt-title", textoTitle); */
}

// Notificação visual no canto inferior direito
function showCopyNotification(msg, isError = false) {
	let notif = document.getElementById("copy-notification");
	if (!notif) {
		notif = document.createElement("div");
		notif.id = "copy-notification";
		notif.style.position = "fixed";
		notif.style.bottom = "20px";
		notif.style.right = "20px";
		notif.style.background = isError ? "#c0392b" : "#2ecc40";
		notif.style.color = isError ? "#fff" : "#111";
		notif.style.padding = "10px 16px";
		notif.style.borderRadius = "6px";
		notif.style.fontFamily = "inherit";
		notif.style.fontSize = "1em";
		notif.style.opacity = "0";
		notif.style.pointerEvents = "none";
		notif.style.transition = "opacity 0.3s, transform 0.3s";
		notif.style.transform = "translateY(20px)";
		notif.style.zIndex = "1000";
		document.body.appendChild(notif);
		// Força reflow para garantir animação na primeira vez
		void notif.offsetWidth;
	} else {
		// Remove classes e força reflow para reiniciar animação
		notif.classList.remove("notifError", "notifSuccess");
		void notif.offsetWidth;
	}
	notif.textContent = msg;
	notif.style.background = isError ? "#c0392b" : "#2ecc40";
	notif.style.color = isError ? "#fff" : "#111";
	notif.className = isError ? "notifError" : "notifSuccess";
	notif.style.opacity = "1";
	notif.style.transform = "translateY(0)";
	clearTimeout(notif._timeout);
	notif._timeout = setTimeout(() => {
		notif.style.opacity = "0";
		notif.style.transform = "translateY(20px)";
	}, 2000);
}

// Aplica aos <pre> já existentes
document.querySelectorAll("pre.copiavel").forEach(setupPre);

// Delegação de clique para <pre> dinâmicos ou existentes
document.body.addEventListener("click", (e) => {
	const el = e.target;
	if (el.tagName === "PRE" && el.closest(".copiavel")) {
		// if (!el.hasAttribute("data-smt-title"))
		setupPre(el);

		navigator.clipboard
			.writeText(el.innerText)
			.then(() => {
				showCopyNotification("Copiado!", false);
				setTimeout(() => setupPre(el), timeout);
			})
			.catch(() => {
				showCopyNotification("Erro ao copiar!", true);
				console.error("Erro ao copiar!");
				setTimeout(() => setupPre(el), timeout);
			});
	}
});
