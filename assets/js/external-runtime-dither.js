(function () {
  var VALID_BAYER = { 2: true, 4: true, 8: true, 16: true };

  var BAYER_2X2 = [
    [0, 2],
    [3, 1],
  ];
  var BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  var BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  var BAYER_16X16 = [
    [0, 128, 32, 160, 8, 136, 40, 168, 2, 130, 34, 162, 10, 138, 42, 170],
    [192, 64, 224, 96, 200, 72, 232, 104, 194, 66, 226, 98, 202, 74, 234, 106],
    [48, 176, 16, 144, 56, 184, 24, 152, 50, 178, 18, 146, 58, 186, 26, 154],
    [240, 112, 208, 80, 248, 120, 216, 88, 242, 114, 210, 82, 250, 122, 218, 90],
    [12, 140, 44, 172, 4, 132, 36, 164, 14, 142, 46, 174, 6, 134, 38, 166],
    [204, 76, 236, 108, 196, 68, 228, 100, 206, 78, 238, 110, 198, 70, 230, 102],
    [60, 188, 28, 156, 52, 180, 20, 148, 62, 190, 30, 158, 54, 182, 22, 150],
    [252, 124, 220, 92, 244, 116, 212, 84, 254, 126, 222, 94, 246, 118, 214, 86],
    [3, 131, 35, 163, 11, 139, 43, 171, 1, 129, 33, 161, 9, 137, 41, 169],
    [195, 67, 227, 99, 203, 75, 235, 107, 193, 65, 225, 97, 201, 73, 233, 105],
    [51, 179, 19, 147, 59, 187, 27, 155, 49, 177, 17, 145, 57, 185, 25, 153],
    [243, 115, 211, 83, 251, 123, 219, 91, 241, 113, 209, 81, 249, 121, 217, 89],
    [15, 143, 47, 175, 7, 135, 39, 167, 13, 141, 45, 173, 5, 133, 37, 165],
    [207, 79, 239, 111, 199, 71, 231, 103, 205, 77, 237, 109, 197, 69, 229, 101],
    [63, 191, 31, 159, 55, 183, 23, 151, 61, 189, 29, 157, 53, 181, 21, 149],
    [255, 127, 223, 95, 247, 119, 215, 87, 253, 125, 221, 93, 245, 117, 213, 85],
  ];

  var BAYER_MATRICES = {
    2: BAYER_2X2,
    4: BAYER_4X4,
    8: BAYER_8X8,
    16: BAYER_16X16,
  };

  function getConfiguredBayerSize() {
    var raw =
      (document.body && document.body.dataset && document.body.dataset.bayerSize) ||
      (document.documentElement &&
        document.documentElement.dataset &&
        document.documentElement.dataset.bayerSize) ||
      "16";
    var n = parseInt(String(raw).trim(), 10);
    return VALID_BAYER[n] ? n : 16;
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

    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) {
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

  function getPalette() {
    return [
      resolveCssVarColor("--clr-white", { r: 255, g: 255, b: 255 }),
      resolveCssVarColor("--clr-black-a10", null) ||
        resolveCssVarColor("--clr-black-a0", { r: 0, g: 0, b: 0 }),
    ];
  }

  function luminosity(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
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
    var cleanedAlt = alt.replace(re, "").replace(/\s{2,}/g, " ").trim();
    return { hasKeyword: true, cleanedAlt: cleanedAlt };
  }

  function syncHoverOriginalPreference(img, wrapper) {
    if (!img) return false;
    var fromAttr = String(img.getAttribute("data-hover-original") || "").toLowerCase() === "true";
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
      alt
    );
  }

  function shouldProcessImage(img) {
    if (!img || img.dataset.runtimeDitherDone === "true") return false;
    if (img.tagName !== "IMG") return false;
    if (img.classList.contains("dither-hover-original")) return false;
    if (img.getAttribute("aria-hidden") === "true" && !img.dataset.runtimeDither) return false;
    if (hasAltDitherOptOut(img)) return false;

    var resolvedSrc = img.currentSrc || img.getAttribute("src") || img.src;
    if (!resolvedSrc) return false;

    var mode = (img.dataset.runtimeDither || "").trim().toLowerCase();
    if (mode === "off" || mode === "false" || mode === "0") return false;
    if (mode === "on" || mode === "true") return true;
    if (mode === "external" || mode === "auto") return isExternalUrl(resolvedSrc);
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
    wrapper.className = "runtime-dither-wrap runtime-dither-fallback runtime-dither-pending";
    if (parent) {
      parent.insertBefore(wrapper, img);
    }
    wrapper.appendChild(img);
    img.classList.add("runtime-dither-source");

    if (img.classList.contains("imgPrincipal") || inFigure || originalDisplay === "block") {
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
    if (!wrapper.classList || !wrapper.classList.contains("runtime-dither-wrap")) return;
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
    return !!img && String(img.dataset.runtimeDitherRunSeq || "") === String(token || "");
  }

  function applyBayerDither(imageData, bayerSize, palette) {
    var matrix = BAYER_MATRICES[bayerSize] || BAYER_MATRICES[16];
    var width = imageData.width;
    var height = imageData.height;
    var data = imageData.data;
    var size = bayerSize;
    var max = size * size - 1;

    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var idx = (y * width + x) * 4;
        var a = data[idx + 3];
        if (a === 0) continue;

        var lum = luminosity(data[idx], data[idx + 1], data[idx + 2]);
        var threshold = matrix[y % size][x % size];
        var normalizedThreshold = (threshold / max) * 255;
        var color = lum > normalizedThreshold ? palette[0] : palette[1];

        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
      }
    }
  }

  async function renderCanvasDither(img, wrapper, canvas, options, runToken) {
    var src = img.currentSrc || img.getAttribute("src");
    if (!src) throw new Error("missing_src");

    var naturalWidth = img.naturalWidth || 0;
    var naturalHeight = img.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) throw new Error("missing_dimensions");

    var imgRect = img.getBoundingClientRect ? img.getBoundingClientRect() : null;
    var wrapperRect = wrapper.getBoundingClientRect ? wrapper.getBoundingClientRect() : null;
    var cssWidth = Math.round(
      (imgRect && imgRect.width) ||
      (wrapperRect && wrapperRect.width) ||
      wrapper.clientWidth ||
      img.clientWidth ||
      naturalWidth
    );
    if (!cssWidth) throw new Error("missing_css_width");
    var cssHeight = Math.round(
      (imgRect && imgRect.height) ||
      (wrapperRect && wrapperRect.height) ||
      img.clientHeight ||
      wrapper.clientHeight ||
      (naturalHeight / naturalWidth) * cssWidth
    );
    var renderWidth = Math.max(1, cssWidth);
    var renderHeight = Math.max(1, cssHeight);

    var source = await loadCorsImage(src);
    if (!isLatestRun(img, runToken)) throw new Error("stale_render");
    var offscreen = document.createElement("canvas");
    offscreen.width = renderWidth;
    offscreen.height = renderHeight;

    var octx = offscreen.getContext("2d", { willReadFrequently: true }) || offscreen.getContext("2d");
    if (!octx) throw new Error("no_2d_context");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(source, 0, 0, renderWidth, renderHeight);

    var imageData;
    try {
      imageData = octx.getImageData(0, 0, renderWidth, renderHeight);
    } catch (e) {
      throw e;
    }

    applyBayerDither(imageData, options.bayerSize, options.palette);
    octx.putImageData(imageData, 0, 0);
    if (!isLatestRun(img, runToken)) throw new Error("stale_render");

    canvas.width = renderWidth;
    canvas.height = renderHeight;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas_context");
    ctx.clearRect(0, 0, renderWidth, renderHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, renderWidth, renderHeight);

    canvas.style.width = "100%";
    canvas.style.height = "100%";
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
      if (img.dataset.runtimeDitherDone === "true") delete img.dataset.runtimeDitherDone;
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
      await renderCanvasDither(img, wrapper, canvas, options, runToken);
      if (!isLatestRun(img, runToken)) return;
      wrapper.classList.remove("runtime-dither-fallback", "runtime-dither-pending");
      wrapper.classList.add("runtime-dither-ready");
      img.dataset.runtimeDitherMode = "canvas";
    } catch (e) {
      if (e && e.message === "stale_render") return;
      if (!isLatestRun(img, runToken)) return;
      markFallback(img, wrapper, "fallback", e && e.name ? e.name : "runtime_dither_failed");
    }
  }

  function getTargets() {
    return Array.prototype.slice.call(
      document.querySelectorAll("img")
    );
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
      true
    );

    if (!("MutationObserver" in window)) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
            scanAndProcess(node, options);
          });
          return;
        }

        if (mutation.type === "attributes" && mutation.target && mutation.target.tagName === "IMG") {
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
      }
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
      palette: getPalette(),
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
