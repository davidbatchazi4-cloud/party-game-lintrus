# 🎭 L'Intrus — Party Game multijoueur

Un jeu de bluff où chaque joueur joue sur **son propre téléphone**.
Un mot secret est partagé par tous… sauf **l'intrus**. Saurez-vous le démasquer ?

---

## 🚀 Mise en route (à faire une seule fois, ~5 min)

Le jeu a besoin de **Firebase** (service gratuit de Google) pour que les
téléphones communiquent entre eux. Voici les étapes :

### Étape 1 — Créer le projet Firebase
1. Va sur **https://console.firebase.google.com/**
2. Connecte-toi avec ton compte Google.
3. Clique sur **« Créer un projet »**.
4. Donne un nom (ex : `intrus-game`), clique **Continuer**.
5. Tu peux **désactiver Google Analytics** (pas nécessaire), puis **Créer le projet**.

### Étape 2 — Activer la base de données temps réel
1. Dans le menu de gauche : **Créer** → **Realtime Database**.
2. Clique **« Créer une base de données »**.
3. Choisis un emplacement (ex : *europe-west1*), clique **Suivant**.
4. Choisis **« Démarrer en mode test »**, puis **Activer**.
   > ⚠️ Le mode test rend la base ouverte pendant 30 jours — parfait pour
   > jouer entre amis. On sécurisera plus tard si besoin.

### Étape 3 — Récupérer ta configuration
1. Clique sur l'icône ⚙️ (en haut à gauche) → **Paramètres du projet**.
2. Descends jusqu'à **« Vos applications »** et clique sur l'icône **`</>`** (Web).
3. Donne un surnom (ex : `intrus`), clique **Enregistrer l'application**.
4. Firebase affiche un bloc `const firebaseConfig = { ... }`.
   **Copie toutes les valeurs.**

### Étape 4 — Coller la config dans le jeu
1. Ouvre le fichier **`config.js`** (dans ce dossier).
2. Remplace chaque `"COLLE_ICI..."` par TES valeurs.
3. Enregistre.

✅ **C'est tout !** Le jeu est prêt.

---

## 🧪 Tester sur ton PC (avant les téléphones)

Tu peux jouer tout seul en simulant plusieurs joueurs :

1. Double-clique sur **`index.html`** → il s'ouvre dans le navigateur.
2. Clique **Créer une partie**, choisis un pseudo → tu obtiens un **code** (ex : `ABCD`).
3. Ouvre **2 autres onglets** avec le même `index.html`.
   > 💡 Astuce : ouvre-les en **navigation privée** pour simuler des joueurs différents.
4. Dans chaque onglet : **Rejoindre**, entre le même code, un pseudo différent.
5. Reviens sur le 1er onglet (l'hôte) → **Lancer la partie** (min. 3 joueurs).

---

## 📱 Jouer sur les téléphones (en ligne, partout)

Pour que les téléphones y accèdent, le jeu doit être **hébergé en ligne**
(gratuit). On fera cette étape ensemble — le plus simple :

- **Netlify Drop** : glisse ce dossier sur https://app.netlify.com/drop → tu obtiens un lien à partager.
- ou **Firebase Hosting** (déjà dans ton projet Firebase).

Ensuite, chacun ouvre le lien sur son téléphone et entre le code. 🎉

---

## 📁 Fichiers du projet

| Fichier        | Rôle                                             |
|----------------|--------------------------------------------------|
| `index.html`   | La structure des écrans                          |
| `style.css`    | Le design (optimisé téléphone)                   |
| `app.js`       | La logique du jeu                                |
| `words.js`     | La liste des mots secrets (modifiable)           |
| `config.js`    | **Ta config Firebase** (à remplir)               |

---

## 🔒 Note honnête sur la sécurité

En mode test, un joueur très technique pourrait théoriquement inspecter la
base et voir le mot secret. Pour jouer entre amis, c'est sans importance.
Si un jour tu veux une version "anti-triche", on ajoutera des règles
serveur — dis-le-moi et on le fera.
