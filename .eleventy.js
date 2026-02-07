module.exports = function (eleventyConfig) {
  const markdownIt = require("markdown-it");
  const markdownItAnchor = require("markdown-it-anchor");
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

  // --- Data de criação e modificação ---
  eleventyConfig.addFilter("lastModified", (page) => {
    return fs.statSync(page.inputPath).mtime.getTime();
  });

  eleventyConfig.addFilter("formatDateTime", (date) => {
    const d = new Date(date);
    if (isNaN(d)) return "data inválida";

    const w = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
    return `${w[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} BRT`;
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
    content = content.replace(/<p>\s*(<img[^>]+>)\s*<\/p>/gi, (_, img) => `<figure>${img}</figure>`);

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

  // Sitemap
  eleventyConfig.addCollection("allPages", (collection) => {
    return collection
      .getAll()
      .filter((page) => page.url)
      .filter((page) => !page.data.draft)
      .sort((a, b) => {
        if (a.url < b.url) return -1;
        if (a.url > b.url) return 1;
        return 0;
      });
  });

  // Backlinks
  eleventyConfig.addCollection("backlinks", (collection) => {
    const pages = collection.getAll().filter((p) => p.url && !p.data?.draft);

    const map = {};

    const wikiRe = /\[\[\s*([^\]\|\n]+)(?:\|[^\]\n]+)?\s*\]\]/g;
    const mdRe = /\[[^\]]*]\((\/[^)]+)\)/g;

    const norm = (u) => {
      if (!u.startsWith("/")) u = "/" + u;
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
