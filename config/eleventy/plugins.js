const sitemap = require("@quasibit/eleventy-plugin-sitemap");
const tinyCSS = require("@sardine/eleventy-plugin-tinycss");
const tinyHTML = require("@sardine/eleventy-plugin-tinyhtml");
const embedEverything = require("eleventy-plugin-embed-everything");
const EleventyPluginRobotsTxt = require("eleventy-plugin-robotstxt");

/** @type {import("eleventy-plugin-robotstxt/typedefs.js").EleventyPluginRobotsTxtOptions} */
const eleventyPluginRobotsTxtOptions = {
  // sitemapURL: "https://mozartsempiano.com/sitemap.xml",
  shouldBlockAIRobots: true,
  rules: new Map([["*", [{ disallow: "/sonhos/" }, { disallow: "/junk/" }]]]),
};

module.exports = function configurePlugins(eleventyConfig) {
  // const tinyOptions = {
  // 	purgeCSS: {
  // 		fontFace: true,
  // 		keyframes: true,
  // 		variables: true,
  // 	},
  // };
  // eleventyConfig.addPlugin(tinyCSS, tinyOptions);

  // const tinyHTMLOptions = {
  // 	html5: true,
  // 	removeRedundantAttributes: true,
  // 	collapseBooleanAttributes: true,
  // 	collapseWhitespace: true,
  // 	decodeEntities: true,
  // 	html5: true,
  // 	removeAttributeQuotes: true,
  // 	removeComments: true,
  // 	removeOptionalTags: true,
  // 	sortAttributes: true,
  // 	sortClassName: true,
  // };
  // eleventyConfig.addPlugin(tinyHTML, tinyHTMLOptions);

  eleventyConfig.addPlugin(embedEverything);

  eleventyConfig.addPlugin(EleventyPluginRobotsTxt, eleventyPluginRobotsTxtOptions);

  eleventyConfig.addPlugin(sitemap, {
    sitemap: { hostname: "https://mozartsempiano.com" },
  });
};
