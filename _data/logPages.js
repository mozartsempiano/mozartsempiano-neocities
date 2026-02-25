const fs = require("fs");
const path = require("path");

const DATA_DIR = __dirname;
const CONTENT_DIR = path.join(__dirname, "..", "content");
const LOG_DATA_RE = /-log\.(js|json)$/i;
const LOG_POSTER_PROVIDERS = {
  "cinema-log": "tmdb",
  "series-log": "tmdb",
  "anime-log": "tmdb",
  "leitura-log": "openlibrary",
};
const LOG_TMDB_MEDIA_TYPES = {
  "series-log": "tv",
};
const LOG_TITLES = {
  "cinema-log": "Diário de Filmes",
  "series-log": "Diário de Séries",
  "leitura-log": "Diário de Leitura",
};

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kv = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
    if (!kv) continue;

    const key = kv[1];
    let value = kv[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, body: match[2] || "" };
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

function titleFromSlug(slug) {
  const label = slug.replace(/-log$/i, "").replace(/-/g, " ").trim();
  if (!label) return "Log";
  return `Diário de ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function normalizePosterProvider(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["tmdb", "openlibrary", "none"].includes(normalized)) return normalized;
  if (["open-library", "open_library", "ol"].includes(normalized)) return "openlibrary";
  return null;
}

function normalizeTmdbMediaType(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["tv", "series", "show", "shows"].includes(normalized)) return "tv";
  if (["movie", "movies", "film", "films"].includes(normalized)) return "movie";
  return null;
}

function getDefaultPosterProvider(slug) {
  return LOG_POSTER_PROVIDERS[slug] || "none";
}

function getDefaultTmdbMediaType(slug) {
  return LOG_TMDB_MEDIA_TYPES[slug] || "movie";
}

function loadSourceMeta(slug) {
  const sourcePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(sourcePath)) {
    return {
      title: LOG_TITLES[slug] || titleFromSlug(slug),
      subtitulo: "",
      imgPrincipal: "",
      imgPrincipalCaption: "",
      posterProvider: getDefaultPosterProvider(slug),
      tmdbMediaType: getDefaultTmdbMediaType(slug),
      noBacklinks: false,
      draft: false,
      introMarkdown: "",
    };
  }

  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = parseFrontMatter(raw);
  const draft = parseBooleanLike(parsed.data.draft) === true;
  const noBacklinks = parseBooleanLike(parsed.data.noBacklinks) === true;

  const posterProviderOverride = normalizePosterProvider(parsed.data.posterProvider);
  const tmdbMediaTypeOverride = normalizeTmdbMediaType(parsed.data.tmdbMediaType);
  const enableTmdbPostersOverride = parseBooleanLike(parsed.data.enableTmdbPosters);
  const legacyEnablePostersOverride = parseBooleanLike(parsed.data.enablePosters);

  let posterProvider = getDefaultPosterProvider(slug);
  let tmdbMediaType = getDefaultTmdbMediaType(slug);
  if (posterProviderOverride !== null) {
    posterProvider = posterProviderOverride;
  } else if (enableTmdbPostersOverride !== null || legacyEnablePostersOverride !== null) {
    const enabled = enableTmdbPostersOverride !== null ? enableTmdbPostersOverride : legacyEnablePostersOverride;
    posterProvider = enabled ? "tmdb" : "none";
  }
  if (tmdbMediaTypeOverride !== null) {
    tmdbMediaType = tmdbMediaTypeOverride;
  }

  return {
    title: parsed.data.title || LOG_TITLES[slug] || titleFromSlug(slug),
    subtitulo: parsed.data.subtitulo || "",
    imgPrincipal: parsed.data.imgPrincipal || "",
    imgPrincipalCaption: parsed.data.imgPrincipalCaption || "",
    posterProvider,
    tmdbMediaType,
    noBacklinks,
    draft,
    introMarkdown: (parsed.body || "").trim(),
  };
}

function loadRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    const raw = fs.readFileSync(filePath, "utf8");
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(normalized);
  }

  delete require.cache[require.resolve(filePath)];
  return require(filePath);
}

function getYearFromWhen(value) {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})/);
    if (m) return m[1];
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) return String(dt.getUTCFullYear());
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return String(value.getUTCFullYear());
  }

  return null;
}

function byWhenDesc(a, b) {
  const aTime = new Date(a?.when || "").getTime();
  const bTime = new Date(b?.when || "").getTime();
  const aSafe = Number.isNaN(aTime) ? -Infinity : aTime;
  const bSafe = Number.isNaN(bTime) ? -Infinity : bTime;
  return bSafe - aSafe;
}

module.exports = (() => {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((name) => LOG_DATA_RE.test(name))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const pages = [];

  for (const fileName of files) {
    const fullPath = path.join(DATA_DIR, fileName);
    const slug = fileName.replace(/\.(js|json)$/i, "");
    const meta = loadSourceMeta(slug);
    if (meta.draft) continue;

    let rows;
    try {
      rows = loadRows(fullPath);
    } catch (e) {
      console.error(`[logs] erro ao carregar ${fileName}`, e);
      continue;
    }

    if (!Array.isArray(rows) || rows.length === 0) continue;

    const cleanedRows = rows
      .filter((row) => row && typeof row === "object")
      .filter((row) => getYearFromWhen(row.when))
      .sort(byWhenDesc);

    if (!cleanedRows.length) continue;

    const byYear = new Map();
    for (const row of cleanedRows) {
      const year = getYearFromWhen(row.when);
      if (!year) continue;
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(row);
    }

    const years = [...byYear.keys()].sort((a, b) => Number(b) - Number(a));

    years.forEach((year, index) => {
      const newestYear = years[0];
      const isNewestYear = year === newestYear;
      const newerYear = index > 0 ? years[index - 1] : null;
      const olderYear = index + 1 < years.length ? years[index + 1] : null;

      const permalink = isNewestYear ? `/${slug}/` : `/${slug}/${year}/`;
      const newerUrl = newerYear ? (newerYear === newestYear ? `/${slug}/` : `/${slug}/${newerYear}/`) : null;
      const olderUrl = olderYear ? `/${slug}/${olderYear}/` : null;

      pages.push({
        slug,
        title: meta.title,
        subtitulo: meta.subtitulo,
        imgPrincipal: meta.imgPrincipal,
        imgPrincipalCaption: meta.imgPrincipalCaption,
        posterProvider: meta.posterProvider,
        tmdbMediaType: meta.tmdbMediaType,
        noBacklinks: meta.noBacklinks,
        introMarkdown: meta.introMarkdown,
        year,
        years,
        items: byYear.get(year) || [],
        isNewestYear,
        permalink,
        newerYear,
        newerUrl,
        olderYear,
        olderUrl,
      });
    });
  }

  return pages;
})();

