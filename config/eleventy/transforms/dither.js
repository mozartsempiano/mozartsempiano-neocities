const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

module.exports = function configureDitherTransform(eleventyConfig) {
  // Dither transform corrigido
  const OUTPUT_DIR = path.join(process.cwd(), "_site");
  const DITHER_OUT_DIR = path.join(OUTPUT_DIR, "assets/img/dither");
  const INPUT_IMG_DIR = path.join(process.cwd(), "assets/img");
  const VARS_CSS_PATH = path.join(process.cwd(), "assets/css/variaveis.css");
  const generatedDither = new Set();
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

  function luminosity(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    const cleaned = hex.replace("#", "").trim();
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }

  function getCssVarHex(css, name) {
    const re = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`);
    const match = css.match(re);
    return match ? match[1] : null;
  }

  function getRootBlock(css) {
    const match = css.match(/:root\s*\{[\s\S]*?\}/);
    return match ? match[0] : "";
  }

  function getDuotonePalette() {
    const css = fs.readFileSync(VARS_CSS_PATH, "utf8");
    const rootCss = getRootBlock(css);
    const whiteHex = getCssVarHex(rootCss, "clr-white");
    const blackHex =
      getCssVarHex(rootCss, "clr-black-a10") ||
      getCssVarHex(rootCss, "clr-black-a0");
    return [hexToRgb(whiteHex), hexToRgb(blackHex)];
  }

  function getMainWidthPx() {
    if (!fs.existsSync(VARS_CSS_PATH)) return 840;
    const css = fs.readFileSync(VARS_CSS_PATH, "utf8");
    const match = css.match(/--main-width:\s*([0-9.]+)px\s*;/i);
    if (!match) return 840;
    const value = Math.round(Number(match[1]));
    return Number.isFinite(value) && value > 0 ? value : 840;
  }

  async function generateDitheredImage(inputPath, outPath, maxWidth = null) {
    const image = await Jimp.read(inputPath);
    if (maxWidth && image.bitmap.width > maxWidth) {
      image.resize({ w: Math.round(maxWidth) });
    }
    const palette = getDuotonePalette();
    const { width, height } = image.bitmap;
    const data = image.bitmap.data;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx],
          g = data[idx + 1],
          b = data[idx + 2],
          a = data[idx + 3];
        if (a === 0) continue;
        const lum = luminosity(r, g, b);
        const threshold = BAYER_8X8[y % 8][x % 8];
        const normalizedThreshold = (threshold / 64) * 255;
        const color = lum > normalizedThreshold ? palette[0] : palette[1];
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
      }
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    await image.write(outPath);
  }

  function normalizeSrc(src) {
    if (!src) return null;
    const trimmed = src.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//") || trimmed.startsWith("data:")) return null;
    const cutIndex = trimmed.search(/[?#]/);
    const base = cutIndex === -1 ? trimmed : trimmed.slice(0, cutIndex);
    const suffix = cutIndex === -1 ? "" : trimmed.slice(cutIndex);
    const marker = "/assets/img/";
    let idx = base.indexOf(marker);
    let assetRel = null;
    if (idx >= 0) assetRel = base.slice(idx + marker.length);
    else {
      const marker2 = "assets/img/";
      idx = base.indexOf(marker2);
      if (idx >= 0) assetRel = base.slice(idx + marker2.length);
    }
    if (!assetRel) return null;
    assetRel = assetRel.replace(/^\/+/, "");
    return { assetRel, suffix };
  }

  function getDitherInfo(src, variant) {
    const normalized = normalizeSrc(src);
    if (!normalized) return null;
    const { assetRel, suffix } = normalized;
    if (!/\.(png|jpe?g)$/i.test(assetRel)) return null;
    const assetRelFs = assetRel.split("/").join(path.sep);
    const inputFsPath = path.join(INPUT_IMG_DIR, assetRelFs);
    if (!fs.existsSync(inputFsPath)) return null;
    const stat = fs.statSync(inputFsPath);
    const base = path.basename(assetRel, path.extname(assetRel));
    const relDir = path.dirname(assetRel);
    const relDirFs = relDir === "." ? "" : relDir.split("/").join(path.sep);
    const relDirPosix = relDir === "." ? "" : relDir.split(path.sep).join("/");
    const hash = `${stat.size}-${Math.floor(stat.mtimeMs)}`;
    const outName = `${base}-${hash}-${variant}.png`;
    const outFsPath = path.join(DITHER_OUT_DIR, relDirFs, outName);
    const ditherUrl = `/assets/img/dither/${relDirPosix ? `${relDirPosix}/` : ""}${outName}`;
    return { inputFsPath, outFsPath, ditherUrl, suffix };
  }

  async function ensureDithered(info, maxWidth) {
    if (!info) return;
    if (generatedDither.has(info.outFsPath) || fs.existsSync(info.outFsPath)) {
      generatedDither.add(info.outFsPath);
      return;
    }
    try {
      await generateDitheredImage(info.inputFsPath, info.outFsPath, maxWidth);
      generatedDither.add(info.outFsPath);
      console.log("[dither] gerado", info.outFsPath);
    } catch (e) {
      console.error("[dither] falha ao gerar", info.inputFsPath, e);
    }
  }

  function getAttr(tag, name) {
    const re = new RegExp(`\\b${name}\\s*=\\s*(['"])([^'"]+)\\1`, "i");
    const match = tag.match(re);
    return match ? match[2] : null;
  }

  async function replaceDitherSrc(html) {
    if (!html) return html;
    const mainWidth = getMainWidthPx();
    const largeWidth = mainWidth;
    const smallWidth = Math.max(1, Math.round(mainWidth / 2));
    const tasks = [];
    const updated = html.replace(/<img\b[^>]*>/gi, (tag) => {
      if (!/\ssrc\s*=/.test(tag)) return tag;
      const src = getAttr(tag, "src");
      if (!src) return tag;
      const id = getAttr(tag, "id");
      const variant = id === "imgPrincipal" ? "large" : "small";
      const width = variant === "large" ? largeWidth : smallWidth;
      const info = getDitherInfo(src, variant);
      if (!info) return tag;
      tasks.push(ensureDithered(info, width));
      const mapped = `${info.ditherUrl}${info.suffix}`;
      return tag.replace(/\bsrc\s*=\s*(['"])([^'"]+)\1/i, `src=$1${mapped}$1`);
    });
    if (tasks.length) await Promise.all(tasks);
    return updated;
  }

  eleventyConfig.addTransform("ditherImages", async function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) return await replaceDitherSrc(content);
    return content;
  });
};
