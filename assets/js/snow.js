export function snowEffect() {
  // injeta CSS mínimo (sem animação CSS)
  const style = document.createElement("style");
  style.id = "snow-style";
  style.textContent = `
    .snow { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 998; }
    .snow span { position: absolute; top: 0; left: 0; background: white; border-radius: 50%; will-change: transform, opacity; pointer-events: none; display: block; box-shadow: 1px 1px 2px rgba(0,0,0,0.55); }
  `;
  document.head.appendChild(style);

  // container
  const snowContainer = document.createElement("div");
  snowContainer.className = "snow";
  document.body.appendChild(snowContainer);

  // VALORES AMENOSADOS
  const TOTAL = 50;
  const MIN_SIZE = 2;
  const MAX_SIZE = 8;
  const MIN_OPACITY = 0.2;
  const MAX_OPACITY = 0.7;
  const MIN_SPEED = 25; // px/s (mais lento)
  const MAX_SPEED = 80; // px/s (mais lento)
  const MIN_SWAY = 3; // px (amplitude mínima)
  const MAX_SWAY = 8; // px (amplitude máxima — reduzida)
  const MIN_FREQ = 0.15; // ciclos/s (mais lento)
  const MAX_FREQ = 0.6; // ciclos/s (mais lento)

  const flakes = [];
  const vw = () => Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = () => Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  function createFlake(initialYAbove = true) {
    const el = document.createElement("span");
    const size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
    const baseX = Math.random() * vw();
    const y = initialYAbove ? -(Math.random() * vh() * 0.6 + 10) : Math.random() * vh();
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    const swayAmp = MIN_SWAY + Math.random() * (MAX_SWAY - MIN_SWAY);
    const freq = MIN_FREQ + Math.random() * (MAX_FREQ - MIN_FREQ);
    const phase = Math.random() * Math.PI * 2;
    const opacity = MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY);

    // flocos maiores balançam menos — scale entre 1 (pequeno) e ~0.45 (grande)
    const sizeNorm = (size - MIN_SIZE) / Math.max(1, MAX_SIZE - MIN_SIZE);
    const swayScale = 1 - sizeNorm * 0.55;

    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.opacity = opacity;
    el.style.transform = `translate3d(${baseX}px, ${y}px, 0)`;

    snowContainer.appendChild(el);

    return {
      el,
      size,
      baseX,
      y,
      speed,
      swayAmp,
      freq,
      phase,
      opacity,
      swayScale,
      elapsed: Math.random() * 1000,
    };
  }

  for (let i = 0; i < TOTAL; i++) {
    flakes.push(createFlake(i < TOTAL * 0.6));
  }

  let last = performance.now();
  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;
    const H = vh();
    const W = vw();

    for (let f of flakes) {
      f.elapsed += dt;
      f.y += f.speed * dt;
      // sway suave reduzido e escalado por tamanho
      const sway = Math.sin(2 * Math.PI * f.freq * f.elapsed + f.phase) * f.swayAmp * f.swayScale;
      let x = f.baseX + sway;

      // limites suaves
      if (x < -50) x = -50;
      if (x > W + 50) x = W + 50;

      f.el.style.transform = `translate3d(${x}px, ${f.y}px, 0)`;

      if (f.y > H + 40) {
        // reciclar para topo com parâmetros amenos
        f.baseX = Math.random() * W;
        f.y = -10 - Math.random() * (H * 0.4);
        f.size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
        f.el.style.width = f.size + "px";
        f.el.style.height = f.size + "px";
        f.speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
        f.swayAmp = MIN_SWAY + Math.random() * (MAX_SWAY - MIN_SWAY);
        f.freq = MIN_FREQ + Math.random() * (MAX_FREQ - MIN_FREQ);
        f.phase = Math.random() * Math.PI * 2;
        f.opacity = MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY);
        f.el.style.opacity = f.opacity;
        const sizeNorm = (f.size - MIN_SIZE) / Math.max(1, MAX_SIZE - MIN_SIZE);
        f.swayScale = 1 - sizeNorm * 0.55;
        f.elapsed = Math.random() * 1000;
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // --- resize handler substituindo o antigo problema ---
  let lastW = vw();
  let lastH = vh();

  function debounce(fn, delay = 120) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  const onResize = () => {
    const W = vw();
    const H = vh();
    if (!lastW || !lastH) {
      lastW = W || 1;
      lastH = H || 1;
    }
    const sx = W / lastW;
    const sy = H / lastH;

    for (let f of flakes) {
      // escala posições sem "teleport"
      f.baseX = f.baseX * sx;
      f.y = f.y * sy;

      // garante que baseX fique dentro da viewport atual
      if (f.baseX < -50) f.baseX = Math.random() * 30;
      if (f.baseX > W + 50) f.baseX = W - Math.random() * 30;

      // atualiza transform imediatamente para cobrir a nova área
      const sway = Math.sin(2 * Math.PI * f.freq * f.elapsed + f.phase) * f.swayAmp * f.swayScale;
      const x = Math.min(Math.max(f.baseX + sway, -50), W + 50);
      f.el.style.transform = `translate3d(${x}px, ${f.y}px, 0)`;
    }

    lastW = W;
    lastH = H;
  };

  window.addEventListener("resize", debounce(onResize, 120));
}
