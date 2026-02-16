const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

function addWikiLinks(md) {
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
}

function slugify(s) {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

function addTmdbInlineRule(md) {
	md.inline.ruler.after("image", "tmdbPoster", function (state, silent) {
		const regex = /^!TMDB\[(.+?)\|(\d{4})\]/;
		const pos = state.pos;
		const src = state.src.slice(pos);
		const match = regex.exec(src);
		if (!match) return false;
		if (!silent) {
			const token = state.push("html_inline", "", 0);
			token.content = `{% tmdbPoster "${match[1].trim()}", ${match[2].trim()} %}`;
		}
		state.pos += match[0].length;
		return true;
	});
}

function addImageFigure(md) {
	const defaultImage =
		md.renderer.rules.image ||
		function (tokens, idx, options, env, self) {
			return self.renderToken(tokens, idx, options);
		};
	md.renderer.rules.image = function (tokens, idx, options, env, self) {
		const token = tokens[idx];
		const title = token.attrGet && token.attrGet("title");
		const imgHtml = defaultImage(tokens, idx, options, env, self);
		return title
			? `<figure>${imgHtml}<figcaption>${md.utils.escapeHtml(title)}</figcaption></figure>`
			: `<figure>${imgHtml}</figure>`;
	};
}

function unwrapImageParagraphs(md) {
	const originalParagraphOpen =
		md.renderer.rules.paragraph_open ||
		function (tokens, idx, options, env, self) {
			return self.renderToken(tokens, idx, options);
		};
	const originalParagraphClose =
		md.renderer.rules.paragraph_close ||
		function (tokens, idx, options, env, self) {
			return self.renderToken(tokens, idx, options);
		};

	md.renderer.rules.paragraph_open = function (tokens, idx, options, env, self) {
		const nextToken = tokens[idx + 1];
		if (
			nextToken &&
			nextToken.type === "inline" &&
			nextToken.children?.length === 1 &&
			nextToken.children[0].type === "image"
		)
			return "";
		return originalParagraphOpen(tokens, idx, options, env, self);
	};
	md.renderer.rules.paragraph_close = function (tokens, idx, options, env, self) {
		const prevToken = tokens[idx - 1];
		if (
			prevToken &&
			prevToken.type === "inline" &&
			prevToken.children?.length === 1 &&
			prevToken.children[0].type === "image"
		)
			return "";
		return originalParagraphClose(tokens, idx, options, env, self);
	};
}

module.exports = function configureMarkdown() {
	const md = markdownIt({ html: true, linkify: true })
		.use(require("markdown-it-footnote"))
		.use(require("markdown-it-attrs"))
		.use(addWikiLinks)
		.use(markdownItAnchor, {
			level: [2, 3, 4],
			slugify,
		});

	addTmdbInlineRule(md);
	addImageFigure(md);
	unwrapImageParagraphs(md);

	return md;
};
