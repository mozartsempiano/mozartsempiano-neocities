module.exports = function configurePassthrough(eleventyConfig) {
	eleventyConfig.addPassthroughCopy("assets", {
		// Copy all assets, but skip original JPG/JPEG/PNG in assets/img (keep dither outputs and other formats).
		filter: [
			"**/*",
			"!img/**/*.jpg",
			"!img/**/*.jpeg",
			"!img/**/*.png",
			"img/dither/**/*",
		],
	});
};
