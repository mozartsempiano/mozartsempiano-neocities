(function () {
  const preloader = document.createElement("div");
  preloader.id = "custom-preloader";
  preloader.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(preloader);

  const style = document.createElement("style");
  style.innerHTML = `
    #custom-preloader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--clr-black-a0);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    #custom-preloader .spinner {
        width: 28px;
        height: 28px;
        background-color: var(--clr-white);
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='20' r='20'/%3E%3Ccircle cx='170' cy='60' r='20'/%3E%3Ccircle cx='170' cy='140' r='20'/%3E%3Ccircle cx='100' cy='180' r='20'/%3E%3Ccircle cx='30' cy='140' r='20'/%3E%3Ccircle cx='30' cy='60' r='20'/%3E%3C/svg%3E") no-repeat center / contain;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='20' r='20'/%3E%3Ccircle cx='170' cy='60' r='20'/%3E%3Ccircle cx='170' cy='140' r='20'/%3E%3Ccircle cx='100' cy='180' r='20'/%3E%3Ccircle cx='30' cy='140' r='20'/%3E%3Ccircle cx='30' cy='60' r='20'/%3E%3C/svg%3E") no-repeat center / contain;
        animation: spin 2s linear infinite;
        transform-origin: 50% 50%;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  window.addEventListener("load", function () {
    preloader.style.opacity = "0";
    preloader.style.transition = "opacity var(--transition-time) ease";
    preloader.style.transitionDelay = "0.4s";
    setTimeout(() => {
      if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      if (style.parentNode) style.parentNode.removeChild(style);
    }, 500);
  });
})();
