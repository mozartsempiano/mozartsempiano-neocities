module.exports = function configureGlobalData(eleventyConfig) {
	eleventyConfig.addGlobalData("eleventyComputed", {
		permalink: (data) => {
			const stem = data.page?.filePathStem;
			if (!stem) return;

			if (stem.startsWith("/content/")) {
				return stem.slice("/content".length) + "/";
			}
		},
	});
};
