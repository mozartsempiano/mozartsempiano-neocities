const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function parseSimpleFrontMatter(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kv = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return data;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstMediaSrc(item) {
  if (!item || typeof item !== "object") return "";
  // possíveis campos: medias, media, images, arquivos
  const candidates = item.medias || item.media || item.images || item.arquivos || [];
  if (Array.isArray(candidates) && candidates.length) {
    const m = candidates[0];
    if (!m) return "";
    return String(m.src || m.url || m.path || "");
  }
  // às vezes o próprio item é uma string com path
  if (typeof item === "string") return item;
  return "";
}

function stableHash(str) {
  return crypto.createHash("sha1").update(String(str)).digest("hex").slice(0, 8);
}

function slugFromItem(item, index) {
  // 1) pelo título
  const byTitle = slugify(item?.titulo);
  if (byTitle) return byTitle;

  // 2) pelo nome do arquivo da primeira mídia (sem extensão)
  const src = firstMediaSrc(item);
  if (src) {
    const fileName = src.split(/[?#]/)[0].split("/").pop() || "";
    const base = fileName.replace(/\.[a-z0-9]+$/i, "");
    const byFileName = slugify(base);
    if (byFileName) return byFileName;
  }

  // 3) fallback razoável: hash curto do primeiro src ou do conteúdo
  const seed = src || JSON.stringify(item) || String(index);
  return `item-${stableHash(seed)}`;
}

function resolveDataFile(dataset) {
  const root = path.join(process.cwd(), "_data");
  for (const ext of [".json", ".js"]) {
    const filePath = path.join(root, `${dataset}${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function getGalleryDefinitions() {
  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(contentDir)) return [];
  const files = fs.readdirSync(contentDir).filter((name) => /\.(md|njk)$/i.test(name));
  const defs = [];
  for (const fileName of files) {
    const fullPath = path.join(contentDir, fileName);
    const fm = parseSimpleFrontMatter(fullPath);
    if (fm.layout !== "galeria" || !fm.dataset) continue;
    const slug = fileName.replace(/\.(md|njk)$/i, "");
    defs.push({
      datasetKey: slug,
      datasetSource: fm.dataset || slug,
      galleryTitle: fm.title || fm.dataset || slug,
      galleryUrl: `/${slug}/`,
    });
  }
  return defs;
}

function loadDataset(dataset) {
  const dataFile = resolveDataFile(dataset);
  if (!dataFile) return [];
  // garantir que sempre recarregue (útil no watch/serve)
  try {
    delete require.cache[require.resolve(dataFile)];
  } catch (e) {}
  const loaded = require(dataFile);
  return Array.isArray(loaded) ? loaded : [];
}

function buildGaleriaCatalog() {
  const defs = getGalleryDefinitions();
  const items = [];
  const urlsByDataset = {};

  for (const def of defs) {
    const rows = loadDataset(def.datasetSource);
    const usedSlugs = new Map();
    urlsByDataset[def.datasetKey] = [];

    rows.forEach((item, index) => {
      const src = firstMediaSrc(item);
      if (!item?.titulo && !src) {
        console.warn(`[galeria] item sem título e sem mídia: dataset=${def.datasetSource} index=${index}`, item);
      }

      let slug = slugFromItem(item, index);
      const seen = usedSlugs.get(slug) || 0;
      usedSlugs.set(slug, seen + 1);
      if (seen > 0) slug = `${slug}-${seen + 1}`;

      const url = `/${def.galleryUrl.replace(/^\/|\/$/g, "")}/${slug}/`;
      urlsByDataset[def.datasetKey][index] = url;

      items.push({
        dataset: def.datasetKey,
        galleryTitle: def.galleryTitle,
        galleryUrl: def.galleryUrl,
        index,
        slug,
        url,
        title: item?.titulo || `Item ${index + 1}`,
        item,
      });
    });
  }

  return { items, urlsByDataset };
}

module.exports = {
  buildGaleriaCatalog,
};
