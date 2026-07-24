// =====================================================================
//  QUESTIONS DU JEU "RÉPLIQUES" (réponses drôles à voter)
// =====================================================================
//  Ajoute-en autant que tu veux, une phrase par ligne.
// =====================================================================

const PROMPTS = [
  "Le pire nom pour un animal de compagnie",
  "Une excuse nulle pour arriver en retard",
  "Un super-pouvoir complètement inutile",
  "La pire chose à dire pendant un premier rendez-vous",
  "Un mauvais slogan pour un dentiste",
  "Ce qu'on ne devrait jamais crier dans un avion",
  "Le pire cadeau d'anniversaire possible",
  "Une règle bizarre à instaurer à la maison",
  "Un nom de groupe de musique catastrophique",
  "La pire façon de commencer un discours de mariage",
  "Ce qu'un extraterrestre penserait en arrivant sur Terre",
  "Un mauvais conseil pour réussir dans la vie",
  "Le pire parfum de glace à commercialiser",
  "Une phrase à ne jamais dire à son patron",
  "Un titre de film d'horreur pas du tout effrayant",
  "La pire compétence à mettre sur un CV",
  "Ce qu'on trouve dans le sac à main de quelqu'un de louche",
  "Un mauvais nom pour un restaurant chic",
  "La pire chose à offrir à quelqu'un qu'on déteste",
  "Une mauvaise idée de tatouage",
  "Ce que ton chien dirait s'il pouvait parler",
  "Le pire thème pour une fête d'enfants",
  "Une invention dont personne n'a besoin",
  "La pire réponse à 'Ça va ?'",
  "Un mauvais nom pour un parfum de luxe",
];

// Choisit N questions au hasard (sans répétition)
function pickPrompts(n) {
  const copy = PROMPTS.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
