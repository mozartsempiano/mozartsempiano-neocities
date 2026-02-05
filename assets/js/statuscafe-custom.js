// statuscafe-custom.js
// Fetches status.cafe JSON and renders into #statuscafe without the emoji (r.face).

(function () {
	// Configuration block: easy to customize defaults
	// You can override these globally by setting `window.STATUSCAFE_CONFIG = { ... }` before this script runs,
	// or per-page via data- attributes on `.statuscafe .box-inner` (data-avatar, data-show-face, data-show-avatar).
	var DEFAULTS = {
		statusUrl: "https://status.cafe/users/mozartsempiano/status.json",
		// local fallback avatar used when remote avatar is missing or fails
		defaultAvatar: "/assets/img/avatar.png",
		// avatar display size in px (used in injected styles)
		avatarSize: 45,
		// fade-in duration in milliseconds
		fadeMs: 240,
		// selector for the per-page wrapper to read data- attributes from
		wrapperSelector: ".statuscafe .box-inner",
		// class added to container when ready (used for the fade-in)
		revealClass: "statuscafe-loaded",
		enableDither: false,
	};

	// merge global overrides if present
	try {
		if (
			window &&
			window.STATUSCAFE_CONFIG &&
			typeof window.STATUSCAFE_CONFIG === "object"
		) {
			for (var k in window.STATUSCAFE_CONFIG) {
				if (Object.prototype.hasOwnProperty.call(window.STATUSCAFE_CONFIG, k)) {
					DEFAULTS[k] = window.STATUSCAFE_CONFIG[k];
				}
			}
		}
	} catch (e) {}

	function renderEmpty() {
		const contentEl = document.getElementById("statuscafe-content");
		if (contentEl) contentEl.innerHTML = "No status yet.";
		// reveal container even when empty, so user sees the box
		try {
			const c = document.getElementById("statuscafe");
			if (c) c.classList.add(DEFAULTS.revealClass);
		} catch (e) {}
	}

	// Write the placeholder HTML if it doesn't exist
	if (!document.getElementById("statuscafe")) {
		const container = document.createElement("div");
		container.id = "statuscafe";
		// Avatar (left), then username/time and content
		container.innerHTML =
			'<div class="statuscafe-row">' +
			'<div id="statuscafe-avatar" class="statuscafe-avatar"></div>' +
			'<div class="statuscafe-main">' +
			'<div id="statuscafe-username" class="statuscafe-username"></div>' +
			'<div id="statuscafe-content" class="statuscafe-content"></div>' +
			"</div></div>";
		// append to a sensible place: try to find .statuscafe .box-inner first
		const target =
			document.querySelector(".statuscafe .box-inner") || document.body;
		target.appendChild(container);
	}
	// Ensure the #statuscafe markup includes our avatar + main wrapper.
	(function ensureStructure() {
		var container = document.getElementById("statuscafe");
		if (!container) {
			// create full structure and append
			container = document.createElement("div");
			container.id = "statuscafe";
			container.innerHTML =
				'<div class="statuscafe-row">' +
				'<div id="statuscafe-avatar" class="statuscafe-avatar"></div>' +
				'<div class="statuscafe-main">' +
				'<div id="statuscafe-username" class="statuscafe-username"></div>' +
				'<div id="statuscafe-content" class="statuscafe-content"></div>' +
				"</div></div>";
			const target =
				document.querySelector(".statuscafe .box-inner") || document.body;
			target.appendChild(container);
			return;
		}

		// If container exists but lacks our row wrapper, adapt it in-place.
		if (!container.querySelector(".statuscafe-row")) {
			const row = document.createElement("div");
			row.className = "statuscafe-row";

			const avatarDiv = document.createElement("div");
			avatarDiv.id = "statuscafe-avatar";
			avatarDiv.className = "statuscafe-avatar";

			const mainDiv = document.createElement("div");
			mainDiv.className = "statuscafe-main";

			// Move existing username/content nodes into mainDiv if they exist
			const username = container.querySelector("#statuscafe-username");
			const content = container.querySelector("#statuscafe-content");
			if (username) mainDiv.appendChild(username);
			if (content) mainDiv.appendChild(content);

			// If neither specific nodes were found, move any children into mainDiv
			if (!username && !content) {
				while (container.firstChild) {
					mainDiv.appendChild(container.firstChild);
				}
			}

			row.appendChild(avatarDiv);
			row.appendChild(mainDiv);
			// Replace container contents with the new row
			container.innerHTML = "";
			container.appendChild(row);
		}
	})();

	// Ensure container uses flex layout and avatar exists as first child
	(function ensureAvatarPresence() {
		try {
			const container = document.getElementById("statuscafe");
			if (!container) return;

			// If a .statuscafe-row exists, we rely on it; otherwise make the container itself flex
			if (!container.querySelector(".statuscafe-row")) {
				container.style.display = "flex";
				container.style.alignItems = "flex-start";
				container.style.gap = "10px";
			}

			let avatarEl = container.querySelector("#statuscafe-avatar");
			if (!avatarEl) {
				avatarEl = document.createElement("div");
				avatarEl.id = "statuscafe-avatar";
				avatarEl.className = "statuscafe-avatar";
				// insert as first child
				if (container.firstChild)
					container.insertBefore(avatarEl, container.firstChild);
				else container.appendChild(avatarEl);
			}
			// apply dither class to container if enabled in config
			try {
				if (DEFAULTS.enableDither) avatarEl.classList.add("dither");
			} catch (e) {}
			// Do not insert any avatar image yet; we'll set avatar after we fetch the JSON
		} catch (e) {
			// ignore
		}
	})();

	// Inject minimal styles for the avatar layout (if not already present)
	(function injectStyles() {
		try {
			if (document.getElementById("statuscafe-styles")) return;
			const s = document.createElement("style");
			s.id = "statuscafe-styles";
			const avatarPx = `${DEFAULTS.avatarSize}px`;
			const fadeMs = `${DEFAULTS.fadeMs}ms`;
			s.textContent = `
#statuscafe {
  font-size: 0.95rem;
  opacity: 0;
  transition: opacity ${fadeMs} ease;
}

#statuscafe.${DEFAULTS.revealClass} { opacity: 1; }

#statuscafe .statuscafe-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

#statuscafe .statuscafe-avatar {
  width: auto;
  height: ${avatarPx};
  aspect-ratio: 1 / 1;
  flex: 0 0 auto
  background: #ddd;
  outline: 1px solid var(--clr-gray-a20);
  overflow: unset;
}

body.rounded #statuscafe .statuscafe-avatar {
  border-radius: 8px;
}

#statuscafe .statuscafe-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit; }

#statuscafe .statuscafe-main { flex: 1 1 auto; }
#statuscafe .statuscafe-username { font-weight: 600; margin-bottom: 4px; }
#statuscafe .statuscafe-content { color: var(--text-muted, #666); }

/* User-requested layout tweaks for the homepage boxes */
.linha:has(.box.song-status):has(.box.status):has(.box.statuscafe) .box {
  flex: 2 1 0% !important;
}

.box.statuscafe .box-inner {
  justify-content: center;
  align-items: center;
  text-align: left;
  padding: 20px 24px;
}

.box.statuscafe .box-inner #statuscafe-username {
  margin-left: -4px;
  color: var(--clr-gray-a50);
  overflow: hidden;
  display: inline-block;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.box.statuscafe .box-inner #statuscafe-username a {
  text-decoration: none;
}

.box.statuscafe {
  flex: 2 1 0%;
}

.linha .box.statuscafe .box-inner #statuscafe #statuscafe-avatar img:not(.dither) {
  image-rendering: pixelated;
}

/* aplica-se só se .linha tiver .box.statuscafe e mais nenhuma .box */
.linha:has(.box.statuscafe):not(:has(.box:not(.statuscafe))) .box.statuscafe .box-inner:has(#statuscafe) {
  background-color: var(--clr-black-a10);
  border: var(--borda-padrao);
  border-radius: 0px;
  width: 320px;
}
.linha:has(.box.statuscafe):not(:has(.box:not(.statuscafe))) {
  position: absolute;
  top: 10px;
  /* push away from the vertical scrollbar using a CSS variable set by JS */
  // right: calc(10px + var(--statuscafe-scrollbar-offset, 0px));
  right: 10px;
  z-index: 5;
  width: auto;
}

@media (max-width: 1024px) {
  .linha:has(.box.statuscafe):not(:has(.box:not(.statuscafe))) .box.statuscafe .box-inner:has(#statuscafe) {
    width: 100%;
  }
  .linha:has(.box.statuscafe):not(:has(.box:not(.statuscafe))) {
    position: static;
    width: 100%;
    }
}
`;
			document.head.appendChild(s);
		} catch (e) {
			/* ignore */
		}
	})();

	// Configuration: default behaviour for showing the face (emoji)
	// Set to true to include r.face when rendering username; false to omit. Per-page overrides supported.
	var showFace = false;

	// Allow per-page override via data-show-face and data-avatar on the configured wrapperSelector
	(function detectOverride() {
		try {
			const wrapper = document.querySelector(DEFAULTS.wrapperSelector);
			if (wrapper && wrapper.dataset) {
				if (typeof wrapper.dataset.showFace !== "undefined") {
					const val = wrapper.dataset.showFace.trim().toLowerCase();
					showFace = val === "1" || val === "true" || val === "yes";
				}
				if (
					typeof wrapper.dataset.avatar !== "undefined" &&
					wrapper.dataset.avatar
				) {
					DEFAULTS.defaultAvatar = wrapper.dataset.avatar;
				}
			}
		} catch (e) {
			// ignore
		}
	})();

	fetch(DEFAULTS.statusUrl)
		.then(function (r) {
			if (!r.ok) throw new Error("Network response was not ok");
			return r.json();
		})
		.then(function (r) {
			try {
				const contentEl = document.getElementById("statuscafe-content");
				const userEl = document.getElementById("statuscafe-username");

				if (!r || !r.content || !r.content.length) {
					renderEmpty();
					return;
				}

				// Build username HTML; include the face (emoji) only if showFace is true
				if (userEl) {
					var faceStr = "";
					try {
						if (showFace && r && r.face) faceStr = " " + r.face;
					} catch (e) {
						faceStr = "";
					}
					userEl.innerHTML =
						faceStr +
						" " +
						'<a href="https://status.cafe/users/mozartsempiano" target="_blank">' +
						(r.author || "mozartsempiano") +
						"</a> · " +
						(r.timeAgo || "");
				}

				// Content: insert content HTML
				if (contentEl) {
					contentEl.innerHTML = r.content;
				}

				// Avatar: try common fields, fallback to favicon. Reveal only after image loads,
				// or reveal immediately if no avatar URL is available.
				try {
					const avatarEl = document.getElementById("statuscafe-avatar");
					if (avatarEl) {
						var avatarUrl = null;
						if (r && (r.avatar || r.author_avatar || r.icon))
							avatarUrl = r.avatar || r.author_avatar || r.icon;
						// If wrapper provided a data-avatar override, prefer it
						try {
							const wrapper = document.querySelector(".statuscafe .box-inner");
							if (wrapper && wrapper.dataset && wrapper.dataset.avatar)
								avatarUrl = wrapper.dataset.avatar;
						} catch (e) {}

						if (!avatarUrl) {
							// no external avatar -> reveal immediately and use configured defaultAvatar as progressive fill
							try {
								avatarEl.innerHTML =
									'<img src="' + DEFAULTS.defaultAvatar + '" alt="avatar">';
								if (DEFAULTS.enableDither) {
									avatarEl.classList.add("dither");
									var fimg = avatarEl.querySelector("img");
									if (fimg) fimg.classList.add("dither");
								}
							} catch (e) {}
							const c = document.getElementById("statuscafe");
							if (c) c.classList.add(DEFAULTS.revealClass);
						} else {
							// create image element and wait for it to load before revealing
							var img = document.createElement("img");
							img.alt = "avatar";
							img.onload = function () {
								try {
									avatarEl.innerHTML = "";
									avatarEl.appendChild(img);
									if (DEFAULTS.enableDither) img.classList.add("dither");
								} catch (e) {}
								try {
									const c = document.getElementById("statuscafe");
									if (c) c.classList.add(DEFAULTS.revealClass);
								} catch (e) {}
							};
							img.onerror = function () {
								try {
									avatarEl.innerHTML =
										'<img src="' + DEFAULTS.defaultAvatar + '" alt="avatar">';
									if (DEFAULTS.enableDither) {
										avatarEl.classList.add("dither");
										var errImg = avatarEl.querySelector("img");
										if (errImg) errImg.classList.add("dither");
									}
								} catch (e) {}
								try {
									const c = document.getElementById("statuscafe");
									if (c) c.classList.add(DEFAULTS.revealClass);
								} catch (e) {}
							};
							// start loading
							img.src = avatarUrl;
						}
					} else {
						const c = document.getElementById("statuscafe");
						if (c) c.classList.add(DEFAULTS.revealClass);
					}
				} catch (e) {
					try {
						const c = document.getElementById("statuscafe");
						if (c) c.classList.add(DEFAULTS.revealClass);
					} catch (er) {}
				}
			} catch (err) {
				console.error("Error rendering status.cafe response:", err);
				renderEmpty();
			}
		})
		.catch(function (err) {
			console.error("Failed to fetch status.cafe JSON:", err);
			renderEmpty();
		});
})();

// Compute scrollbar width and set CSS variable to avoid overlapping the vertical scrollbar
(function avoidScrollbarOverlap() {
	function setOffset() {
		try {
			// create temporary element to measure scrollbar width
			const outer = document.createElement("div");
			outer.style.visibility = "hidden";
			outer.style.overflow = "scroll";
			outer.style.position = "absolute";
			outer.style.top = "-9999px";
			document.body.appendChild(outer);
			const inner = document.createElement("div");
			outer.appendChild(inner);
			const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
			document.body.removeChild(outer);
			document.documentElement.style.setProperty(
				"--statuscafe-scrollbar-offset",
				scrollbarWidth + "px"
			);
		} catch (e) {
			// ignore
		}
	}
	setOffset();
	window.addEventListener("resize", setOffset);
	window.addEventListener("orientationchange", setOffset);
	document.addEventListener("DOMContentLoaded", setOffset);
})();
