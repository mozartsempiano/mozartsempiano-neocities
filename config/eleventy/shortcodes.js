const fs = require("fs");
const path = require("path");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const TMDB_CACHE_PATH = path.join(process.cwd(), ".cache", "tmdb-posters.json");

const OPENLIBRARY_COVERS_BASE = "https://covers.openlibrary.org/b/id/";
const OPENLIBRARY_CACHE_PATH = path.join(process.cwd(), ".cache", "openlibrary-posters.json");

const CACHE_VERSION = 1;

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TMDB_CACHE_DAYS = toPositiveNumber(process.env.TMDB_CACHE_DAYS, 30);
const TMDB_NOT_FOUND_CACHE_DAYS = toPositiveNumber(process.env.TMDB_NOT_FOUND_CACHE_DAYS, 7);
const TMDB_FORCE_REFRESH = process.env.TMDB_FORCE_REFRESH === "1";

const OPENLIBRARY_CACHE_DAYS = toPositiveNumber(process.env.OPENLIBRARY_CACHE_DAYS, 30);
const OPENLIBRARY_NOT_FOUND_CACHE_DAYS = toPositiveNumber(process.env.OPENLIBRARY_NOT_FOUND_CACHE_DAYS, 7);
const OPENLIBRARY_FORCE_REFRESH = process.env.OPENLIBRARY_FORCE_REFRESH === "1";

function normalizeKey(title, year) {
  const safeTitle = String(title || "").trim().toLowerCase();
  const safeYear = String(year || "").trim();
  return `${safeTitle}|${safeYear}`;
}

function normalizeOpenLibraryKey(title, year, fallbackTitle) {
  const base = normalizeKey(title, year);
  const fallback = String(fallbackTitle || "").trim().toLowerCase();
  return `${base}|${fallback}`;
}

function normalizeProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!normalized) return "none";
  if (["tmdb", "openlibrary", "none"].includes(normalized)) return normalized;
  if (["open-library", "open_library", "ol"].includes(normalized)) return "openlibrary";
  return "none";
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadCache(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      return { version: CACHE_VERSION, items: {} };
    }
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: CACHE_VERSION, items: {} };
    }
    const items = parsed.items && typeof parsed.items === "object" ? parsed.items : {};
    return { version: CACHE_VERSION, items };
  } catch {
    return { version: CACHE_VERSION, items: {} };
  }
}

function saveCache(cachePath, cache) {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          version: CACHE_VERSION,
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

function normalizeText(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickOpenLibraryDoc(docs, title, year) {
  const normalizedTitle = normalizeText(title);
  const yearNum = Number.parseInt(String(year || ""), 10);

  let best = null;
  let bestScore = -Infinity;

  for (const doc of docs || []) {
    if (!doc || !doc.cover_i) continue;

    let score = 0;
    const docTitle = normalizeText(doc.title || "");
    if (docTitle === normalizedTitle) score += 30;
    else if (docTitle.startsWith(normalizedTitle) || normalizedTitle.startsWith(docTitle)) score += 15;

    if (Number.isFinite(yearNum) && Number.isFinite(doc.first_publish_year)) {
      const diff = Math.abs(doc.first_publish_year - yearNum);
      if (diff === 0) score += 20;
      else if (diff <= 1) score += 10;
      else if (diff <= 3) score += 5;
    }

    if (score > bestScore) {
      best = doc;
      bestScore = score;
    }
  }

  return best;
}

module.exports = function configureShortcodes(eleventyConfig) {
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  const tmdbKey = process.env.TMDB_API_KEY;
  const lang = "en";
  const isServeMode = process.env.ELEVENTY_RUN_MODE === "serve";

  const tmdbDisabledInServe = process.env.ELEVENTY_DISABLE_TMDB_IN_SERVE === "1";
  const shouldSkipTmdbLookup = isServeMode && tmdbDisabledInServe;

  const openLibraryDisabledInServe = process.env.ELEVENTY_DISABLE_OPENLIBRARY_IN_SERVE === "1";
  const shouldSkipOpenLibraryLookup = isServeMode && openLibraryDisabledInServe;

  const tmdbCache = loadCache(TMDB_CACHE_PATH);
  const openLibraryCache = loadCache(OPENLIBRARY_CACHE_PATH);
  const tmdbInFlight = new Map();
  const openLibraryInFlight = new Map();

  async function fetchTmdbPosterEntry(title, year) {
    const query = encodeURIComponent(title);
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&language=${lang}&query=${query}&year=${year}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`TMDB HTTP ${res.status}`);
    }
    const data = await res.json();
    const movie = data.results?.[0];

    if (!movie || !movie.poster_path) {
      return {
        status: "not_found",
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      status: "ok",
      posterPath: movie.poster_path,
      title: movie.title || String(title || "").trim(),
      fetchedAt: new Date().toISOString(),
    };
  }

  async function resolveTmdbPosterEntry(title, year) {
    const key = normalizeKey(title, year);
    const cached = tmdbCache.items[key];

    if (isEntryFresh(cached, TMDB_FORCE_REFRESH, TMDB_CACHE_DAYS, TMDB_NOT_FOUND_CACHE_DAYS)) {
      return cached;
    }

    if (tmdbInFlight.has(key)) return tmdbInFlight.get(key);

    const job = (async () => {
      try {
        const next = await fetchTmdbPosterEntry(title, year);
        tmdbCache.items[key] = next;
        saveCache(TMDB_CACHE_PATH, tmdbCache);
        return next;
      } catch (e) {
        if (cached) return cached;
        console.error("[tmdb] erro ao atualizar poster:", e.message);
        return null;
      } finally {
        tmdbInFlight.delete(key);
      }
    })();

    tmdbInFlight.set(key, job);
    return job;
  }

  async function fetchOpenLibraryPosterEntry(title, year) {
    const params = new URLSearchParams({
      title: String(title || "").trim(),
      limit: "20",
    });

    const yearNum = Number.parseInt(String(year || ""), 10);
    if (Number.isFinite(yearNum)) {
      params.set("first_publish_year", String(yearNum));
    }

    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OpenLibrary HTTP ${res.status}`);
    }

    const data = await res.json();
    const doc = pickOpenLibraryDoc(data.docs || [], title, year);

    if (!doc || !doc.cover_i) {
      return {
        status: "not_found",
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      status: "ok",
      coverId: doc.cover_i,
      title: doc.title || String(title || "").trim(),
      fetchedAt: new Date().toISOString(),
    };
  }

  async function resolveOpenLibraryPosterEntry(title, year, fallbackTitle) {
    const key = normalizeOpenLibraryKey(title, year, fallbackTitle);
    const cached = openLibraryCache.items[key];

    if (
      isEntryFresh(
        cached,
        OPENLIBRARY_FORCE_REFRESH,
        OPENLIBRARY_CACHE_DAYS,
        OPENLIBRARY_NOT_FOUND_CACHE_DAYS,
      )
    ) {
      return cached;
    }

    if (openLibraryInFlight.has(key)) return openLibraryInFlight.get(key);

    const job = (async () => {
      try {
        let next = await fetchOpenLibraryPosterEntry(title, year);
        const safeFallbackTitle = String(fallbackTitle || "").trim();
        const safePrimaryTitle = String(title || "").trim();
        const shouldTryFallback =
          next?.status === "not_found" &&
          safeFallbackTitle.length > 0 &&
          safeFallbackTitle.toLowerCase() !== safePrimaryTitle.toLowerCase();

        if (shouldTryFallback) {
          next = await fetchOpenLibraryPosterEntry(safeFallbackTitle, year);
        }

        openLibraryCache.items[key] = next;
        saveCache(OPENLIBRARY_CACHE_PATH, openLibraryCache);
        return next;
      } catch (e) {
        if (cached) return cached;
        console.error("[openlibrary] erro ao atualizar cover:", e.message);
        return null;
      } finally {
        openLibraryInFlight.delete(key);
      }
    })();

    openLibraryInFlight.set(key, job);
    return job;
  }

  async function renderTmdbPosterHtml(title, year, size = "w154") {
    if (!tmdbKey || shouldSkipTmdbLookup) return "";

    const safeTitle = String(title || "").trim();
    const safeYear = String(year || "").trim();
    if (!safeTitle) return "";

    const entry = await resolveTmdbPosterEntry(safeTitle, safeYear);
    if (!entry || entry.status !== "ok" || !entry.posterPath) return "";

    const posterUrl = `${TMDB_IMAGE_BASE}${size}${entry.posterPath}`;
    const alt = safeYear ? `${entry.title || safeTitle} (${safeYear})` : (entry.title || safeTitle);
    return `<img src="${escapeAttr(posterUrl)}" alt="${escapeAttr(alt)}">`;
  }

  async function renderOpenLibraryPosterHtml(title, year, fallbackTitle) {
    if (shouldSkipOpenLibraryLookup) return "";

    const safeTitle = String(title || "").trim();
    const safeYear = String(year || "").trim();
    const safeFallbackTitle = String(fallbackTitle || "").trim();
    if (!safeTitle) return "";

    const entry = await resolveOpenLibraryPosterEntry(safeTitle, safeYear, safeFallbackTitle);
    if (!entry || entry.status !== "ok" || !entry.coverId) return "";

    const posterUrl = `${OPENLIBRARY_COVERS_BASE}${entry.coverId}-M.jpg`;
    const alt = safeYear ? `${entry.title || safeTitle} (${safeYear})` : (entry.title || safeTitle);
    return `<img src="${escapeAttr(posterUrl)}" alt="${escapeAttr(alt)}">`;
  }

  eleventyConfig.addNunjucksAsyncShortcode("tmdbPoster", async (title, year, size = "w154") => {
    return await renderTmdbPosterHtml(title, year, size);
  });

  eleventyConfig.addNunjucksAsyncShortcode("openLibraryPoster", async (title, year, ogName = "") => {
    return await renderOpenLibraryPosterHtml(title, year, ogName);
  });

  eleventyConfig.addNunjucksAsyncShortcode(
    "logPoster",
    async (title, year, provider = "tmdb", ogName = "") => {
    const normalizedProvider = normalizeProvider(provider);
    if (normalizedProvider === "tmdb") {
      return await renderTmdbPosterHtml(title, year, "w154");
    }
    if (normalizedProvider === "openlibrary") {
      return await renderOpenLibraryPosterHtml(title, year, ogName);
    }
    return "";
    },
  );
};
