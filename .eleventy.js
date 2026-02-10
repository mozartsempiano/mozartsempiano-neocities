module.exports = function (eleventyConfig) {
	const markdownIt = require("markdown-it");
	const markdownItAnchor = require("markdown-it-anchor");
	const sitemap = require("@quasibit/eleventy-plugin-sitemap");
	const fs = require("fs");
	const path = require("path");
	const { Jimp } = require("jimp");
	const cheerio = require("cheerio");
	require("dotenv").config();
	const fetch = (...args) =>
		import("node-fetch").then(({ default: fetch }) => fetch(...args));

	const md = markdownIt({ html: true, linkify: true })
		.use(require("markdown-it-footnote"))
		.use(require("markdown-it-attrs"))
		.use(function (md) {
			md.linkify.add("[[", {
				validate: /^\s?([^\[\]\|\n\r]+)(\|[^\[\]\|\n\r]+)?\s?\]\]/,
				normalize: (match) => {
					const parts = match.raw.slice(2, -2).split("|");
					const slug = parts[0].replace(/.(md|markdown)\s?$/i, "").trim();
					match.text = (parts[1] || slug).trim();
					match.url = `/${slug}/`;
					match.schema = "";
				},
			});
		})
		.use(markdownItAnchor, {
			level: [2, 3, 4],
			slugify: (s) =>
				s
					.toLowerCase()
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.replace(/[^a-z0-9\s-]/g, "")
					.trim()
					.replace(/\s+/g, "-"),
		});

	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	const tmdbKey = process.env.TMDB_API_KEY;
	const lang = "en";

	eleventyConfig.addLiquidShortcode(
		"tmdbPoster",
		async (title, year, size = "w154") => {
			if (!tmdbKey) return "";

			const query = encodeURIComponent(title);
			const url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&language=${lang}&query=${query}&year=${year}`;

			try {
				const res = await fetch(url);
				const data = await res.json();
				const movie = data.results?.[0];

				if (!movie || !movie.poster_path) return "";

				return `<img src="https://image.tmdb.org/t/p/${size}${movie.poster_path}" alt="${movie.title} (${year})">`;
			} catch (e) {
				console.error("Erro ao buscar poster TMDB:", e);
				return "";
			}
		},
	);

	md.use(function (md) {
		md.inline.ruler.after("image", "tmdbPoster", function (state, silent) {
			const regex = /^!TMDB\[(.+?)\|(\d{4})\]/;
			const pos = state.pos;
			const src = state.src.slice(pos);
			const match = regex.exec(src);
			if (!match) return false;
			if (!silent) {
				const token = state.push("html_inline", "", 0);
				token.content = `{% tmdbPoster "${match[1].trim()}", ${match[2].trim()} %}`;
			}
			state.pos += match[0].length;
			return true;
		});
	});

	eleventyConfig.addGlobalData("eleventyComputed", {
		permalink: (data) => {
			const stem = data.page?.filePathStem;
			if (!stem) return;
			if (stem.startsWith("/content/")) {
				return `/${data.page.fileSlug}/`;
			}
		},
	});

	eleventyConfig.addFilter("lastModified", (page) =>
		fs.statSync(page.inputPath).mtime.getTime(),
	);

	eleventyConfig.addFilter("formatDateTime", (date) => {
		const d = new Date(date);
		if (isNaN(d)) return "data inválida";
		const w = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
		return `${w[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} BRT`;
	});

	(function addImageFigure(md) {
		const defaultImage =
			md.renderer.rules.image ||
			function (tokens, idx, options, env, self) {
				return self.renderToken(tokens, idx, options);
			};
		md.renderer.rules.image = function (tokens, idx, options, env, self) {
			const token = tokens[idx];
			const title = token.attrGet && token.attrGet("title");
			const imgHtml = defaultImage(tokens, idx, options, env, self);
			return title
				? `<figure>${imgHtml}<figcaption>${md.utils.escapeHtml(title)}</figcaption></figure>`
				: `<figure>${imgHtml}</figure>`;
		};
	})(md);

	const originalParagraphOpen =
		md.renderer.rules.paragraph_open ||
		function (tokens, idx, options, env, self) {
			return self.renderToken(tokens, idx, options);
		};
	const originalParagraphClose =
		md.renderer.rules.paragraph_close ||
		function (tokens, idx, options, env, self) {
			return self.renderToken(tokens, idx, options);
		};

	md.renderer.rules.paragraph_open = function (
		tokens,
		idx,
		options,
		env,
		self,
	) {
		const nextToken = tokens[idx + 1];
		if (
			nextToken &&
			nextToken.type === "inline" &&
			nextToken.children?.length === 1 &&
			nextToken.children[0].type === "image"
		)
			return "";
		return originalParagraphOpen(tokens, idx, options, env, self);
	};
	md.renderer.rules.paragraph_close = function (
		tokens,
		idx,
		options,
		env,
		self,
	) {
		const prevToken = tokens[idx - 1];
		if (
			prevToken &&
			prevToken.type === "inline" &&
			prevToken.children?.length === 1 &&
			prevToken.children[0].type === "image"
		)
			return "";
		return originalParagraphClose(tokens, idx, options, env, self);
	};

	eleventyConfig.addTransform("lazyImages", function (content, outputPath) {
		if (outputPath && outputPath.endsWith(".html"))
			return content.replace(
				/<img(?!.*loading=)(.*?)>/g,
				'<img$1 loading="lazy">',
			);
		return content;
	});

	eleventyConfig.addFilter("markdownify", (string) => md.render(string));
	eleventyConfig.setLibrary("md", md);
	eleventyConfig.addPlugin(sitemap, {
		sitemap: { hostname: "https://mozartsempiano.com" },
	});
	eleventyConfig.addPassthroughCopy("assets", {
		// Copy all assets, but skip original JPG/JPEG/PNG in assets/img (keep dither outputs and other formats).
		filter: [
			"**/*",
			"!img/**/*.jpg",
			"!img/**/*.jpeg",
			"!img/**/*.png",
			"img/dither/**/*",
		],
	});

	const stripLinks = (str) => str.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");

	eleventyConfig.addFilter("toc", (html) => {
		if (!html) return "";
		const re = /<h([2-4])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
		const items = [];
		let m;
		while ((m = re.exec(html)))
			items.push({ level: Number(m[1]), id: m[2], content: stripLinks(m[3]) });
		if (!items.length) return "";
		let htmlOut = "<nav class='toc'><ol>";
		let prevLevel = 2;
		for (const item of items) {
			while (item.level > prevLevel) {
				htmlOut += "<ol>";
				prevLevel++;
			}
			while (item.level < prevLevel) {
				htmlOut += "</ol>";
				prevLevel--;
			}
			htmlOut += `<li><a href="#${item.id}">${item.content}</a></li>`;
		}
		while (prevLevel > 2) {
			htmlOut += "</ol>";
			prevLevel--;
		}
		htmlOut += "</ol></nav>";
		return htmlOut;
	});

	eleventyConfig.addFilter("tocCount", (html) => {
		if (!html) return 0;
		const re = /<h([2-4])[^>]*id="([^"]+)"[^>]*>.*?<\/h\1>/gi;
		let count = 0;
		while (re.exec(html)) count++;
		return count;
	});

	eleventyConfig.addCollection("content", (collection) =>
		collection.getFilteredByGlob(["content/**/*.md", "index.md"]),
	);
	eleventyConfig.addCollection("allPages", (collection) =>
		collection
			.getAll()
			.filter((p) => p.url && !p.data?.draft)
			.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)),
	);

	eleventyConfig.addCollection("backlinks", (collection) => {
		const pages = collection.getAll().filter((p) => p.url && !p.data?.draft);
		const map = {};
		const wikiRe = /\[\[\s*([^\]\|\n]+)(?:\|[^\]\n]+)?\s*\]\]/g;
		const mdRe = /\[[^\]]*]\((\/[^)]+)\)/g;
		const norm = (u) => {
			if (!u.startsWith("/")) u = "/" + u;
			u = u.split("#")[0];
			if (!u.endsWith("/")) u += "/";
			return u;
		};

		for (const page of pages) {
			const content = page.rawInput || "";
			let m;
			wikiRe.lastIndex = 0;
			while ((m = wikiRe.exec(content))) {
				const target = norm(m[1].replace(/\.(md|markdown)$/i, ""));
				map[target] ??= [];
				map[target].push(page);
			}
			mdRe.lastIndex = 0;
			while ((m = mdRe.exec(content))) {
				const target = norm(m[1]);
				map[target] ??= [];
				map[target].push(page);
			}
		}

		for (const page of pages) {
			const refs = map[page.url] || [];
			page.data.backlinks = refs.map((p) => ({
				url: p.url,
				title: p.data?.title || p.fileSlug,
				preview: (p.rawInput || "").split(/\n\s*\n/)[0] || "",
			}));
		}

		return pages;
	});

	// Dither transform corrigido
	const OUTPUT_DIR = path.join(process.cwd(), "_site");
	const DITHER_OUT_DIR = path.join(OUTPUT_DIR, "assets/img/dither");
	const INPUT_IMG_DIR = path.join(process.cwd(), "assets/img");
	const VARS_CSS_PATH = path.join(process.cwd(), "assets/css/variaveis.css");
	const generatedDither = new Set();
	const DUOTONE_PALETTE = [
		{ r: 255, g: 255, b: 255 },
		{ r: 0, g: 0, b: 0 },
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

	function luminosity(r, g, b) {
		return 0.299 * r + 0.587 * g + 0.114 * b;
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
				const color =
					lum > normalizedThreshold ? DUOTONE_PALETTE[0] : DUOTONE_PALETTE[1];
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

	eleventyConfig.addTransform(
		"ditherImages",
		async function (content, outputPath) {
			if (outputPath && outputPath.endsWith(".html"))
				return await replaceDitherSrc(content);
			return content;
		},
	);

	return {
		dir: {
			input: "content",
			output: "_site",
			layouts: "../layouts",
			includes: "../includes",
			data: "../_data",
		},
		passthroughFileCopy: true,
	};
};
