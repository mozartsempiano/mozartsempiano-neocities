module.exports = {
	permalink: "/{{ page.fileSlug }}/",

	eleventyComputed: {
		backlinks: (data) => {
			const currentUrl = data.page.url;
			const pages = data.collections.all;

			if (!pages) return [];

			const backlinks = [];

			for (const page of pages) {
				if (page.url === currentUrl) continue;

				const content = page.template?.frontMatter?.content;
				if (!content) continue;

				if (content.includes(currentUrl)) {
					backlinks.push({
						url: page.url,
						title: page.data.title || page.fileSlug,
						preview: extractPreview(content, currentUrl),
					});
				}
			}

			return backlinks;
		},
	},
};

function extractPreview(content, url) {
	const index = content.indexOf(url);
	if (index === -1) return "";

	const start = Math.max(0, index - 120);
	const end = Math.min(content.length, index + 120);

	return content.slice(start, end).trim();
}
