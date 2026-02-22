const fs = require("fs");
const path = require("path");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const TMDB_CACHE_PATH = path.join(process.cwd(), ".cache", "tmdb-posters.json");
const CACHE_VERSION = 1;

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CACHE_DAYS = toPositiveNumber(process.env.TMDB_CACHE_DAYS, 30);
const NOT_FOUND_CACHE_DAYS = toPositiveNumber(process.env.TMDB_NOT_FOUND_CACHE_DAYS, 7);
const FORCE_REFRESH = process.env.TMDB_FORCE_REFRESH === "1";

function normalizeKey(title, year) {
  const safeTitle = String(title || "").trim().toLowerCase();
  const safeYear = String(year || "").trim();
  return `${safeTitle}|${safeYear}`;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadTmdbCache() {
  try {
    if (!fs.existsSync(TMDB_CACHE_PATH)) {
      return { version: CACHE_VERSION, items: {} };
    }
    const raw = fs.readFileSync(TMDB_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: CACHE_VERSION, items: {} };
    }
    const items = parsed.items && typeof parsed.items === "object" ? parsed.items : {};
    return { version: CACHE_VERSION, items };
  } catch (e) {
    console.warn("[tmdb] falha ao ler cache local, recriando cache:", e.message);
    return { version: CACHE_VERSION, items: {} };
  }
}

function saveTmdbCache(cache) {
  try {
    fs.mkdirSync(path.dirname(TMDB_CACHE_PATH), { recursive: true });
    fs.writeFileSync(
      TMDB_CACHE_PATH,
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
  } catch (e) {
    console.warn("[tmdb] falha ao salvar cache local:", e.message);
  }
}

function isEntryFresh(entry) {
  if (!entry || FORCE_REFRESH) return false;
  const fetchedAt = Date.parse(entry.fetchedAt || "");
  if (!Number.isFinite(fetchedAt)) return false;
  const ageMs = Date.now() - fetchedAt;
  const maxAgeDays = entry.status === "not_found" ? NOT_FOUND_CACHE_DAYS : CACHE_DAYS;
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

module.exports = function configureShortcodes(eleventyConfig) {
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  const tmdbKey = process.env.TMDB_API_KEY;
  const lang = "en";
  const isServeMode = process.env.ELEVENTY_RUN_MODE === "serve";
  const tmdbDisabledInServe = process.env.ELEVENTY_DISABLE_TMDB_IN_SERVE === "1";
  const shouldSkipTmdbLookup = isServeMode && tmdbDisabledInServe;

  const tmdbCache = loadTmdbCache();
  const inFlight = new Map();

  async function fetchPosterEntry(title, year) {
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
      movieTitle: movie.title || String(title || "").trim(),
      fetchedAt: new Date().toISOString(),
    };
  }

  async function resolvePosterEntry(title, year) {
    const key = normalizeKey(title, year);
    const cached = tmdbCache.items[key];
    if (isEntryFresh(cached)) {
      return cached;
    }

    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const job = (async () => {
      try {
        const next = await fetchPosterEntry(title, year);
        tmdbCache.items[key] = next;
        saveTmdbCache(tmdbCache);
        return next;
      } catch (e) {
        // Mantem cache antigo se a API falhar temporariamente.
        if (cached) return cached;
        console.error("[tmdb] erro ao atualizar poster:", e.message);
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, job);
    return job;
  }

  eleventyConfig.addNunjucksAsyncShortcode("tmdbPoster", async (title, year, size = "w154") => {
    if (!tmdbKey || shouldSkipTmdbLookup) return "";
    const safeTitle = String(title || "").trim();
    const safeYear = String(year || "").trim();
    if (!safeTitle) return "";

    const entry = await resolvePosterEntry(safeTitle, safeYear);
    if (!entry || entry.status !== "ok" || !entry.posterPath) {
      return "";
    }

    const posterUrl = `${TMDB_IMAGE_BASE}${size}${entry.posterPath}`;
    const alt = safeYear ? `${entry.movieTitle || safeTitle} (${safeYear})` : (entry.movieTitle || safeTitle);
    return `<img src="${escapeAttr(posterUrl)}" alt="${escapeAttr(alt)}">`;
  });
};
