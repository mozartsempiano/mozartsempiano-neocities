const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");
const cheerio = require("cheerio");

module.exports = function configureDitherTransform(eleventyConfig) {
	// Dither transform corrigido
	const isServeMode = process.env.ELEVENTY_RUN_MODE === "serve";
	const ditherDisabledInServe =
		process.env.ELEVENTY_DISABLE_DITHER_IN_SERVE === "1";
	const OUTPUT_DIR = path.join(process.cwd(), "_site");
	const DITHER_OUT_DIR = path.join(OUTPUT_DIR, "assets/img/dither");
	const INPUT_IMG_DIR = path.join(process.cwd(), "assets/img");
	const VARS_CSS_PATH = path.join(process.cwd(), "assets/css/variaveis.css");
	const generatedDither = new Set();
	const copiedOriginal = new Set();
	const frontMatterCache = new Map();
	const HOVER_ALT_KEYWORD = "hover-original";
	const siteData = require(path.join(process.cwd(), "_data", "site.json"));
	const BAYER = Number(siteData?.dither?.bayerSize ?? siteData?.bayerSize ?? 16);
	if (![2, 4, 8, 16].includes(BAYER)) {
		throw new Error(
			`BAYER inválido no site.json: ${BAYER}. Use 2, 4, 8 ou 16.`,
		);
	}
	const BAYER_2X2 = [
		[0, 2],
		[3, 1],
	];
	const BAYER_4X4 = [
		[0, 8, 2, 10],
		[12, 4, 14, 6],
		[3, 11, 1, 9],
		[15, 7, 13, 5],
	];
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
	const BAYER_16X16 = [
		[0, 128, 32, 160, 8, 136, 40, 168, 2, 130, 34, 162, 10, 138, 42, 170],
		[192, 64, 224, 96, 200, 72, 232, 104, 194, 66, 226, 98, 202, 74, 234, 106],
		[48, 176, 16, 144, 56, 184, 24, 152, 50, 178, 18, 146, 58, 186, 26, 154],
		[
			240, 112, 208, 80, 248, 120, 216, 88, 242, 114, 210, 82, 250, 122, 218,
			90,
		],
		[12, 140, 44, 172, 4, 132, 36, 164, 14, 142, 46, 174, 6, 134, 38, 166],
		[
			204, 76, 236, 108, 196, 68, 228, 100, 206, 78, 238, 110, 198, 70, 230,
			102,
		],
		[60, 188, 28, 156, 52, 180, 20, 148, 62, 190, 30, 158, 54, 182, 22, 150],
		[
			252, 124, 220, 92, 244, 116, 212, 84, 254, 126, 222, 94, 246, 118, 214,
			86,
		],
		[3, 131, 35, 163, 11, 139, 43, 171, 1, 129, 33, 161, 9, 137, 41, 169],
		[195, 67, 227, 99, 203, 75, 235, 107, 193, 65, 225, 97, 201, 73, 233, 105],
		[51, 179, 19, 147, 59, 187, 27, 155, 49, 177, 17, 145, 57, 185, 25, 153],
		[
			243, 115, 211, 83, 251, 123, 219, 91, 241, 113, 209, 81, 249, 121, 217,
			89,
		],
		[15, 143, 47, 175, 7, 135, 39, 167, 13, 141, 45, 173, 5, 133, 37, 165],
		[
			207, 79, 239, 111, 199, 71, 231, 103, 205, 77, 237, 109, 197, 69, 229,
			101,
		],
		[63, 191, 31, 159, 55, 183, 23, 151, 61, 189, 29, 157, 53, 181, 21, 149],
		[
			255, 127, 223, 95, 247, 119, 215, 87, 253, 125, 221, 93, 245, 117, 213,
			85,
		],
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
		if (!fs.existsSync(VARS_CSS_PATH)) {
			return [
				{ r: 255, g: 255, b: 255 },
				{ r: 0, g: 0, b: 0 },
			];
		}
		const css = fs.readFileSync(VARS_CSS_PATH, "utf8");
		const rootCss = getRootBlock(css);
		const whiteRgb = getCssVarRgb(rootCss, "clr-white");
		const blackRgb =
			getCssVarRgb(rootCss, "clr-black-a10") ||
			getCssVarRgb(rootCss, "clr-black-a0");
		return [whiteRgb, blackRgb].filter(Boolean);
	}

	function getCssVarRgb(css, name) {
		const re = new RegExp(
			`--${name}\\s*:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`,
			"i",
		);
		const match = css.match(re);
		if (match)
			return {
				r: parseInt(match[1]),
				g: parseInt(match[2]),
				b: parseInt(match[3]),
			};
		return null;
	}

	function getMainWidthPx() {
		if (!fs.existsSync(VARS_CSS_PATH)) return 840;
		const css = fs.readFileSync(VARS_CSS_PATH, "utf8");
		const match = css.match(/--main-width:\s*([0-9.]+)px\s*;/i);
		if (!match) return 840;
		const value = Math.round(Number(match[1]));
		return Number.isFinite(value) && value > 0 ? value : 840;
	}

	function parseBooleanLike(value) {
		if (typeof value === "boolean") return value;
		if (typeof value === "number") {
			if (value === 1) return true;
			if (value === 0) return false;
			return null;
		}
		if (typeof value !== "string") return null;
		const normalized = value.trim().toLowerCase();
		if (!normalized) return null;
		if (["true", "1", "yes", "y", "on", "enabled"].includes(normalized))
			return true;
		if (["false", "0", "no", "n", "off", "disabled"].includes(normalized))
			return false;
		return null;
	}

	function getDitherDisableValue(data) {
		if (!data || typeof data !== "object") return null;
		for (const key of ["noDither", "disableDither", "ditherDisabled"]) {
			if (!(key in data)) continue;
			const parsed = parseBooleanLike(data[key]);
			if (parsed !== null) return parsed;
		}
		if (!("dither" in data)) return null;
		const parsedDither = parseBooleanLike(data.dither);
		if (parsedDither !== null) return !parsedDither;
		if (typeof data.dither === "string") {
			const normalized = data.dither.trim().toLowerCase();
			if (["none", "original"].includes(normalized)) return true;
			if (normalized === "dither") return false;
		}
		return null;
	}

	function getInputPathFromContext(context) {
		return context?.page?.inputPath || context?.inputPath || null;
	}

	function parseSimpleFrontMatter(inputPath) {
		if (!inputPath) return null;
		const absolutePath = path.isAbsolute(inputPath)
			? inputPath
			: path.join(process.cwd(), inputPath);
		if (!fs.existsSync(absolutePath)) return null;

		const stat = fs.statSync(absolutePath);
		const cacheKey = `${absolutePath}|${stat.size}|${Math.floor(stat.mtimeMs)}`;
		if (frontMatterCache.has(cacheKey)) return frontMatterCache.get(cacheKey);

		const fileContent = fs.readFileSync(absolutePath, "utf8");
		const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
		if (!match) {
			frontMatterCache.set(cacheKey, null);
			return null;
		}

		const data = {};
		for (const line of match[1].split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const kv = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/);
			if (!kv) continue;
			const key = kv[1];
			let value = kv[2].trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			data[key] = value;
		}

		frontMatterCache.set(cacheKey, data);
		return data;
	}

	function shouldDisableDither(context) {
		for (const candidate of [context?.ctx, context?.data, context]) {
			const disableValue = getDitherDisableValue(candidate);
			if (disableValue !== null) return disableValue;
		}
		const frontMatterData = parseSimpleFrontMatter(
			getInputPathFromContext(context),
		);
		const disableFromFrontMatter = getDitherDisableValue(frontMatterData);
		return disableFromFrontMatter === true;
	}

	async function generateDitheredImage(inputPath, outPath, maxWidth = null) {
		const image = await Jimp.read(inputPath);
		if (maxWidth && image.bitmap.width > maxWidth) {
			image.resize({ w: Math.round(maxWidth) });
		}
		const palette = getDuotonePalette();
		const { width, height } = image.bitmap;
		const data = image.bitmap.data;
		let BAYER_MATRIX = null;
		switch (BAYER) {
			case 2:
				BAYER_MATRIX = BAYER_2X2;
				break;
			case 4:
				BAYER_MATRIX = BAYER_4X4;
				break;
			case 8:
				BAYER_MATRIX = BAYER_8X8;
				break;
			case 16:
				BAYER_MATRIX = BAYER_16X16;
				break;
			default:
				throw new Error("Valor de BAYER inválido");
		}
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				const r = data[idx],
					g = data[idx + 1],
					b = data[idx + 2],
					a = data[idx + 3];
				if (a === 0) continue;
				const lum = luminosity(r, g, b);
				const size = BAYER;
				const max = size * size - 1;
				const threshold = BAYER_MATRIX[y % size][x % size];
				const normalizedThreshold = (threshold / max) * 255;
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
		if (
			/^https?:\/\//i.test(trimmed) ||
			trimmed.startsWith("//") ||
			trimmed.startsWith("data:")
		)
			return null;
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

	function getOriginalInfo(src) {
		const normalized = normalizeSrc(src);
		if (!normalized) return null;
		const { assetRel } = normalized;
		if (!/\.(png|jpe?g)$/i.test(assetRel)) return null;
		const assetRelFs = assetRel.split("/").join(path.sep);
		const inputFsPath = path.join(INPUT_IMG_DIR, assetRelFs);
		if (!fs.existsSync(inputFsPath)) return null;
		const outFsPath = path.join(OUTPUT_DIR, "assets/img", assetRelFs);
		return { inputFsPath, outFsPath };
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

	async function ensureOriginalCopied(info) {
		if (!info) return;
		if (copiedOriginal.has(info.outFsPath) || fs.existsSync(info.outFsPath)) {
			copiedOriginal.add(info.outFsPath);
			return;
		}
		try {
			await fs.promises.mkdir(path.dirname(info.outFsPath), {
				recursive: true,
			});
			await fs.promises.copyFile(info.inputFsPath, info.outFsPath);
			copiedOriginal.add(info.outFsPath);
			console.log("[dither] original copiado", info.outFsPath);
		} catch (e) {
			console.error("[dither] falha ao copiar original", info.inputFsPath, e);
		}
	}

	function getAttr(tag, name) {
		const re = new RegExp(`\\b${name}\\s*=\\s*(['"])([^'"]+)\\1`, "i");
		const match = tag.match(re);
		return match ? match[2] : null;
	}

	function escapeAttr(value) {
		return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
	}

	function setAttr(tag, name, value) {
		const escaped = escapeAttr(value);
		const re = new RegExp(`\\b${name}\\s*=\\s*(['"])([^'"]*)\\1`, "i");
		if (re.test(tag)) return tag.replace(re, `${name}="${escaped}"`);
		return tag.replace(/\/?>$/, (end) => ` ${name}="${escaped}"${end}`);
	}

	function removeAttr(tag, name) {
		const re = new RegExp(`\\s*\\b${name}\\s*=\\s*(['"])([^'"]*)\\1`, "i");
		return tag.replace(re, "");
	}

	function hasAttr(tag, name) {
		const re = new RegExp(`\\b${name}\\s*=`, "i");
		return re.test(tag);
	}

	function addClass(tag, className) {
		const currentClass = getAttr(tag, "class");
		if (!currentClass) return setAttr(tag, "class", className);
		const classes = currentClass.split(/\s+/).filter(Boolean);
		if (classes.includes(className)) return tag;
		classes.push(className);
		return setAttr(tag, "class", classes.join(" "));
	}

	function hasClass(tag, className) {
		const currentClass = getAttr(tag, "class");
		if (!currentClass) return false;
		return currentClass.split(/\s+/).filter(Boolean).includes(className);
	}

	function getAltKeywordInfo(tag) {
		const alt = getAttr(tag, "alt");
		if (!alt) return { hasKeyword: false, cleanedAlt: null };
		const keywordRe = new RegExp(`\\b${HOVER_ALT_KEYWORD}\\b`, "i");
		if (!keywordRe.test(alt)) return { hasKeyword: false, cleanedAlt: alt };
		const cleanedAlt = alt
			.replace(keywordRe, "")
			.replace(/\s{2,}/g, " ")
			.trim();
		return { hasKeyword: true, cleanedAlt };
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
			const { hasKeyword, cleanedAlt } = getAltKeywordInfo(tag);
			const hasHoverAttr = hasAttr(tag, "data-hover-original");
			const shouldEnableHover = hasHoverAttr || hasKeyword;
			const variant = hasClass(tag, "imgPrincipal") ? "large" : "small";
			const width = variant === "large" ? largeWidth : smallWidth;
			const info = getDitherInfo(src, variant);
			if (!info) return tag;
			tasks.push(ensureDithered(info, width));
			const mapped = `${info.ditherUrl}${info.suffix}`;
			let outTag = tag.replace(
				/\bsrc\s*=\s*(['"])([^'"]+)\1/i,
				`src=$1${mapped}$1`,
			);
			if (shouldEnableHover) {
				outTag = setAttr(outTag, "data-hover-original", "true");
				outTag = setAttr(outTag, "data-dither-src", mapped);
				outTag = setAttr(outTag, "data-original-src", src);
				outTag = addClass(outTag, "dither-hover-swap");
			}
			if (hasKeyword) {
				if (cleanedAlt) outTag = setAttr(outTag, "alt", cleanedAlt);
				else outTag = removeAttr(outTag, "alt");
			}
			return outTag;
		});
		if (tasks.length) await Promise.all(tasks);
		return wrapNonGalleryHoverImages(updated);
	}

	function wrapNonGalleryHoverImages(html) {
		if (!html) return html;
		const $ = cheerio.load(html, { decodeEntities: false });

		$("img[data-hover-original='true'][data-original-src]").each((_, img) => {
			const $img = $(img);
			if ($img.closest(".gallery").length) return;
			if ($img.closest("a").length) return;

			const originalSrc = $img.attr("data-original-src");
			if (!originalSrc) return;

			$img.wrap(
				`<a href="${originalSrc}" target="_blank" rel="noopener noreferrer" class="hover-original-link"></a>`,
			);
		});

		return $.html();
	}

	async function ensureOriginalAssets(html) {
		if (!html) return;
		const tasks = [];
		html.replace(/<img\b[^>]*>/gi, (tag) => {
			if (!/\ssrc\s*=/.test(tag)) return tag;
			const src = getAttr(tag, "src");
			if (!src) return tag;
			const info = getOriginalInfo(src);
			if (!info) return tag;
			tasks.push(ensureOriginalCopied(info));
			return tag;
		});
		if (tasks.length) await Promise.all(tasks);
	}

	eleventyConfig.addTransform(
		"ditherImages",
		async function (content, outputPath) {
			if (outputPath && outputPath.endsWith(".html")) {
				if (isServeMode && ditherDisabledInServe) {
					return content;
				}
				if (shouldDisableDither(this)) {
					await ensureOriginalAssets(content);
					return content;
				}
				return await replaceDitherSrc(content);
			}
			return content;
		},
	);
};
