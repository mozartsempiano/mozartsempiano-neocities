(function () {
  function bindImage(img) {
    if (img.dataset.hoverWrapped === "true") return;
    const ditherSrc = img.dataset.ditherSrc;
    const originalSrc = img.dataset.originalSrc;
    if (!ditherSrc || !originalSrc) return;

    const wrapper = document.createElement("span");
    wrapper.className = "dither-hover-wrap";
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    img.classList.add("dither-hover-base");
    img.dataset.hoverWrapped = "true";
    if (!img.getAttribute("src")) img.setAttribute("src", ditherSrc);

    const overlay = document.createElement("img");
    overlay.className = "dither-hover-original";
    overlay.src = originalSrc;
    overlay.alt = "";
    overlay.setAttribute("aria-hidden", "true");
    // overlay.loading = "eager";
    overlay.loading = "lazy";
    overlay.fetchPriority = "low";
    overlay.decoding = "async";

    wrapper.appendChild(overlay);
  }

  document.querySelectorAll("img[data-hover-original='true'][data-dither-src][data-original-src]").forEach(bindImage);
})();
