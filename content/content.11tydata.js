module.exports = {
	eleventyComputed: {
		permalink: (data) => {
			if (data.page?.fileSlug === "galeria-item" && data.galeriaEntry?.url) {
				return data.galeriaEntry.url;
			}
			return `/${data.page.fileSlug}/`;
		},

		dataset: (data) => {
			return data[data.page.fileSlug] || null;
		},

		items: (data) => {
			const ds = data[data.page.fileSlug];
			if (!ds) return [];
			return Array.isArray(ds) ? ds : ds.items || [];
		},
	},
};
