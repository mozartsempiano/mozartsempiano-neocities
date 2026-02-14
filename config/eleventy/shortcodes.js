const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = function configureShortcodes(eleventyConfig) {
	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	const tmdbKey = process.env.TMDB_API_KEY;
	const lang = "en";

	eleventyConfig.addNunjucksAsyncShortcode(
		"tmdbPoster",
		async (title, year, size = "w154") => {
			if (!tmdbKey) return "";

			const query = encodeURIComponent(title);
			const url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&language=${lang}&query=${query}&year=${year}`;

			try {
				const res = await fetch(url, { duration: "1d", type: "json" });
				const data = await res.json();
				const movie = data.results?.[0];

				if (!movie || !movie.poster_path) return "";

				return `<img src="https://image.tmdb.org/t/p/${size}${movie.poster_path}" alt="${movie.title} (${year})">`;
			} catch (e) {
				console.error("Erro ao buscar poster TMDB:", e);
				return "";
			}
		},
	);
};
