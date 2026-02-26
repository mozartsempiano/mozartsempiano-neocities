(function () {
	var DitherCore = window.DitherCore || null;

	function getConfiguredBayerSize() {
		var raw =
			(document.body &&
				document.body.dataset &&
				document.body.dataset.bayerSize) ||
			(document.documentElement &&
				document.documentElement.dataset &&
				document.documentElement.dataset.bayerSize) ||
			"16";
		if (DitherCore && typeof DitherCore.normalizeBayerSize === "function") {
			return DitherCore.normalizeBayerSize(raw, 16);
		}
		var n = parseInt(String(raw).trim(), 10);
		return n === 2 || n === 4 || n === 8 || n === 16 ? n : 16;
	}

	function parseCssColor(value) {
		if (!value) return null;
		var s = String(value).trim();
		if (!s) return null;

		if (s.charAt(0) === "#") {
			var hex = s.slice(1);
			if (hex.length === 3) {
				return {
					r: parseInt(hex.charAt(0) + hex.charAt(0), 16),
					g: parseInt(hex.charAt(1) + hex.charAt(1), 16),
					b: parseInt(hex.charAt(2) + hex.charAt(2), 16),
				};
			}
			if (hex.length >= 6) {
				return {
					r: parseInt(hex.slice(0, 2), 16),
					g: parseInt(hex.slice(2, 4), 16),
					b: parseInt(hex.slice(4, 6), 16),
				};
			}
		}

		var rgbMatch = s.match(/rgba?\(([^)]+)\)/i);
		if (!rgbMatch) return null;
		var parts = rgbMatch[1]
			.replace(/\//g, " ")
			.split(/[\s,]+/)
			.filter(Boolean)
			.slice(0, 3)
			.map(function (part) {
				return Number(part);
			});

		if (
			parts.length !== 3 ||
			parts.some(function (n) {
				return !Number.isFinite(n);
			})
		) {
			return null;
		}

		return {
			r: Math.max(0, Math.min(255, Math.round(parts[0]))),
			g: Math.max(0, Math.min(255, Math.round(parts[1]))),
			b: Math.max(0, Math.min(255, Math.round(parts[2]))),
		};
	}

	function resolveCssVarColor(varName, fallback) {
		var probe = document.createElement("span");
		probe.style.position = "absolute";
		probe.style.left = "-99999px";
		probe.style.top = "-99999px";
		probe.style.pointerEvents = "none";
		probe.style.color = "var(" + varName + ")";
		(document.body || document.documentElement).appendChild(probe);
		var color = parseCssColor(getComputedStyle(probe).color);
		probe.remove();
		return color || fallback;
	}

	function getComputedPaletteFallback() {
		return [
			resolveCssVarColor("--clr-white", { r: 255, g: 255, b: 255 }),
			resolveCssVarColor("--clr-black-a0", { r: 0, g: 0, b: 0 }),
		];
	}

	function createPaletteResolver() {
		var palettePromise = null;
		return function () {
			if (palettePromise) return palettePromise;

			palettePromise = (async function () {
				try {
					var response = await fetch("/assets/css/variaveis.css", {
						credentials: "same-origin",
					});
					if (response && response.ok) {
						var css = await response.text();
						var parsedPalette =
							DitherCore &&
							typeof DitherCore.getDuotonePaletteFromCssText === "function"
								? DitherCore.getDuotonePaletteFromCssText(css)
								: null;
						if (parsedPalette) return parsedPalette;
					}
				} catch (_) {}

				return getComputedPaletteFallback();
			})();

			return palettePromise;
		};
	}

	function isExternalUrl(src) {
		if (!src) return false;
		try {
			var u = new URL(src, window.location.href);
			return u.origin !== window.location.origin;
		} catch (_) {
			return false;
		}
	}

	function isTmdbImageUrl(src) {
		if (!src) return false;
		try {
			var u = new URL(src, window.location.href);
			return /(^|\.)image\.tmdb\.org$/i.test(u.hostname);
		} catch (_) {
			return false;
		}
	}

	function isGifUrl(src) {
		if (!src) return false;
		try {
			var u = new URL(src, window.location.href);
			return /\.gif$/i.test(u.pathname || "");
		} catch (_) {
			return /\.gif(?:$|[?#])/i.test(String(src));
		}
	}

	function getAltText(img) {
		if (!img || !img.hasAttribute || !img.hasAttribute("alt")) return "";
		return String(img.getAttribute("alt") || "");
	}

	function getAltKeywordInfo(img, keyword) {
		var alt = getAltText(img);
		if (!alt) return { hasKeyword: false, cleanedAlt: alt };
		var re = new RegExp("\\b" + keyword + "\\b", "i");
		if (!re.test(alt)) return { hasKeyword: false, cleanedAlt: alt };
		var cleanedAlt = alt
			.replace(re, "")
			.replace(/\s{2,}/g, " ")
			.trim();
		return { hasKeyword: true, cleanedAlt: cleanedAlt };
	}

	function syncHoverOriginalPreference(img, wrapper) {
		if (!img) return false;
		var fromAttr =
			String(img.getAttribute("data-hover-original") || "").toLowerCase() ===
			"true";
		var info = getAltKeywordInfo(img, "hover-original");

		if (info.hasKeyword) {
			if (!fromAttr) {
				img.setAttribute("data-hover-original", "true");
			}
			if (info.cleanedAlt) {
				if (img.getAttribute("alt") !== info.cleanedAlt) {
					img.setAttribute("alt", info.cleanedAlt);
				}
			} else if (img.hasAttribute("alt")) {
				img.removeAttribute("alt");
			}
		}

		var enabled = fromAttr || info.hasKeyword;
		if (wrapper && wrapper.classList) {
			wrapper.classList.toggle("runtime-dither-hover-original", enabled);
		}
		return enabled;
	}

	function hasAltDitherOptOut(img) {
		var alt = getAltText(img);
		if (!alt) return false;

		if (alt.indexOf("<") !== -1 || alt.indexOf(">") !== -1) return true;

		return /\b(?:no-dither|dither-off|sem-dither|original-only|invert|pixel)\b/i.test(
			alt,
		);
	}

	function shouldProcessImage(img) {
		if (!img || img.dataset.runtimeDitherDone === "true") return false;
		if (img.tagName !== "IMG") return false;
		if (img.classList.contains("dither-hover-original")) return false;
		if (
			img.getAttribute("aria-hidden") === "true" &&
			!img.dataset.runtimeDither
		)
			return false;
		if (hasAltDitherOptOut(img)) return false;

		var resolvedSrc = img.currentSrc || img.getAttribute("src") || img.src;
		if (!resolvedSrc) return false;

		var mode = (img.dataset.runtimeDither || "").trim().toLowerCase();
		if (mode === "off" || mode === "false" || mode === "0") return false;
		if (mode === "on" || mode === "true") return true;
		if (mode === "external" || mode === "auto")
			return isExternalUrl(resolvedSrc);
		if (mode === "tmdb") return isTmdbImageUrl(resolvedSrc);

		return isExternalUrl(resolvedSrc);
	}

	function waitForImage(img) {
		if (img.complete && img.naturalWidth > 0) return Promise.resolve();
		return new Promise(function (resolve, reject) {
			function onLoad() {
				cleanup();
				resolve();
			}
			function onError() {
				cleanup();
				reject(new Error("dom_image_load_failed"));
			}
			function cleanup() {
				img.removeEventListener("load", onLoad);
				img.removeEventListener("error", onError);
			}
			img.addEventListener("load", onLoad, { once: true });
			img.addEventListener("error", onError, { once: true });
		});
	}

	function loadCorsImage(src) {
		return new Promise(function (resolve, reject) {
			var image = new Image();
			image.crossOrigin = "anonymous";
			image.decoding = "async";
			image.onload = function () {
				resolve(image);
			};
			image.onerror = function () {
				reject(new Error("cors_image_load_failed"));
			};
			image.src = src;
		});
	}

	function ensureWrapper(img) {
		var parent = img.parentElement;
		if (parent && parent.classList.contains("runtime-dither-wrap")) {
			img.classList.add("runtime-dither-source");
			return parent;
		}

		var inFigure = !!(img.closest && img.closest("figure"));
		var originalComputed = getComputedStyle(img);
		var originalDisplay = originalComputed.display;

		var wrapper = document.createElement("span");
		wrapper.className =
			"runtime-dither-wrap runtime-dither-fallback runtime-dither-pending";
		if (parent) {
			parent.insertBefore(wrapper, img);
		}
		wrapper.appendChild(img);
		img.classList.add("runtime-dither-source");

		if (
			img.classList.contains("imgPrincipal") ||
			inFigure ||
			originalDisplay === "block"
		) {
			wrapper.classList.add("runtime-dither-block");
		} else {
			wrapper.classList.add("runtime-dither-inline");
		}

		var radius = originalComputed.borderRadius;
		if (radius) wrapper.style.borderRadius = radius;

		return wrapper;
	}

	function ensureCanvas(wrapper) {
		var canvas = wrapper.querySelector("canvas.runtime-dither-canvas");
		if (canvas) return canvas;
		canvas = document.createElement("canvas");
		canvas.className = "runtime-dither-canvas";
		canvas.setAttribute("aria-hidden", "true");
		wrapper.appendChild(canvas);
		return canvas;
	}

	function teardownRuntimeDither(img) {
		if (!img || !img.parentElement) return;
		var wrapper = img.parentElement;
		if (
			!wrapper.classList ||
			!wrapper.classList.contains("runtime-dither-wrap")
		)
			return;
		var host = wrapper.parentNode;
		if (!host) return;

		img.classList.remove("runtime-dither-source");
		host.insertBefore(img, wrapper);
		wrapper.remove();
	}

	function nextRunToken(img) {
		var current = parseInt(img.dataset.runtimeDitherRunSeq || "0", 10);
		var next = Number.isFinite(current) ? current + 1 : 1;
		var token = String(next);
		img.dataset.runtimeDitherRunSeq = token;
		return token;
	}

	function isLatestRun(img, token) {
		return (
			!!img &&
			String(img.dataset.runtimeDitherRunSeq || "") === String(token || "")
		);
	}

	async function renderCanvasDither(img, wrapper, canvas, options, runToken) {
		var src = img.currentSrc || img.getAttribute("src");
		if (!src) throw new Error("missing_src");

		var naturalWidth = img.naturalWidth || 0;
		var naturalHeight = img.naturalHeight || 0;
		if (!naturalWidth || !naturalHeight) throw new Error("missing_dimensions");

		var imgRect = img.getBoundingClientRect
			? img.getBoundingClientRect()
			: null;
		var wrapperRect = wrapper.getBoundingClientRect
			? wrapper.getBoundingClientRect()
			: null;
		var cssWidth = Math.round(
			(imgRect && imgRect.width) ||
				(wrapperRect && wrapperRect.width) ||
				wrapper.clientWidth ||
				img.clientWidth ||
				naturalWidth,
		);
		if (!cssWidth) throw new Error("missing_css_width");
		var cssHeight = Math.round(
			(imgRect && imgRect.height) ||
				(wrapperRect && wrapperRect.height) ||
				img.clientHeight ||
				wrapper.clientHeight ||
				(naturalHeight / naturalWidth) * cssWidth,
		);
		var renderWidth = Math.max(1, cssWidth);
		var renderHeight = Math.max(1, cssHeight);

		var source = await loadCorsImage(src);
		if (!isLatestRun(img, runToken)) throw new Error("stale_render");
		var offscreen = document.createElement("canvas");
		offscreen.width = renderWidth;
		offscreen.height = renderHeight;

		var octx =
			offscreen.getContext("2d", { willReadFrequently: true }) ||
			offscreen.getContext("2d");
		if (!octx) throw new Error("no_2d_context");
		octx.imageSmoothingEnabled = true;
		octx.drawImage(source, 0, 0, renderWidth, renderHeight);

		var imageData;
		try {
			imageData = octx.getImageData(0, 0, renderWidth, renderHeight);
		} catch (e) {
			throw e;
		}

		if (
			!DitherCore ||
			typeof DitherCore.applyBayerDitherToImageData !== "function"
		) {
			throw new Error("missing_dither_core");
		}
		DitherCore.applyBayerDitherToImageData(
			imageData,
			options.bayerSize,
			options.palette,
		);
		octx.putImageData(imageData, 0, 0);
		if (!isLatestRun(img, runToken)) throw new Error("stale_render");

		canvas.width = renderWidth;
		canvas.height = renderHeight;
		var ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("no_canvas_context");
		ctx.clearRect(0, 0, renderWidth, renderHeight);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(offscreen, 0, 0, renderWidth, renderHeight);

		canvas.style.display = "block";
	}

	function markFallback(img, wrapper, mode, errorCode) {
		wrapper.classList.remove("runtime-dither-pending", "runtime-dither-ready");
		wrapper.classList.add("runtime-dither-fallback");
		img.dataset.runtimeDitherMode = mode || "fallback";
		if (errorCode) {
			img.dataset.runtimeDitherError = errorCode;
		} else if (img.dataset.runtimeDitherError) {
			delete img.dataset.runtimeDitherError;
		}
	}

	async function processImage(img, options) {
		if (hasAltDitherOptOut(img)) {
			teardownRuntimeDither(img);
			img.dataset.runtimeDitherMode = "optout-alt";
			if (img.dataset.runtimeDitherError) delete img.dataset.runtimeDitherError;
			if (img.dataset.runtimeDitherDone === "true")
				delete img.dataset.runtimeDitherDone;
			return;
		}

		if (!shouldProcessImage(img)) return;
		img.dataset.runtimeDitherDone = "true";
		var runToken = nextRunToken(img);

		var wrapper = ensureWrapper(img);
		syncHoverOriginalPreference(img, wrapper);
		var canvas = ensureCanvas(wrapper);
		wrapper.classList.remove("runtime-dither-ready");
		wrapper.classList.add("runtime-dither-pending", "runtime-dither-fallback");

		try {
			await waitForImage(img);
			if (!isLatestRun(img, runToken)) return;
			if (isGifUrl(img.currentSrc || img.getAttribute("src") || img.src)) {
				if (!isLatestRun(img, runToken)) return;
				markFallback(img, wrapper, "fallback-gif", "gif_not_canvas_dithered");
				return;
			}
			var palette = await options.getPalette();
			if (!palette || !palette[0] || !palette[1]) {
				palette = getComputedPaletteFallback();
			}
			if (!isLatestRun(img, runToken)) return;
			await renderCanvasDither(
				img,
				wrapper,
				canvas,
				{
					bayerSize: options.bayerSize,
					palette: palette,
				},
				runToken,
			);
			if (!isLatestRun(img, runToken)) return;
			wrapper.classList.remove(
				"runtime-dither-fallback",
				"runtime-dither-pending",
			);
			wrapper.classList.add("runtime-dither-ready");
			img.dataset.runtimeDitherMode = "canvas";
		} catch (e) {
			if (e && e.message === "stale_render") return;
			if (!isLatestRun(img, runToken)) return;
			markFallback(
				img,
				wrapper,
				"fallback",
				e && e.name ? e.name : "runtime_dither_failed",
			);
		}
	}

	function getTargets() {
		return Array.prototype.slice.call(document.querySelectorAll("img"));
	}

	function scanAndProcess(root, options) {
		if (!root) return;
		if (root.tagName === "IMG") {
			processImage(root, options);
			return;
		}
		if (!root.querySelectorAll) return;
		Array.prototype.forEach.call(root.querySelectorAll("img"), function (img) {
			processImage(img, options);
		});
	}

	function setupObservers(options) {
		if (!document.body) return;

		document.addEventListener(
			"load",
			function (event) {
				var target = event.target;
				if (target && target.tagName === "IMG") {
					processImage(target, options);
				}
			},
			true,
		);

		if (!("MutationObserver" in window)) return;
		var observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.type === "childList") {
					Array.prototype.forEach.call(
						mutation.addedNodes || [],
						function (node) {
							scanAndProcess(node, options);
						},
					);
					return;
				}

				if (
					mutation.type === "attributes" &&
					mutation.target &&
					mutation.target.tagName === "IMG"
				) {
					var img = mutation.target;
					if (img.dataset.runtimeDitherDone === "true") {
						delete img.dataset.runtimeDitherDone;
					}
					processImage(img, options);
				}
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["src", "srcset", "alt", "data-runtime-dither"],
		});
	}

	function refreshCanvasImages(options) {
		Array.prototype.forEach.call(
			document.querySelectorAll("img[data-runtime-dither-mode='canvas']"),
			function (img) {
				if (img.dataset.runtimeDitherDone === "true") {
					delete img.dataset.runtimeDitherDone;
				}
				processImage(img, options);
			},
		);
	}

	function debounce(fn, wait) {
		var timer = null;
		return function () {
			var args = arguments;
			clearTimeout(timer);
			timer = setTimeout(function () {
				fn.apply(null, args);
			}, wait);
		};
	}

	function setupRefreshHooks(options) {
		var refresh = debounce(function () {
			refreshCanvasImages(options);
		}, 120);

		window.addEventListener("load", function () {
			refresh();
		});

		window.addEventListener("resize", function () {
			refresh();
		});
	}

	function init() {
		if (!document.body) return;
		var options = {
			bayerSize: getConfiguredBayerSize(),
			getPalette: createPaletteResolver(),
		};

		getTargets().forEach(function (img) {
			processImage(img, options);
		});
		setupObservers(options);
		setupRefreshHooks(options);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
