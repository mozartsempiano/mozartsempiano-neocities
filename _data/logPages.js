const fs = require("fs");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const DATA_DIR = __dirname;
const CONTENT_DIR = path.join(__dirname, "..", "content");
const LOG_DATA_RE = /-log\.(js|json)$/i;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const TMDB_BACKDROP_CACHE_PATH = path.join(process.cwd(), ".cache", "tmdb-backdrops.json");
const TMDB_CACHE_VERSION = 1;
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
const LOG_DYNAMIC_HEADER_SLUGS = new Set(["cinema-log", "series-log", "anime-log"]);
const LOG_BACKDROP_DIR = path.join(process.cwd(), "assets", "img", "tmdb-backdrops");

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TMDB_CACHE_DAYS = toPositiveNumber(process.env.TMDB_CACHE_DAYS, 30);
const TMDB_NOT_FOUND_CACHE_DAYS = toPositiveNumber(process.env.TMDB_NOT_FOUND_CACHE_DAYS, 7);
const TMDB_FORCE_REFRESH = process.env.TMDB_FORCE_REFRESH === "1";

function resolveLogHeaderImage(slug) {
  const fileName = `${slug}-header.jpg`;
  const fsPath = path.join(__dirname, "..", "assets", "img", fileName);
  if (!fs.existsSync(fsPath)) return "";
  return `/assets/img/${fileName}`;
}

function normalizeTmdbMediaTypeSafe(value) {
  const normalized = normalizeTmdbMediaType(value);
  return normalized || "movie";
}

function normalizeTmdbCacheKey(title, year, mediaType) {
  const safeTitle = String(title || "").trim().toLowerCase();
  const safeYear = String(year || "").trim();
  const safeMediaType = normalizeTmdbMediaTypeSafe(mediaType);
  return `${safeTitle}|${safeYear}|${safeMediaType}`;
}

function loadCache(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      return { version: TMDB_CACHE_VERSION, items: {} };
    }
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: TMDB_CACHE_VERSION, items: {} };
    }
    const items = parsed.items && typeof parsed.items === "object" ? parsed.items : {};
    return { version: TMDB_CACHE_VERSION, items };
  } catch {
    return { version: TMDB_CACHE_VERSION, items: {} };
  }
}

function saveCache(cachePath, cache) {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          version: TMDB_CACHE_VERSION,
          updatedAt: new Date().toISOString(),
          items: cache.items || {},
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {}
}

function isEntryFresh(entry, forceRefresh, cacheDays, notFoundCacheDays) {
  if (!entry || forceRefresh) return false;
  const fetchedAt = Date.parse(entry.fetchedAt || "");
  if (!Number.isFinite(fetchedAt)) return false;
  const ageMs = Date.now() - fetchedAt;
  const maxAgeDays = entry.status === "not_found" ? notFoundCacheDays : cacheDays;
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

async function fetchTmdbBackdropEntry(title, year, mediaType, tmdbKey, useYearFilter = true) {
  const safeTitle = String(title || "").trim();
  const safeMediaType = normalizeTmdbMediaTypeSafe(mediaType);
  if (!safeTitle || !tmdbKey) {
    return { status: "not_found", fetchedAt: new Date().toISOString() };
  }

  const params = new URLSearchParams({
    api_key: tmdbKey,
    language: "en",
    query: safeTitle,
  });

  const yearNum = Number.parseInt(String(year || "").trim(), 10);
  if (useYearFilter && Number.isFinite(yearNum)) {
    if (safeMediaType === "tv") {
      params.set("first_air_date_year", String(yearNum));
    } else {
      params.set("year", String(yearNum));
    }
  }

  const url = `https://api.themoviedb.org/3/search/${safeMediaType}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB HTTP ${res.status}`);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  const result = results.find((item) => item && item.backdrop_path) || results[0];

  if (!result || !result.backdrop_path) {
    return {
      status: "not_found",
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    status: "ok",
    backdropPath: result.backdrop_path,
    title: result.title || result.name || safeTitle,
    mediaType: safeMediaType,
    fetchedAt: new Date().toISOString(),
  };
}

async function resolveTmdbBackdropEntry(title, year, mediaType, tmdbKey, cache, inFlight) {
  const safeMediaType = normalizeTmdbMediaTypeSafe(mediaType);
  const key = normalizeTmdbCacheKey(title, year, safeMediaType);
  const cached = cache.items[key];

  if (isEntryFresh(cached, TMDB_FORCE_REFRESH, TMDB_CACHE_DAYS, TMDB_NOT_FOUND_CACHE_DAYS)) {
    return cached;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const hasYear = Number.isFinite(Number.parseInt(String(year || "").trim(), 10));

  const job = (async () => {
    try {
      let next = await fetchTmdbBackdropEntry(title, year, safeMediaType, tmdbKey, true);
      if (next?.status === "not_found" && hasYear) {
        next = await fetchTmdbBackdropEntry(title, year, safeMediaType, tmdbKey, false);
      }
      cache.items[key] = next;
      saveCache(TMDB_BACKDROP_CACHE_PATH, cache);
      return next;
    } catch (e) {
      if (cached) return cached;
      console.error("[tmdb] erro ao atualizar backdrop:", e.message);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
}

async function resolveTmdbBackdropWithFallback(title, year, mediaType, tmdbKey, cache, inFlight) {
  const primaryMediaType = normalizeTmdbMediaTypeSafe(mediaType);
  const mediaTypes =
    primaryMediaType === "tv"
      ? ["tv", "movie"]
      : primaryMediaType === "movie"
        ? ["movie", "tv"]
        : [primaryMediaType];

  for (const currentType of mediaTypes) {
    const entry = await resolveTmdbBackdropEntry(title, year, currentType, tmdbKey, cache, inFlight);
    if (entry?.status === "ok" && entry.backdropPath) {
      return {
        ...entry,
        mediaType: currentType,
      };
    }
  }

  return null;
}

function getBackdropLocalPaths(backdropPath, mediaType) {
  const cleanPath = String(backdropPath || "").replace(/^\/+/, "");
  if (!cleanPath) return null;

  const safeFileName = path.basename(cleanPath).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeFileName) return null;

  const safeMediaType = normalizeTmdbMediaTypeSafe(mediaType);
  const fsPath = path.join(LOG_BACKDROP_DIR, safeMediaType, safeFileName);
  const webPath = `/assets/img/tmdb-backdrops/${safeMediaType}/${safeFileName}`;
  return { fsPath, webPath };
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.writeFile(destinationPath, Buffer.from(bytes));
}

function getHeaderFallback(meta, slug) {
  const explicitImage = String(meta?.imgPrincipal || "").trim();
  const explicitCaption = String(meta?.imgPrincipalCaption || "").trim();
  if (explicitImage) {
    return {
      imgPrincipal: explicitImage,
      imgPrincipalCaption: explicitCaption,
      hasExplicitImage: true,
    };
  }
  return {
    imgPrincipal: resolveLogHeaderImage(slug),
    imgPrincipalCaption: explicitCaption,
    hasExplicitImage: false,
  };
}

function formatHeaderCaption(item) {
  const title = String(item?.name || "").trim();
  const year = String(item?.year || "").trim();
  if (!title) return "";
  return year ? `${title} (${year})` : title;
}

async function resolveDynamicHeaderForYear({
  slug,
  items,
  tmdbMediaType,
  fallbackHeader,
  tmdbKey,
  shouldSkipTmdbLookup,
  cache,
  inFlight,
}) {
  if (!LOG_DYNAMIC_HEADER_SLUGS.has(slug)) return fallbackHeader;
  if (fallbackHeader.hasExplicitImage) return fallbackHeader;
  if (!Array.isArray(items) || items.length === 0) return fallbackHeader;

  if (!tmdbKey || shouldSkipTmdbLookup) return fallbackHeader;

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const candidate = items[i];
    const title = String(candidate?.name || "").trim();
    const year = String(candidate?.year || "").trim();
    if (!title) continue;

    const caption = formatHeaderCaption(candidate);
    const entry = await resolveTmdbBackdropWithFallback(
      title,
      year,
      tmdbMediaType,
      tmdbKey,
      cache,
      inFlight,
    );

    if (!entry?.backdropPath) continue;

    const remoteUrl = `${TMDB_IMAGE_BASE}w1280${entry.backdropPath}`;
    const localPaths = getBackdropLocalPaths(entry.backdropPath, entry.mediaType);
    if (!localPaths) {
      return {
        imgPrincipal: remoteUrl,
        imgPrincipalCaption: caption,
      };
    }

    try {
      if (!fs.existsSync(localPaths.fsPath)) {
        await downloadFile(remoteUrl, localPaths.fsPath);
      }
      return {
        imgPrincipal: localPaths.webPath,
        imgPrincipalCaption: caption,
      };
    } catch (e) {
      console.error("[tmdb] erro ao baixar backdrop:", e.message);
      return {
        imgPrincipal: remoteUrl,
        imgPrincipalCaption: caption,
      };
    }
  }

  return fallbackHeader;
}

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

module.exports = (async () => {
  const tmdbKey = process.env.TMDB_API_KEY;
  const isServeMode = process.env.ELEVENTY_RUN_MODE === "serve";
  const tmdbDisabledInServe = process.env.ELEVENTY_DISABLE_TMDB_IN_SERVE === "1";
  const shouldSkipTmdbLookup = isServeMode && tmdbDisabledInServe;
  const tmdbBackdropCache = loadCache(TMDB_BACKDROP_CACHE_PATH);
  const tmdbBackdropInFlight = new Map();

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

    for (let index = 0; index < years.length; index += 1) {
      const year = years[index];
      const newestYear = years[0];
      const isNewestYear = year === newestYear;
      const newerYear = index > 0 ? years[index - 1] : null;
      const olderYear = index + 1 < years.length ? years[index + 1] : null;
      const yearItems = byYear.get(year) || [];

      const permalink = isNewestYear ? `/${slug}/` : `/${slug}/${year}/`;
      const newerUrl = newerYear ? (newerYear === newestYear ? `/${slug}/` : `/${slug}/${newerYear}/`) : null;
      const olderUrl = olderYear ? `/${slug}/${olderYear}/` : null;
      const fallbackHeader = getHeaderFallback(meta, slug);
      const dynamicHeader = await resolveDynamicHeaderForYear({
        slug,
        items: yearItems,
        tmdbMediaType: meta.tmdbMediaType,
        fallbackHeader,
        tmdbKey,
        shouldSkipTmdbLookup,
        cache: tmdbBackdropCache,
        inFlight: tmdbBackdropInFlight,
      });

      pages.push({
        slug,
        title: meta.title,
        subtitulo: meta.subtitulo,
        imgPrincipal: dynamicHeader.imgPrincipal || fallbackHeader.imgPrincipal,
        imgPrincipalCaption: dynamicHeader.imgPrincipalCaption || fallbackHeader.imgPrincipalCaption,
        posterProvider: meta.posterProvider,
        tmdbMediaType: meta.tmdbMediaType,
        noBacklinks: meta.noBacklinks,
        introMarkdown: meta.introMarkdown,
        year,
        years,
        items: yearItems,
        isNewestYear,
        permalink,
        newerYear,
        newerUrl,
        olderYear,
        olderUrl,
      });
    }
  }

  return pages;
})();

