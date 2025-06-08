// Utility functions for the terminal

// Manages terminal output
const TerminalOutput = {
  outputElement: null,

  init(elementId) {
    this.outputElement = document.getElementById(elementId);
  },

  addLine(text, className = "") {
    if (!this.outputElement) {
      console.error("Output element not initialized");
      return;
    }

    const lineElement = document.createElement("div");
    lineElement.textContent = text;
    if (className) {
      lineElement.classList.add(className);
    }
    this.outputElement.appendChild(lineElement);

    // Scroll to the bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  },

  clear() {
    if (this.outputElement) {
      this.outputElement.innerHTML = "";
    }
  },
};

// Language management
const LanguageManager = {
  currentLanguage: "english",

  translations: {
    english: {
      welcome: "Welcome to the Terminal!",
      unrecognized: "Command not recognized.",
    },
    french: {
      welcome: "Bienvenue dans le Terminal!",
      unrecognized: "Commande non reconnue.",
    },
  },

  setLanguage(lang) {
    if (["english", "french"].includes(lang.toLowerCase())) {
      this.currentLanguage = lang.toLowerCase();
      return true;
    }
    return false;
  },

  translate(key) {
    return this.translations[this.currentLanguage][key] || key;
  },
};
