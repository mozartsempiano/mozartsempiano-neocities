function applyTooltips(container) {
	container.querySelectorAll("[title]").forEach((el) => {
		const title = el.getAttribute("title");
		if (title) {
			el.dataset.smtTitle = title;
			el.removeAttribute("title");

			let tooltipTimeout;

			el.addEventListener("mouseenter", (e) => {
				tooltipTimeout = setTimeout(() => {
					const tooltip = document.getElementById("s-m-t-tooltip");
					if (tooltip) {
						const inner = tooltip.querySelector("div");
						if (inner) {
							inner.textContent = el.dataset.smtTitle;
							tooltip.style.display = "block";

							const updatePosition = (event) => {
								tooltip.style.left = `${event.pageX + 10}px`;
								tooltip.style.top = `${event.pageY + 10}px`;
							};

							updatePosition(e);
							el.addEventListener("mousemove", updatePosition);
							el._updatePosition = updatePosition;
						}
					}
				}, 0);
			});

			el.addEventListener("mouseleave", () => {
				clearTimeout(tooltipTimeout);
				const tooltip = document.getElementById("s-m-t-tooltip");
				if (tooltip) {
					tooltip.style.display = "none";
				}
				if (el._updatePosition) {
					el.removeEventListener("mousemove", el._updatePosition);
					delete el._updatePosition;
				}
			});
		}
	});
}

function setupGalleryFilter({
	items = [],
	filtrosId = "filter-gallery-filtros",
	galeriaId = "filter-gallery-galeria",
	modalId = "modal",
	getMedias = (d) => (d && d.medias) || [],
	getTitle = (d) => d && d.title,
	getYear = (d) => d && d.year,
	getType = (d) => d && d.type,
	getClient = (d) => d && d.client,
	getDesc = (d) => d && d.desc,
	getPrograms = (d) => d && d.programs,
	getTags = (d) => (d && d.tags) || [],
	getCamera = (d) => d && d.camera,
} = {}) {
	if (!Array.isArray(items)) items = [];

	// Combina tags originais com câmera e ano
	function getAllTagsForItem(item) {
		const tags = getTags(item) || [];
		const camera = getCamera(item);
		const year = getYear(item);

		const allItemTags = [...tags];
		if (camera) allItemTags.push(camera.toLowerCase());
		if (year) allItemTags.push(year.toString().toLowerCase());

		return allItemTags;
	}

	const allTags = Array.from(new Set(items.flatMap(getAllTagsForItem))).sort();
	let selectedTags = [];

	function renderFiltros() {
		const filtrosEl = document.getElementById(filtrosId);
		if (!filtrosEl) return;

		const iconeFiltro = false;
		let filtroIcone = "";

		if (iconeFiltro) {
			filtroIcone =
				'<div class="icone filter-icone" title="Tags" style="background-color: var(--clr-gray-a40)"></div>';
		}

		filtrosEl.innerHTML =
			filtroIcone +
			allTags
				.map(
					(tag) =>
						`<span class="filter-gallery-tag${
							selectedTags.includes(tag) ? " selected" : ""
						}" data-tag="${tag}">#${tag}</span>`,
				)
				.join(" ");
		filtrosEl.querySelectorAll(".filter-gallery-tag").forEach((el) => {
			el.onclick = () => {
				const tag = el.getAttribute("data-tag");
				if (selectedTags.includes(tag))
					selectedTags = selectedTags.filter((t) => t !== tag);
				else selectedTags.push(tag);
				renderFiltros();
				renderGaleria();
			};
		});
	}

	function ajustarThumbs() {
		const info = modal.querySelector("#modal-info");
		const thumbs = modal.querySelector("#modal-thumbs");
		if (info && thumbs) {
			thumbs.style.maxWidth = `${info.offsetWidth}px`;
		}
	}

	function renderGaleria() {
		let filtered = items;
		if (selectedTags.length) {
			filtered = items.filter((d) => {
				const allItemTags = getAllTagsForItem(d);
				return selectedTags.every((tag) => allItemTags.includes(tag));
			});
		}

		const galeriaEl = document.getElementById(galeriaId);
		if (!galeriaEl) return;

		galeriaEl.innerHTML = filtered
			.map((d) => {
				const allItemTags = getAllTagsForItem(d);

				const tags = allItemTags
					.map(
						(tag) =>
							`<span class="filter-gallery-tag${
								selectedTags.includes(tag) ? " selected" : ""
							}" data-tag="${tag}">#${tag}</span>`,
					)
					.join(" ");

				const medias = getMedias(d);
				// pega a primeira imagem, mesmo que seja thumbOnly
				const thumb = medias.find((m) => m.type === "image") || null;
				const thumbSrc = thumb ? thumb.src : "";
				const totalMedias = medias.filter((m) => !m.thumbOnly).length;

				// Mostra o botão de play se tiver uma thumbnail (primeira mídia como thumbOnly)
				// seguida de um vídeo na segunda posição
				const hasVideoWithThumb =
					medias[0]?.thumbOnly && medias[1]?.type === "video";

				let overlays = "";
				if (totalMedias > 1) {
					overlays += `<div class="media-count">${totalMedias} itens</div>`;
				}
				if (hasVideoWithThumb) {
					overlays += `<div class="video-play-icon">▶</div>`;
				}

				return `
          <div class="filter-gallery-item" tabindex="0">
            <div class="filter-gallery-content">
              <div class="filter-gallery-thumb">
                <img src="${thumbSrc}" alt="${getTitle(d) || ""}">
                ${overlays}
              </div>
              <div class="filter-gallery-tags">${tags}</div>
            </div>
          </div>`;
			})
			.join("");

		galeriaEl
			.querySelectorAll(".filter-gallery-item .filter-gallery-tag")
			.forEach((el) => {
				el.onclick = (e) => {
					e.stopPropagation();
					const tag = el.getAttribute("data-tag");
					if (selectedTags.includes(tag))
						selectedTags = selectedTags.filter((t) => t !== tag);
					else selectedTags.push(tag);
					renderFiltros();
					renderGaleria();
				};
			});

		galeriaEl.querySelectorAll(".filter-gallery-item").forEach((item, idx) => {
			item.onclick = () => {
				const d = filtered[idx];
				const modal = document.getElementById(modalId);
				if (!modal) return;

				const modalContent = modal.querySelector("#modal-content");
				const modalWrapper = modal.querySelector("#modal-wrapper");
				const modalInfo = modal.querySelector("#modal-info");
				const modalThumbs = modal.querySelector("#modal-thumbs");
				const modalMedia = modal.querySelector("#modal-media");

				function renderModalInfo(d) {
					modalInfo.innerHTML = "";

					const title = d.title && d.title.trim() ? d.title : "Sem título";
					const titleEl = document.createElement("div");
					titleEl.id = "modal-title";
					titleEl.className = "modal-title";
					titleEl.textContent = d.year ? `${title} / ${d.year}` : title;
					modalInfo.appendChild(titleEl);

					if (d.type) {
						const typeEl = document.createElement("div");
						typeEl.className = "modal-type";
						typeEl.textContent = d.type;
						modalInfo.appendChild(typeEl);
					}

					if (d.client) {
						const clientEl = document.createElement("div");
						clientEl.className = "modal-client";
						clientEl.textContent = `Cliente: ${d.client}`;
						modalInfo.appendChild(clientEl);
					}

					if (d.desc) {
						const descEl = document.createElement("div");
						descEl.id = "modal-desc";
						descEl.className = "modal-desc";
						descEl.innerHTML = d.desc.replace(/\n/g, "<br>");
						modalInfo.appendChild(descEl);
					}

					if (getCamera(d)) {
						const cameraEl = document.createElement("div");
						cameraEl.className = "modal-camera";

						const icon = document.createElement("span");
						icon.className = "icone camera-icone";
						icon.title = "Câmera utilizada";

						const text = document.createElement("span");
						text.textContent = getCamera(d);

						cameraEl.appendChild(icon);
						cameraEl.appendChild(text);
						modalInfo.appendChild(cameraEl);
					}

					if (d.programs && d.programs.length) {
						const programMap = {
							photoshop: {
								aliases: ["photoshop", "ps", "adobe photoshop"],
								cssClass: "icon-photoshop",
								title: "Adobe Photoshop",
							},
							illustrator: {
								aliases: ["illustrator", "ai", "adobe illustrator"],
								cssClass: "icon-illustrator",
								title: "Adobe Illustrator",
							},
							indesign: {
								aliases: ["indesign", "id", "adobe indesign"],
								cssClass: "icon-indesign",
								title: "Adobe InDesign",
							},
							"after-effects": {
								aliases: [
									"after",
									"after effects",
									"after-effects",
									"ae",
									"adobe after effects",
								],
								cssClass: "icon-after-effects",
								title: "Adobe After Effects",
							},
							premiere: {
								aliases: ["premiere", "premiere pro", "adobe premiere"],
								cssClass: "icon-premiere",
								title: "Adobe Premiere",
							},
							aseprite: {
								aliases: ["aseprite", "ap"],
								cssClass: "icon-aseprite",
								title: "Aseprite",
							},
							python: {
								aliases: ["python", "py"],
								cssClass: "icon-python",
								title: "Python",
							},
							javascript: {
								aliases: ["javascript", "js"],
								cssClass: "icon-javascript",
								title: "JavaScript",
							},
							css: {
								aliases: ["css"],
								cssClass: "icon-css",
								title: "CSS",
							},
						};

						const programsEl = document.createElement("div");
						programsEl.className = "modal-programs";

						d.programs.forEach((p) => {
							const key = Object.keys(programMap).find((k) =>
								programMap[k].aliases.includes(p.toLowerCase()),
							);
							if (!key) return;

							const prog = programMap[key];
							const span = document.createElement("span");
							span.className = `program-icon ${prog.cssClass}`;
							span.title = prog.title;

							programsEl.appendChild(span);
						});

						modalInfo.appendChild(programsEl);
					}

					applyTooltips(modalInfo);
				}

				const medias = getMedias(d);
				const firstIdx = medias.findIndex((m) => !m.thumbOnly);
				const defaultIdx = firstIdx !== -1 ? firstIdx : 0;

				function renderModalMedia(idx) {
					modalMedia.innerHTML = "";
					const m = medias[idx];
					if (!m) return;

					if (m.type === "image") {
						const img = document.createElement("img");
						img.src = m.src;
						modalMedia.appendChild(img);
					} else if (m.type === "video") {
						if (m.src.endsWith(".mp4")) {
							const video = document.createElement("video");
							video.controls = true;
							video.style.maxWidth = "100%";
							video.style.maxHeight = "70vh";
							video.setAttribute("playsinline", "");
							video.setAttribute("muted", "");
							video.setAttribute("loop", "");
							video.volume = 0.25;
							const source = document.createElement("source");
							source.src = m.src;
							source.type = "video/mp4";
							video.appendChild(source);
							modalMedia.appendChild(video);
						} else {
							const embedUrl = getVideoEmbedUrl(m.src);
							if (embedUrl) {
								const iframe = document.createElement("iframe");
								iframe.width = 681;
								iframe.height = 512;
								iframe.style.border = "none";
								iframe.allow = "autoplay; encrypted-media";
								iframe.src = embedUrl;
								modalMedia.appendChild(iframe);
							}
						}
					}

					if (m.caption) {
						const captionEl = document.createElement("div");
						captionEl.className = "modal-media-caption";
						captionEl.textContent = m.caption;
						modalMedia.appendChild(captionEl);
					}
				}

				function renderModalThumbs(initialIdx = 0) {
					modalThumbs.innerHTML = "";

					const videoIdx = medias.findIndex((m) => m.type === "video");

					medias.forEach((m, i) => {
						if (m.type === "image" && !m.thumbOnly) {
							const thumb = document.createElement("div");
							thumb.className = "modal-thumb";
							thumb.style.backgroundImage = `url("${m.src}")`;

							thumb.onclick = (ev) => {
								ev.stopPropagation();
								renderModalMedia(i);
								modalThumbs
									.querySelectorAll(".modal-thumb")
									.forEach((el) => el.classList.remove("selected"));
								thumb.classList.add("selected");
							};

							if (i === initialIdx) thumb.classList.add("selected");
							modalThumbs.appendChild(thumb);
						}

						if (m.thumbOnly && videoIdx !== -1) {
							const thumb = document.createElement("div");
							thumb.className = "modal-thumb video-thumb";
							thumb.style.backgroundImage = `url("${m.src}")`;

							thumb.onclick = (ev) => {
								ev.stopPropagation();
								renderModalMedia(videoIdx);
								modalThumbs
									.querySelectorAll(".modal-thumb")
									.forEach((el) => el.classList.remove("selected"));
								thumb.classList.add("selected");
							};

							if (initialIdx === 0) thumb.classList.add("selected");
							modalThumbs.appendChild(thumb);
						}
					});

					ajustarThumbs();
				}

				renderModalInfo(d);
				renderModalMedia(defaultIdx);
				renderModalThumbs();

				modal.classList.remove("modal-closing");
				modal.style.display = "flex";
				void modal.offsetWidth;
				modal.classList.add("modal-open");
				document.body.style.overflow = "hidden";
			};
		});
	}

	renderFiltros();
	renderGaleria();

	const galeriaEl = document.getElementById(galeriaId);
	if (galeriaEl) applyTooltips(galeriaEl);

	function closeModal(modalId) {
		const modal = document.getElementById(modalId);
		if (!modal) return;

		const iframes = modal.querySelectorAll("iframe");
		iframes.forEach((iframe) => (iframe.src = ""));

		modal.classList.remove("modal-open");
		modal.classList.add("modal-closing");

		setTimeout(() => {
			modal.style.display = "none";
			modal.classList.remove("modal-closing");
			document.body.style.overflow = "";
			const crtBtn = document.getElementById("toggleClassBtn");
			if (crtBtn) crtBtn.style.display = "";
		}, 300);
	}

	function getVideoEmbedUrl(url) {
		try {
			if (url.includes("youtube.com") || url.includes("youtu.be")) {
				const match = url.match(/(?:v=|\.be\/)([^&?/]+)/);
				if (match && match[1])
					return `https://www.youtube.com/embed/${match[1]}`;
			}
			if (url.includes("drive.google.com")) {
				const match = url.match(/\/d\/([^/]+)\//);
				if (match && match[1])
					return `https://drive.google.com/file/d/${match[1]}/preview`;
			}
			return null;
		} catch (e) {
			return null;
		}
	}

	const modal = document.getElementById(modalId);
	if (modal) {
		modal.addEventListener("click", (e) => {
			const info = modal.querySelector("#modal-info");
			const thumbs = modal.querySelectorAll(".modal-thumb");
			const clicouThumb = Array.from(thumbs).some((t) => t.contains(e.target));
			if (!info.contains(e.target) && !clicouThumb) {
				closeModal(modalId);
			}
		});
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && modal.classList.contains("modal-open"))
				closeModal(modalId);
		});
	}

	modal.addEventListener("transitionend", () => {
		ajustarThumbs();
	});

	window.addEventListener("resize", () => {
		if (modal.classList.contains("modal-open")) {
			ajustarThumbs();
		}
	});
}
