// =====================================================================
//  BANQUE DE QUESTIONS DU QUIZ
// =====================================================================
//  Chaque question :
//    { q, options: [4 réponses], correct: index (0 à 3), cat, diff }
//  cat  : "histoire" | "sciences" | "geo" | "arts" | "cinema" | "sport" | "culture"
//  diff : "facile" | "moyen" | "difficile"
// =====================================================================

const QUIZ_CATEGORIES = {
  all: "Toutes catégories",
  histoire: "📜 Histoire",
  sciences: "🔬 Sciences",
  geo: "🌍 Géographie",
  arts: "🎨 Arts & Littérature",
  cinema: "🎬 Cinéma",
  sport: "⚽ Sport",
  culture: "🧠 Culture générale",
};

const QUIZ_QUESTIONS = [
  // --- Histoire ---
  { q: "En quelle année est tombé le mur de Berlin ?", options: ["1987", "1989", "1991", "1993"], correct: 1, cat: "histoire", diff: "moyen" },
  { q: "Quel empereur romain a fait de Constantinople sa capitale ?", options: ["Néron", "Auguste", "Constantin", "Trajan"], correct: 2, cat: "histoire", diff: "difficile" },
  { q: "Qui était Premier ministre du Royaume-Uni pendant la 2e Guerre mondiale ?", options: ["Chamberlain", "Churchill", "Attlee", "Eden"], correct: 1, cat: "histoire", diff: "facile" },
  { q: "La bataille d'Austerlitz eut lieu en...", options: ["1805", "1812", "1799", "1815"], correct: 0, cat: "histoire", diff: "difficile" },
  { q: "Quelle civilisation a construit Machu Picchu ?", options: ["Aztèque", "Maya", "Inca", "Olmèque"], correct: 2, cat: "histoire", diff: "moyen" },
  { q: "Qui a proclamé l'indépendance des États-Unis en 1776 ?", options: ["Lincoln", "Washington", "Jefferson", "Franklin"], correct: 2, cat: "histoire", diff: "moyen" },

  // --- Sciences ---
  { q: "Quel est l'élément chimique le plus abondant dans l'univers ?", options: ["Oxygène", "Hélium", "Carbone", "Hydrogène"], correct: 3, cat: "sciences", diff: "moyen" },
  { q: "Combien de paires de chromosomes possède l'être humain ?", options: ["21", "22", "23", "24"], correct: 2, cat: "sciences", diff: "moyen" },
  { q: "Quelle est la particule de charge négative de l'atome ?", options: ["Proton", "Neutron", "Électron", "Photon"], correct: 2, cat: "sciences", diff: "facile" },
  { q: "Qui a formulé la théorie de la relativité générale ?", options: ["Newton", "Bohr", "Einstein", "Planck"], correct: 2, cat: "sciences", diff: "facile" },
  { q: "Quelle planète possède la plus grande lune du système solaire ?", options: ["Saturne", "Jupiter", "Neptune", "Uranus"], correct: 1, cat: "sciences", diff: "difficile" },
  { q: "Quel gaz les plantes absorbent-elles pour la photosynthèse ?", options: ["Oxygène", "Azote", "Dioxyde de carbone", "Méthane"], correct: 2, cat: "sciences", diff: "facile" },

  // --- Géographie ---
  { q: "Quelle est la capitale de l'Australie ?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], correct: 2, cat: "geo", diff: "moyen" },
  { q: "Quel pays possède le plus de fuseaux horaires ?", options: ["Russie", "États-Unis", "Chine", "France"], correct: 3, cat: "geo", diff: "difficile" },
  { q: "Le lac Baïkal se trouve dans quel pays ?", options: ["Mongolie", "Russie", "Kazakhstan", "Chine"], correct: 1, cat: "geo", diff: "moyen" },
  { q: "Quel détroit sépare l'Europe de l'Afrique ?", options: ["Bosphore", "Gibraltar", "Ormuz", "Malacca"], correct: 1, cat: "geo", diff: "moyen" },
  { q: "Quelle est la plus haute montagne d'Afrique ?", options: ["Mont Kenya", "Kilimandjaro", "Atlas", "Ras Dashen"], correct: 1, cat: "geo", diff: "facile" },

  // --- Arts & Littérature ---
  { q: "Qui a composé 'La Flûte enchantée' ?", options: ["Beethoven", "Bach", "Mozart", "Vivaldi"], correct: 2, cat: "arts", diff: "moyen" },
  { q: "Quel peintre a coupé une partie de son oreille ?", options: ["Gauguin", "Van Gogh", "Cézanne", "Matisse"], correct: 1, cat: "arts", diff: "facile" },
  { q: "Qui a écrit 'Cent ans de solitude' ?", options: ["Borges", "Neruda", "García Márquez", "Cortázar"], correct: 2, cat: "arts", diff: "difficile" },
  { q: "Dans quel musée est exposée 'La Nuit étoilée' de Van Gogh ?", options: ["Louvre", "MoMA (New York)", "Prado", "Orsay"], correct: 1, cat: "arts", diff: "difficile" },
  { q: "Quel dramaturge a écrit 'Le Misanthrope' ?", options: ["Racine", "Corneille", "Molière", "Beaumarchais"], correct: 2, cat: "arts", diff: "moyen" },

  // --- Cinéma ---
  { q: "Qui a réalisé le film 'Pulp Fiction' ?", options: ["Scorsese", "Tarantino", "Coppola", "Nolan"], correct: 1, cat: "cinema", diff: "facile" },
  { q: "Quel film a remporté l'Oscar du meilleur film en 2020 ?", options: ["1917", "Joker", "Parasite", "Once Upon a Time"], correct: 2, cat: "cinema", diff: "moyen" },
  { q: "Quel acteur incarne Vito Corleone jeune dans 'Le Parrain 2' ?", options: ["Al Pacino", "Robert De Niro", "Marlon Brando", "James Caan"], correct: 1, cat: "cinema", diff: "difficile" },
  { q: "Quel studio a produit 'Toy Story' ?", options: ["DreamWorks", "Pixar", "Disney", "Illumination"], correct: 1, cat: "cinema", diff: "facile" },

  // --- Sport ---
  { q: "Combien de Ballons d'Or Lionel Messi a-t-il remportés (fin 2023) ?", options: ["6", "7", "8", "9"], correct: 2, cat: "sport", diff: "moyen" },
  { q: "Dans quel sport décerne-t-on la Coupe Stanley ?", options: ["Basket", "Hockey sur glace", "Baseball", "Football US"], correct: 1, cat: "sport", diff: "moyen" },
  { q: "En quelle année ont eu lieu les premiers JO modernes ?", options: ["1892", "1896", "1900", "1904"], correct: 1, cat: "sport", diff: "difficile" },
  { q: "Combien de joueurs dans une équipe de basket sur le terrain ?", options: ["5", "6", "7", "11"], correct: 0, cat: "sport", diff: "facile" },

  // --- Culture générale ---
  { q: "Quelle est la monnaie du Japon ?", options: ["Won", "Yuan", "Yen", "Ringgit"], correct: 2, cat: "culture", diff: "facile" },
  { q: "Combien de touches possède un piano standard ?", options: ["76", "82", "88", "92"], correct: 2, cat: "culture", diff: "difficile" },
  { q: "Quel organe produit l'insuline ?", options: ["Foie", "Pancréas", "Rate", "Rein"], correct: 1, cat: "culture", diff: "moyen" },
  { q: "Quel philosophe grec fut le maître d'Alexandre le Grand ?", options: ["Platon", "Socrate", "Aristote", "Épicure"], correct: 2, cat: "culture", diff: "moyen" },
  { q: "Que mesure l'échelle de Richter ?", options: ["Le vent", "Les séismes", "La température", "Le bruit"], correct: 1, cat: "culture", diff: "facile" },
];

// Choisit N questions selon la catégorie et la difficulté demandées
function pickQuestions(n, category, difficulty) {
  let pool = QUIZ_QUESTIONS.filter((q) => {
    const okCat = !category || category === "all" || q.cat === category;
    const okDiff = !difficulty || difficulty === "all" || q.diff === difficulty;
    return okCat && okDiff;
  });
  // Si le filtre est trop restrictif, on complète avec le reste
  if (pool.length < n) {
    const rest = QUIZ_QUESTIONS.filter((q) => !pool.includes(q));
    pool = pool.concat(rest);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
