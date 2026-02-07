export function wavyText() {
  const css = `
    .wavy {
        display: inline-block;
        animation: wave 2.5s infinite ease-in-out;
        animation-direction: alternate;
        animation-delay: calc(-2.5s + (0.08s * var(--i)));
        overflow: visible;
    }

    @keyframes wave {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-10px);
        }
    }
    `;
  const style = document.createElement("style");
  style.id = "wavy-style";
  style.textContent = css;
  document.head.appendChild(style);

  const wavyTexts = document.querySelectorAll(".wavy");

  wavyTexts.forEach((wavyText) => {
    const text = wavyText.innerHTML;
    const letters = text.split("");

    wavyText.innerHTML = letters
      .map((letter, i) => {
        if (letter === "<") {
          return text.slice(text.indexOf("<"), text.indexOf(">") + 1);
        }
        if (letter === ">") return "";
        if (letter === "/") return "";
        if (text[i - 1] === "<") return "";
        if (text[i - 1] === "/") return "";
        if (letter === " ") return " "; // Preserva os espaços
        return `<span class="wavy" style="--i:${i}">${letter}</span>`;
      })
      .join("");
  });
}

wavyText();
