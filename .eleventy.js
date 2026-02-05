module.exports = function (eleventyConfig) {
	const markdownIt = require("markdown-it");
	const sitemap = require("@quasibit/eleventy-plugin-sitemap");
	const fs = require("fs");

	// --- Configura Markdown ---
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
		});

	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	// --- Move páginas pro root ---
	eleventyConfig.addGlobalData("eleventyComputed", {
		permalink: (data) => {
			const stem = data.page?.filePathStem;
			if (!stem) return;
			if (stem.startsWith("/content/")) {
				return `/${data.page.fileSlug}/`;
			}
		},
	});

	eleventyConfig.addFilter("lastModified", (page) => {
		return fs.statSync(page.inputPath).mtime;
	});

	eleventyConfig.addFilter("formatDateTime", (date) => {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d)) return "data inválida";

		const weekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

		const wd = weekdays[d.getDay()];
		const dd = String(d.getDate()).padStart(2, "0");
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const yyyy = d.getFullYear();
		const hh = String(d.getHours()).padStart(2, "0");
		const min = String(d.getMinutes()).padStart(2, "0");

		return `${wd} ${dd}.${mm}.${yyyy} ${hh}:${min} BRT`;
	});

	// --- Custom renderer de imagens ---
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

			if (title) {
				const escapedTitle = md.utils.escapeHtml(title);
				return `<figure>${imgHtml}<figcaption>${escapedTitle}</figcaption></figure>`;
			}

			return `<figure>${imgHtml}</figure>`;
		};
	})(md);

	// --- Transform: <p><img></p> → <figure> para imagens sem caption ---
	eleventyConfig.addTransform("imgToFigure", (content, outputPath) => {
		if (!outputPath || !outputPath.endsWith(".html")) return content;

		// Substitui <p> contendo apenas <img> por <figure>
		content = content.replace(
			/<p>\s*(<img[^>]+>)\s*<\/p>/gi,
			(_, img) => `<figure>${img}</figure>`,
		);

		return content;
	});

	// --- Filtros e plugins ---
	eleventyConfig.addFilter("markdownify", (string) => md.render(string));
	eleventyConfig.setLibrary("md", md);
	eleventyConfig.addPlugin(sitemap, {
		sitemap: { hostname: "https://mozartsempiano.com" },
	});
	eleventyConfig.addPassthroughCopy("assets");

	// Coleções
	eleventyConfig.addCollection("content", (collection) =>
		collection.getFilteredByGlob(["content/**/*.md", "index.md"]),
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
