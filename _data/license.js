const fs = require("fs");
const path = require("path");

module.exports = (() => {
	try {
		const filePath = path.join(process.cwd(), "LICENSE");
		return fs.readFileSync(filePath, "utf8");
	} catch {
		return "";
	}
})();
