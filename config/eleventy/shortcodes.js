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

function normalizeTmdbMediaType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["tv", "series", "show", "shows"].includes(normalized)) return "tv";
  return "movie";
}

function parseSeasonNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }

  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/\d+/);
  if (!match) return null;

  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeKey(title, year, mediaType = "movie") {
  const safeTitle = String(title || "").trim().toLowerCase();
  const safeYear = String(year || "").trim();
  const safeMediaType = normalizeTmdbMediaType(mediaType);
  return `${safeTitle}|${safeYear}|${safeMediaType}`;
}

function normalizeTmdbKey(title, year, mediaType = "movie", season = "") {
  const base = normalizeKey(title, year, mediaType);
  const safeMediaType = normalizeTmdbMediaType(mediaType);
  const seasonNumber = parseSeasonNumber(season);
  if (safeMediaType === "tv" && seasonNumber !== null) {
    return `${base}|season:${seasonNumber}`;
  }
  return base;
}

function normalizeLegacyTmdbKey(title, year) {
  const safeTitle = String(title || "").trim().toLowerCase();
  const safeYear = String(year || "").trim();
  return `${safeTitle}|${safeYear}`;
}

function normalizeOpenLibraryKey(title, year, fallbackTitle, author) {
  const base = normalizeKey(title, year);
  const fallback = String(fallbackTitle || "").trim().toLowerCase();
  const safeAuthor = String(author || "").trim().toLowerCase();
  return `${base}|${fallback}|${safeAuthor}`;
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

function enableHoverOriginalOnImgHtml(html) {
  const markup = String(html || "");
  if (!markup) return "";
  if (!/^<img\b/i.test(markup)) return markup;
  if (/\balt\s*=/i.test(markup)) {
    return markup.replace(/\balt\s*=\s*(['"])([^'"]*)\1/i, (full, quote, altValue) => {
      if (/\bhover-original\b/i.test(altValue)) return full;
      const nextAlt = altValue ? `${altValue} hover-original` : "hover-original";
      return `alt=${quote}${nextAlt}${quote}`;
    });
  }
  return markup.replace(/^<img\b/i, '<img alt="hover-original"');
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

function pickOpenLibraryDoc(docs, title, year, author) {
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  const yearNum = Number.parseInt(String(year || ""), 10);

  let best = null;
  let bestScore = -Infinity;

  for (const doc of docs || []) {
    if (!doc || !doc.cover_i) continue;

    let score = 0;
    const docTitle = normalizeText(doc.title || "");
    if (docTitle === normalizedTitle) score += 30;
    else if (docTitle.startsWith(normalizedTitle) || normalizedTitle.startsWith(docTitle)) score += 15;

    if (normalizedAuthor) {
      const authorNames = Array.isArray(doc.author_name) ? doc.author_name : [];
      const hasAuthorMatch = authorNames.some((name) => normalizeText(name) === normalizedAuthor);
      if (hasAuthorMatch) score += 20;
    }

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

  async function fetchTmdbPosterEntry(title, year, mediaType = "movie", season = "", useYearFilter = true) {
    const safeMediaType = normalizeTmdbMediaType(mediaType);
    const seasonNumber = parseSeasonNumber(season);
    const yearNum = Number.parseInt(String(year || ""), 10);
    const params = new URLSearchParams({
      api_key: tmdbKey,
      language: lang,
      query: String(title || "").trim(),
    });

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
    const result = data.results?.[0];

    if (!result) {
      return {
        status: "not_found",
        fetchedAt: new Date().toISOString(),
      };
    }

    let posterPath = result.poster_path || "";
    let resolvedSeasonNumber = null;

    if (safeMediaType === "tv" && seasonNumber !== null && result.id) {
      const seasonParams = new URLSearchParams({
        api_key: tmdbKey,
        language: lang,
      });
      const seasonUrl = `https://api.themoviedb.org/3/tv/${result.id}/season/${seasonNumber}?${seasonParams.toString()}`;
      const seasonRes = await fetch(seasonUrl);
      if (seasonRes.ok) {
        const seasonData = await seasonRes.json();
        if (seasonData?.poster_path) {
          posterPath = seasonData.poster_path;
          resolvedSeasonNumber = seasonNumber;
        }
      }
    }

    if (!posterPath) {
      return {
        status: "not_found",
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      status: "ok",
      posterPath,
      title: result.title || result.name || String(title || "").trim(),
      mediaType: safeMediaType,
      seasonNumber: resolvedSeasonNumber,
      fetchedAt: new Date().toISOString(),
    };
  }

  async function resolveTmdbPosterEntry(title, year, mediaType = "movie", season = "") {
    const safeMediaType = normalizeTmdbMediaType(mediaType);
    const yearNum = Number.parseInt(String(year || ""), 10);
    const hasYear = Number.isFinite(yearNum);
    const key = normalizeTmdbKey(title, year, safeMediaType, season);
    let cached = tmdbCache.items[key];

    // Backward compatibility for cache entries created before mediaType support.
    if (!cached && safeMediaType === "movie") {
      const legacyKey = normalizeLegacyTmdbKey(title, year);
      const legacyCached = tmdbCache.items[legacyKey];
      if (legacyCached) {
        cached = legacyCached;
        tmdbCache.items[key] = legacyCached;
        saveCache(TMDB_CACHE_PATH, tmdbCache);
      }
    }

    // If we previously cached TV+year as not_found, still allow one retry path without year filter.
    const shouldRetryTvWithoutYear =
      safeMediaType === "tv" &&
      hasYear &&
      cached?.status === "not_found";

    if (
      isEntryFresh(cached, TMDB_FORCE_REFRESH, TMDB_CACHE_DAYS, TMDB_NOT_FOUND_CACHE_DAYS) &&
      !shouldRetryTvWithoutYear
    ) {
      return cached;
    }

    if (tmdbInFlight.has(key)) return tmdbInFlight.get(key);

    const job = (async () => {
      try {
        let next = await fetchTmdbPosterEntry(title, year, safeMediaType, season, true);

        // "year" in series-log can be the season year. If search with first_air_date_year misses,
        // retry TV lookup without year filter.
        if (next?.status === "not_found" && safeMediaType === "tv" && hasYear) {
          next = await fetchTmdbPosterEntry(title, year, safeMediaType, season, false);
        }

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

  async function fetchOpenLibraryPosterEntry(title, year, useYear = true, author = "") {
    const params = new URLSearchParams({
      title: String(title || "").trim(),
      limit: "20",
    });

    const safeAuthor = String(author || "").trim();
    if (safeAuthor) {
      params.set("author", safeAuthor);
    }

    const yearNum = Number.parseInt(String(year || ""), 10);
    if (useYear && Number.isFinite(yearNum)) {
      params.set("first_publish_year", String(yearNum));
    }

    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OpenLibrary HTTP ${res.status}`);
    }

    const data = await res.json();
    const doc = pickOpenLibraryDoc(data.docs || [], title, year, author);

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

  async function resolveOpenLibraryPosterEntry(title, year, fallbackTitle, author) {
    const key = normalizeOpenLibraryKey(title, year, fallbackTitle, author);
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
        let next = await fetchOpenLibraryPosterEntry(title, year, true, author);

        // Fallback 1: same title, but without year filter.
        if (next?.status === "not_found") {
          next = await fetchOpenLibraryPosterEntry(title, year, false, author);
        }

        const safeFallbackTitle = String(fallbackTitle || "").trim();
        const safePrimaryTitle = String(title || "").trim();
        const shouldTryFallback =
          next?.status === "not_found" &&
          safeFallbackTitle.length > 0 &&
          safeFallbackTitle.toLowerCase() !== safePrimaryTitle.toLowerCase();

        if (shouldTryFallback) {
          // Fallback 2: ogName with year.
          next = await fetchOpenLibraryPosterEntry(safeFallbackTitle, year, true, author);

          // Fallback 3: ogName without year filter.
          if (next?.status === "not_found") {
            next = await fetchOpenLibraryPosterEntry(safeFallbackTitle, year, false, author);
          }
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

  async function renderTmdbPosterHtml(title, year, size = "w154", mediaType = "movie", season = "") {
    if (!tmdbKey || shouldSkipTmdbLookup) return "";

    const safeTitle = String(title || "").trim();
    const safeYear = String(year || "").trim();
    const safeMediaType = normalizeTmdbMediaType(mediaType);
    const safeSeasonNumber = parseSeasonNumber(season);
    if (!safeTitle) return "";

    const entry = await resolveTmdbPosterEntry(
      safeTitle,
      safeYear,
      safeMediaType,
      safeSeasonNumber === null ? "" : safeSeasonNumber,
    );
    if (!entry || entry.status !== "ok" || !entry.posterPath) return "";

    const posterUrl = `${TMDB_IMAGE_BASE}${size}${entry.posterPath}`;
    const seasonSuffix = entry.seasonNumber ? ` - Season ${entry.seasonNumber}` : "";
    const alt = safeYear
      ? `${entry.title || safeTitle}${seasonSuffix} (${safeYear})`
      : `${entry.title || safeTitle}${seasonSuffix}`;
    return `<img src="${escapeAttr(posterUrl)}" alt="${escapeAttr(alt)}">`;
  }

  async function renderOpenLibraryPosterHtml(title, year, fallbackTitle, author) {
    if (shouldSkipOpenLibraryLookup) return "";

    const safeTitle = String(title || "").trim();
    const safeYear = String(year || "").trim();
    const safeFallbackTitle = String(fallbackTitle || "").trim();
    if (!safeTitle) return "";

    const entry = await resolveOpenLibraryPosterEntry(safeTitle, safeYear, safeFallbackTitle, author);
    if (!entry || entry.status !== "ok" || !entry.coverId) return "";

    const posterUrl = `${OPENLIBRARY_COVERS_BASE}${entry.coverId}-M.jpg`;
    const alt = safeYear ? `${entry.title || safeTitle} (${safeYear})` : (entry.title || safeTitle);
    return `<img src="${escapeAttr(posterUrl)}" alt="${escapeAttr(alt)}">`;
  }

  eleventyConfig.addNunjucksAsyncShortcode("tmdbPoster", async (title, year, size = "w154", mediaType = "movie", season = "") => {
    return await renderTmdbPosterHtml(title, year, size, mediaType, season);
  });

  eleventyConfig.addNunjucksAsyncShortcode(
    "openLibraryPoster",
    async (title, year, ogName = "", author = "") => {
      return await renderOpenLibraryPosterHtml(title, year, ogName, author);
    },
  );

  eleventyConfig.addNunjucksAsyncShortcode(
    "logPoster",
    async (title, year, provider = "tmdb", ogName = "", author = "", tmdbMediaType = "movie", season = "") => {
    const normalizedProvider = normalizeProvider(provider);
    if (normalizedProvider === "tmdb") {
      const primaryMediaType = normalizeTmdbMediaType(tmdbMediaType);
      const primaryPoster = await renderTmdbPosterHtml(title, year, "w154", primaryMediaType, season);

      // For series logs, try TV first and fallback to movie only when TV has no match.
      if (!primaryPoster && primaryMediaType === "tv") {
        return enableHoverOriginalOnImgHtml(
          await renderTmdbPosterHtml(title, year, "w154", "movie"),
        );
      }
      return enableHoverOriginalOnImgHtml(primaryPoster);
    }
    if (normalizedProvider === "openlibrary") {
      return enableHoverOriginalOnImgHtml(
        await renderOpenLibraryPosterHtml(title, year, ogName, author),
      );
    }
    return "";
    },
  );
};
