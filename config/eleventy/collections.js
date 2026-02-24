const path = require("path");

module.exports = function configureCollections(eleventyConfig) {
  const normalizeUrl = (url) => {
    if (!url) return null;
    const value = String(url).trim();
    if (!value) return null;
    if (value.startsWith("/")) return value;
    return `/${value}`;
  };

  const loadData = (filename) => {
    try {
      const fullPath = path.join(process.cwd(), "_data", filename);
      delete require.cache[require.resolve(fullPath)];
      return require(fullPath);
    } catch {
      return null;
    }
  };

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
    (() => {
      const map = new Map();

      collection
      .getAll()
      .filter((p) => p.url && !p.data?.draft)
      // .filter((p) => !isEmptyContent(p))
      .forEach((p) => map.set(p.url, p));

      const logPages = loadData("logPages.js");
      if (Array.isArray(logPages)) {
        for (const entry of logPages) {
          const url = normalizeUrl(entry?.permalink);
          if (!url || map.has(url)) continue;
          map.set(url, { url, data: { title: entry?.title || url } });
        }
      }

      const galeriaCatalog = loadData("galeriaCatalog.js");
      const galeriaItems = galeriaCatalog?.items;
      if (Array.isArray(galeriaItems)) {
        for (const item of galeriaItems) {
          const url = normalizeUrl(item?.url);
          if (!url || map.has(url)) continue;
          map.set(url, { url, data: { title: item?.title || url } });
        }
      }

      return [...map.values()].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
    })(),
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

    // Ensure gallery item URLs are present in this collection even when
    // Eleventy does not expose each paginated output as a collection item.
    const existingUrls = new Set(pages.map((p) => norm(p.url)));
    const galeriaCatalogForTargets = loadData("galeriaCatalog.js");
    const galeriaItemsForTargets = galeriaCatalogForTargets?.items;
    if (Array.isArray(galeriaItemsForTargets)) {
      for (const item of galeriaItemsForTargets) {
        const itemUrl = norm(item?.url || "");
        if (!itemUrl || existingUrls.has(itemUrl)) continue;
        pages.push({
          url: itemUrl,
          fileSlug: item?.slug || itemUrl.replace(/^\/|\/$/g, ""),
          rawInput: "",
          data: { title: item?.title || itemUrl },
        });
        existingUrls.add(itemUrl);
      }
    }

    for (const page of pages) {
      const content = page.rawInput || "";
      let m;

      wikiRe.lastIndex = 0;
      while ((m = wikiRe.exec(content))) {
        const target = norm(m[1].replace(/\.(md|markdown)$/i, ""));
        map[target] ??= new Map(); // <- Map por url
        map[target].set(page.url, page); // <- dedupe por url
      }

      mdRe.lastIndex = 0;
      while ((m = mdRe.exec(content))) {
        const target = norm(m[1]);
        map[target] ??= new Map();
        map[target].set(page.url, page);
      }
    }

    // Gallery item links are rendered dynamically in templates, so they are not
    // present in rawInput. Rebuild those backlinks from galeriaCatalog.
    const pagesByUrl = new Map();
    for (const page of pages) pagesByUrl.set(norm(page.url), page);

    const galeriaCatalog = loadData("galeriaCatalog.js");
    const galeriaItems = galeriaCatalog?.items;
    if (Array.isArray(galeriaItems)) {
      for (const item of galeriaItems) {
        const targetUrl = norm(item?.url || "");
        const sourceUrl = norm(item?.galleryUrl || "");
        if (!targetUrl || !sourceUrl || targetUrl === sourceUrl) continue;
        const sourcePage = pagesByUrl.get(sourceUrl);
        if (!sourcePage) continue;
        map[targetUrl] ??= new Map();
        map[targetUrl].set(sourcePage.url, sourcePage);
      }
    }

    for (const page of pages) {
      const refsMap = map[page.url];
      const refs = refsMap ? [...refsMap.values()] : [];

      page.data.backlinks = refs.map((p) => ({
        url: p.url,
        title: p.data?.title || p.fileSlug,
        preview: (p.rawInput || "").split(/\n\s*\n/)[0] || "",
      }));
    }

    return pages;
  });
};
