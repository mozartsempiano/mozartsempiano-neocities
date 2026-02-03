(function injectDitherDuotoneAll() {
  function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  // Pega direto do CSS
  const DUOTONE_PALETTE = [hexToRgb(getCssVariable("--clr-white")), hexToRgb(getCssVariable("--clr-black-a0"))];

  const BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];

  function getLuminosity(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function applyBayerDither2Colors(imageData) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const luminosity = getLuminosity(r, g, b);
        const threshold = BAYER_8X8[y % 8][x % 8];
        const normalizedThreshold = (threshold / 64) * 255;

        const color = luminosity > normalizedThreshold ? DUOTONE_PALETTE[0] : DUOTONE_PALETTE[1];
        if (pixels[i + 3] !== 0) {
          pixels[i] = color.r;
          pixels[i + 1] = color.g;
          pixels[i + 2] = color.b;
        }
      }
    }

    return imageData;
  }

  function getMaxWidthPx() {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--main-width").trim();

    if (!value.endsWith("px")) return null;
    return parseFloat(value);
  }

  function isSupportedImage(img) {
    const src = img.currentSrc || img.src;
    return /\.(png|jpe?g|webp)$/i.test(src);
  }

  function imageToCanvas(img) {
    const maxWidth = getMaxWidthPx();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    let targetW = naturalW;
    let targetH = naturalH;

    if (maxWidth && naturalW > maxWidth) {
      const ratio = naturalH / naturalW;

      if (img.id === "imgPrincipal") {
        targetW = maxWidth; // imagem principal usa maxWidth completo
      } else {
        targetW = maxWidth / 2; // outras usam metade
      }

      targetH = Math.round(targetW * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas;
  }

  async function processImage(img) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = imageToCanvas(img);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        applyBayerDither2Colors(imageData);
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Falha ao criar blob"));
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    });
  }

  async function processAllImages() {
    const images = Array.from(document.querySelectorAll("img")).filter(
      (img) => !img.dataset.ditherProcessed && isSupportedImage(img),
    );

    for (const img of images) {
      try {
        if (!img.complete) {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Falha ao carregar imagem"));
            setTimeout(() => reject(new Error("Timeout ao carregar imagem")), 10000);
          });
        }

        if (img.naturalWidth === 0 || img.naturalHeight === 0) continue;

        const ditherBlob = await processImage(img);
        img.src = URL.createObjectURL(ditherBlob);
        img.dataset.ditherProcessed = "true";
      } catch (e) {
        console.error("Erro ao processar imagem:", e);
        img.dataset.ditherProcessed = "error";
      }
    }
  }

  function run() {
    processAllImages();

    const mo = new MutationObserver(() => {
      processAllImages();
    });

    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
