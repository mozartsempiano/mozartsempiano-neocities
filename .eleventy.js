const configureMarkdown = require("./config/eleventy/markdown");
const configurePlugins = require("./config/eleventy/plugins");
const configureShortcodes = require("./config/eleventy/shortcodes");
const configureFilters = require("./config/eleventy/filters");
const configureCollections = require("./config/eleventy/collections");
const configureGlobalData = require("./config/eleventy/global-data");
const configurePassthrough = require("./config/eleventy/passthrough");
const configureDitherTransform = require("./config/eleventy/transforms/dither");

module.exports = function (eleventyConfig) {
	require("dotenv").config();

	configurePlugins(eleventyConfig);
	configureShortcodes(eleventyConfig);
	configureFilters(eleventyConfig);
	configureGlobalData(eleventyConfig);
	configureCollections(eleventyConfig);
	configurePassthrough(eleventyConfig);
	configureDitherTransform(eleventyConfig);

	const md = configureMarkdown();
	const renderMarkdown = (value) => md.render(String(value ?? ""));
	eleventyConfig.addFilter("renderMarkdown", renderMarkdown);
	eleventyConfig.addNunjucksFilter("renderMarkdown", renderMarkdown);
	eleventyConfig.setLibrary("md", md);

	return {
		dir: {
			input: "content",
			output: "_site",
			layouts: "../layouts",
			includes: "../includes",
			data: "../_data",
		},
		passthroughFileCopy: true,
		htmlTemplateEngine: "njk",
		markdownTemplateEngine: "njk",
	};
};
