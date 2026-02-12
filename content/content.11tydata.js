module.exports = {
	eleventyComputed: {
		permalink: (data) => `/${data.page.fileSlug}/`,

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
