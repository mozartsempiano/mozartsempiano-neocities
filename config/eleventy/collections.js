module.exports = function configureCollections(eleventyConfig) {
	const getContentBody = (page) => {
		const raw = typeof page?.rawInput === "string" ? page.rawInput : "";
		return raw.replace(/^---[\s\S]*?---\s*/, "");
	};

	const isEmptyContent = (page) => {
		const input = (page?.inputPath || "").replace(/\\/g, "/");
		if (!input.endsWith(".md")) return false;
		return getContentBody(page).trim().length === 0;
	};

	eleventyConfig.addCollection("content", (collection) =>
		collection.getFilteredByGlob(["content/**/*.md", "index.md"]),
	);

	eleventyConfig.addCollection("allPages", (collection) =>
		collection
			.getAll()
			.filter((p) => p.url && !p.data?.draft)
			// .filter((p) => !isEmptyContent(p))
			.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)),
	);

	eleventyConfig.addCollection("paginasVazias", (collection) =>
		collection
			.getAll()
			.filter((p) => p.url && !p.data?.draft)
			.filter((p) => isEmptyContent(p)),
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
};
