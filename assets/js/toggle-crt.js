export function toggleCrt() {
  function injectCrtStyles() {
    // Check if styles are already injected
    if (document.getElementById("crt-styles")) return;

    const style = document.createElement("style");
    style.id = "crt-styles";
    style.textContent = `
      body.crt::before {
        content: " ";
        display: block;
        position: fixed;
        inset: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
          linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        background-size: 100% 2px, 3px 100%;
        z-index: 99999;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    // Inject CRT styles
    injectCrtStyles();

    // Aplica estado inicial do localStorage
    const switchLigado = localStorage.getItem("switchCRT") === "true";
    if (switchLigado) {
      document.body.classList.add("crt");
    }

    // função pública para o painel
    window.toggleCRTState = (ligado) => {
      if (ligado) {
        document.body.classList.add("crt");
      } else {
        document.body.classList.remove("crt");
      }
      localStorage.setItem("switchCRT", ligado);
    };
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
