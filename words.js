// =====================================================================
//  MOTS SECRETS DE "L'INTRUS", classés par thème
// =====================================================================

const WORD_THEMES = {
  objets: {
    label: "🛠️ Objets du quotidien",
    words: ["Téléphone", "Parapluie", "Lunettes", "Horloge", "Valise", "Clavier",
            "Miroir", "Bougie", "Ciseaux", "Casque", "Portefeuille", "Brosse à dents"],
  },
  animaux: {
    label: "🐾 Animaux",
    words: ["Éléphant", "Pingouin", "Requin", "Papillon", "Serpent", "Kangourou",
            "Hibou", "Dauphin", "Caméléon", "Écureuil", "Panda", "Flamant rose"],
  },
  lieux: {
    label: "🏙️ Lieux",
    words: ["Plage", "Montagne", "Aéroport", "Bibliothèque", "Marché", "Château",
            "Piscine", "Désert", "Forêt", "Volcan", "Cinéma", "Gare"],
  },
  nourriture: {
    label: "🍕 Nourriture",
    words: ["Pizza", "Chocolat", "Fromage", "Croissant", "Sushi", "Baguette",
            "Glace", "Hamburger", "Café", "Pastèque", "Crêpe", "Popcorn"],
  },
  fantastique: {
    label: "🐉 Fantastique",
    words: ["Dragon", "Licorne", "Vampire", "Sorcière", "Fantôme", "Pirate",
            "Ninja", "Robot", "Trésor", "Château hanté", "Fusée", "Zombie"],
  },
};

const WORD_THEME_LABELS = { all: "🎲 Tous les thèmes" };
Object.keys(WORD_THEMES).forEach((k) => (WORD_THEME_LABELS[k] = WORD_THEMES[k].label));

// Renvoie la liste de mots selon le thème ("all" = tout mélangé)
function getWords(theme) {
  if (!theme || theme === "all") {
    return Object.values(WORD_THEMES).reduce((acc, t) => acc.concat(t.words), []);
  }
  return WORD_THEMES[theme] ? WORD_THEMES[theme].words : [];
}
