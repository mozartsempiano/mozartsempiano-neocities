export function typeDreamText(element, html, speed = 35) {
	let i = 0;
	let tag = "";
	let writingTag = false;
	let tempTag = "";
	let out = "";

	function type() {
		if (i < html.length) {
			const char = html[i];
			if (char === "<") {
				writingTag = true;
				tempTag = "";
			}
			if (writingTag) {
				tempTag += char;
				if (char === ">") {
					writingTag = false;
					out += tempTag;
					element.innerHTML = out;
				}
			} else {
				out += char;
				element.innerHTML = out;
			}
			i++;
			setTimeout(type, writingTag ? 0 : speed);
		} else {
			element.innerHTML = html;
		}
	}
	element.innerHTML = "";
	element.innerHTML = "";
	type();
}

export default typeDreamText;
