//style-my-tootltips by malihu (http://manos.malihu.gr)
//plugin home http://manos.malihu.gr/style-my-tooltips-jquery-plugin
// tooltip.js
export function enableTooltips({
	tipFollowsCursor = true,
	tipDelay = 0,
	tipFadeSpeed = 0,
	attribute = "title",
} = {}) {
	let tooltip = document.getElementById("s-m-t-tooltip");
	if (!tooltip) {
		tooltip = document.createElement("div");
		tooltip.id = "s-m-t-tooltip";
		const inner = document.createElement("div");
		tooltip.appendChild(inner);
		Object.assign(tooltip.style, {
			position: "absolute",
			display: "none",
			pointerEvents: "none",
			zIndex: 9999,
		});
		document.body.appendChild(tooltip);
	}
	const innerDiv = tooltip.querySelector("div");

	let tooltipTimeout;
	let currentElement = null;

	function showTooltip(el) {
		const title = el.dataset.smtTitle;
		innerDiv.textContent = title;
		tooltip.style.opacity = "0";
		tooltip.style.display = "block";
		if (tipFadeSpeed) {
			tooltip.style.transition = `opacity ${tipFadeSpeed}ms`;
			requestAnimationFrame(() => (tooltip.style.opacity = "1"));
		} else {
			tooltip.style.opacity = "1";
		}
	}

	function hideTooltip() {
		if (!tooltip) return;
		if (tipFadeSpeed) {
			tooltip.style.opacity = "0";
			setTimeout(() => {
				tooltip.style.display = "none";
			}, tipFadeSpeed);
		} else {
			tooltip.style.display = "none";
		}
	}

	function updateTooltipPosition(event) {
		if (!currentElement) return;
		const tooltipRect = tooltip.getBoundingClientRect();
		let left = event.pageX + (tipFollowsCursor ? 10 : 0);
		let top = event.pageY + (tipFollowsCursor ? 10 : 0);

		if (left + tooltipRect.width > window.scrollX + window.innerWidth) {
			left = event.pageX - tooltipRect.width - 10;
		}
		if (top + tooltipRect.height > window.scrollY + window.innerHeight) {
			top = event.pageY - tooltipRect.height - 10;
		}

		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	}

	// aplica tooltip a todos os elementos com o atributo
	document.querySelectorAll(`[${attribute}]`).forEach((el) => {
		const title = el.getAttribute(attribute);
		if (!title) return;

		el.dataset.smtTitle = title;
		el.removeAttribute(attribute);

		el.addEventListener("mouseenter", () => {
			currentElement = el;
			tooltipTimeout = setTimeout(() => showTooltip(el), tipDelay);
			if (tipFollowsCursor) {
				document.addEventListener("mousemove", updateTooltipPosition);
			}
		});

		el.addEventListener("mouseleave", () => {
			clearTimeout(tooltipTimeout);
			hideTooltip();
			currentElement = null;
			if (tipFollowsCursor) {
				document.removeEventListener("mousemove", updateTooltipPosition);
			}
		});
	});
}

// inicialização automática
document.addEventListener("DOMContentLoaded", () => {
	enableTooltips({
		tipFollowsCursor: true,
		tipDelay: 0,
		tipFadeSpeed: 0,
		attribute: "title",
	});
});
