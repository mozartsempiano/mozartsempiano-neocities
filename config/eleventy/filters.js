const fs = require("fs");
const path = require("path");

const stripLinks = (str) => str.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");

module.exports = function configureFilters(eleventyConfig) {
  const toMillis = (value) => {
    if (!value) return NaN;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  };
  eleventyConfig.addFilter("toMillis", toMillis);
  eleventyConfig.addNunjucksFilter("toMillis", toMillis);

  eleventyConfig.addFilter("lastModified", (page) => {
    const inputPath = typeof page === "string" ? page : page?.inputPath || page?.page?.inputPath;
    if (!inputPath) return NaN;
    const fullPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
    try {
      return fs.statSync(fullPath).mtime.getTime();
    } catch (e) {
      return NaN;
    }
  });

  eleventyConfig.addFilter("toc", (html) => {
    if (!html) return "";
    const re = /<h([2-4])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
    const items = [];
    let m;
    while ((m = re.exec(html))) items.push({ level: Number(m[1]), id: m[2], content: stripLinks(m[3]) });
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

  const pagesTree = (pages) => {
    const root = { label: "/", children: new Map(), page: null };

    for (const page of pages || []) {
      const url = String(page?.url || "").trim();
      if (!url || url === "/") continue;

      const segments = url.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
      let node = root;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!node.children.has(segment)) {
          node.children.set(segment, { label: segment, children: new Map(), page: null });
        }
        node = node.children.get(segment);
        if (i === segments.length - 1) {
          node.page = page;
        }
      }
    }

    const toArray = (node) =>
      [...node.children.values()]
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
        .map((child) => ({
          ...child,
          children: toArray(child),
        }));

    return toArray(root);
  };
  eleventyConfig.addFilter("pagesTree", pagesTree);
  eleventyConfig.addNunjucksFilter("pagesTree", pagesTree);

  /* SAB 22.12.2012 17:45 BRT */
  eleventyConfig.addFilter("formatDateTime", (date) => {
    let d;
    let hasTime = false;

    if (date instanceof Date) {
      d = date;
      hasTime =
        d.getHours() !== 0 ||
        d.getMinutes() !== 0 ||
        d.getSeconds() !== 0 ||
        d.getMilliseconds() !== 0;
    } else if (typeof date === "number") {
      d = new Date(date);
      hasTime = true;
    } else if (typeof date === "string") {
      const input = date.trim();
      if (!input) return "data invalida";

      if (/^\d+$/.test(input)) {
        d = new Date(Number(input));
        hasTime = true;
      } else {
        d = new Date(input);
        hasTime = /T\d{2}:\d{2}(:\d{2})?/.test(input) || /\b\d{2}:\d{2}\b/.test(input);
      }
    } else {
      return "data invalida";
    }

    if (!d || Number.isNaN(d.getTime())) return "data invalida";

    const w = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
    const base = `${w[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

    if (!hasTime) return base;

    return `${base} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} BRT`;
  });

  /* sábado, 22 de dezembro de 2012 */
  eleventyConfig.addFilter("formatDateLongPtBr", (date) => {
    const d = new Date(date);
    if (isNaN(d)) return "data invalida";

    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  });

  eleventyConfig.addFilter("formatHora", (value) => {
    const d = new Date(value);
    return d.toISOString().slice(11, 16);
  });
};
