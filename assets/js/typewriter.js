//O DOMContentLoaded dispara assim que o HTML for completamente carregado e processado, mas antes do carregamento das imagens e outros recursos externos, diferente do window.onload
document.addEventListener("DOMContentLoaded", function () {
  // Seleciona todos os elementos com a classe typewriter
  let typewriterElements = document.querySelectorAll(".typewriter");

  typewriterElements.forEach(function (element) {
    // Recupera as frases do atributo data-phrases e converte de string pra array
    let phrases = JSON.parse(element.getAttribute("data-phrases"));

    // Chama a função de efeito de máquina de escrever passando as frases
    typewriterEffect(element, phrases);
  });
});

// A função que aplica o efeito de máquina de escrever
function typewriterEffect(element, phrases) {
  let currentPhraseIndex = 0;
  let typingSpeed = 100; // Velocidade de digitação (ms)
  let erasingSpeed = 50; // Velocidade de apagar (ms)
  let pauseDuration = 1000; // Tempo de pausa antes de apagar

  // Função pra digitar a frase
  function typeText(text) {
    let index = 0;
    element.textContent = ""; // Limpa o texto anterior

    let typingInterval = setInterval(() => {
      element.textContent += text[index];
      index++;
      if (index === text.length) {
        clearInterval(typingInterval);
        setTimeout(() => eraseText(text), pauseDuration); // Pausa antes de apagar
      }
    }, typingSpeed);
  }

  // Função pra apagar a frase
  function eraseText(text) {
    let index = text.length;

    let erasingInterval = setInterval(() => {
      element.textContent = text.substring(0, index);
      index--;
      if (index < 0) {
        clearInterval(erasingInterval);
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
        setTimeout(() => typeText(phrases[currentPhraseIndex]), pauseDuration);
      }
    }, erasingSpeed);
  }

  // Inicia a animação com a primeira frase
  typeText(phrases[currentPhraseIndex]);
}