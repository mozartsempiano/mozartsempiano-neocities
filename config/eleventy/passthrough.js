module.exports = function configurePassthrough(eleventyConfig) {
	// Copy all assets so CSS background-image URLs keep working with original files.
	eleventyConfig.addPassthroughCopy("assets");
};
