// =====================================================================
//  PARTY GAME — moteur multi-jeux
// =====================================================================
//  Jeux disponibles : "intrus" (bluff)  •  "quiz" (culture G)
//  La base (salon, joueurs, scores, synchro) est commune à tous.
// =====================================================================

// ---------- Vérifier que Firebase est configuré ----------
function isConfigured() {
  return firebaseConfig && !String(firebaseConfig.apiKey).includes("COLLE_ICI");
}

// ---------- Utilitaires d'affichage ----------
const $ = (id) => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
let TS; // raccourci vers l'horodatage serveur (défini au démarrage)

// ---------- Avatars colorés ----------
const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7",
                       "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4"];
function colorFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarHTML(id, name) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return "<span class='avatar' style='background:" + colorFor(id) + "'>" + letter + "</span>";
}

// ---------- Sons (WebAudio, sans fichier externe) ----------
let audioCtx = null;
let soundOn = localStorage.getItem("pg_sound") !== "off";
function playTone(freq, dur, type) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(gain); gain.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* silencieux */ }
}
function soundPop() { playTone(660, 0.12, "triangle"); }
function soundGood() { playTone(880, 0.15, "sine"); setTimeout(() => playTone(1320, 0.18, "sine"), 120); }
function soundBad() { playTone(200, 0.3, "sawtooth"); }
function soundReveal() { playTone(520, 0.15, "triangle"); setTimeout(() => playTone(780, 0.2, "triangle"), 130); }

// Joue un son selon la nouvelle phase de jeu
function soundForPhase(room) {
  if (room.status === "lobby" || !room.game) return;
  const g = room.game;
  const p = g.phase;
  if (g.name === "quiz") {
    if (p === "question") soundPop();
    else if (p === "reveal") (g.lastPoints && g.lastPoints[myId] > 0) ? soundGood() : soundBad();
    else if (p === "final") soundReveal();
  } else if (g.name === "intrus") {
    if (p === "clue" || p === "vote") soundPop();
    else if (p === "reveal") soundReveal();
  } else if (g.name === "repliques") {
    if (p === "answer" || p === "vote") soundPop();
    else if (p === "reveal" || p === "final") soundReveal();
  } else if (g.name === "loup") {
    if (p === "roleReveal" || p === "dayVote") soundPop();
    else if (p === "dayReveal" || p === "dayResult") soundReveal();
    else if (p === "over") { const won = (g.winner === "loups") === (g.roles[myId] === "loup"); won ? soundGood() : soundBad(); }
  }
}

// ---------- État local (propre à CE joueur) ----------
let db = null;
let myId = localStorage.getItem("pg_pid");
if (!myId) {
  myId = "p_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("pg_pid", myId);
}
let myName = "";
let roomCode = null;
let isHost = false;
let roomRef = null;
let currentRoom = null;

// Drapeaux locaux, réinitialisés à chaque nouvelle "manche"
let lastKey = "";
let roleAck = false;
let clueSubmitted = false;
let voteSubmitted = false;
let answerSubmitted = false;
let loupPicked = false;

// Minuteurs
let quizTimer = null;        // minuterie côté hôte (fin de question)
let quizTimerKey = "";

// =====================================================================
//  DÉMARRAGE
// =====================================================================
window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured()) { showScreen("screen-setup"); return; }
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  TS = firebase.database.ServerValue.TIMESTAMP;
  showScreen("screen-home");
  wireHome();
  wireButtons();
  fillSettingSelects();
  wireAccordion();
  setInterval(tickTimer, 250); // rafraîchit le compte à rebours affiché
});

// Remplit les menus déroulants (thèmes, catégories)
function fillSettingSelects() {
  const themeSel = $("set-intrus-theme");
  Object.keys(WORD_THEME_LABELS).forEach((k) => {
    themeSel.add(new Option(WORD_THEME_LABELS[k], k));
  });
  const catSel = $("set-quiz-cat");
  Object.keys(QUIZ_CATEGORIES).forEach((k) => {
    catSel.add(new Option(QUIZ_CATEGORIES[k], k));
  });
}

// Panneaux de réglages pliables
function wireAccordion() {
  document.querySelectorAll(".game-card-head").forEach((head) => {
    head.addEventListener("click", () => {
      const panel = $(head.getAttribute("data-toggle"));
      panel.classList.toggle("open");
      const chev = head.querySelector(".chevron");
      if (chev) chev.style.transform = panel.classList.contains("open") ? "rotate(180deg)" : "";
    });
  });
}

// =====================================================================
//  ÉCRAN D'ACCUEIL
// =====================================================================
function wireHome() {
  $("btn-create").addEventListener("click", createRoom);
  $("btn-join").addEventListener("click", joinRoom);
  $("btn-scan").addEventListener("click", openScanner);
  $("btn-scan-cancel").addEventListener("click", closeScanner);
  $("btn-copy-link").addEventListener("click", copyRoomLink);
  $("input-code").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
  });
  prefillFromUrl();
}

// Si on arrive via un lien / QR code (…?code=ABCD), on pré-remplit le code
function prefillFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = codeFromText(params.get("code") || location.hash);
  if (!code) return;
  $("input-code").value = code;
  inviteMessage(code);
  $("input-name").focus();
  // On nettoie l'URL pour ne pas garder un vieux code en mémoire
  try { history.replaceState({}, "", location.pathname); } catch (e) { /* file:// */ }
}

function inviteMessage(code) {
  const el = $("home-invite");
  el.textContent = "Partie " + code + " 🎉 — entre ton pseudo puis appuie sur « Rejoindre ».";
  show(el);
}
function homeError(msg) { const el = $("home-error"); el.textContent = msg; show(el); }
function readName() {
  const n = $("input-name").value.trim();
  if (!n) { homeError("Entre d'abord ton pseudo 🙂"); return null; }
  return n;
}
function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 4; i++) c += letters[Math.floor(Math.random() * letters.length)];
  return c;
}

async function createRoom() {
  const name = readName();
  if (!name) return;
  myName = name;
  const code = randomCode();
  await db.ref("rooms/" + code).set({ status: "lobby", hostId: myId, createdAt: Date.now() });
  isHost = true;
  await enterRoom(code);
}

async function joinRoom() {
  const name = readName();
  if (!name) return;
  const code = $("input-code").value.trim().toUpperCase();
  if (code.length !== 4) { homeError("Le code fait 4 lettres."); return; }
  const snap = await db.ref("rooms/" + code).get();
  if (!snap.exists()) { homeError("Aucune partie avec ce code 🤔"); return; }
  if (snap.val().status !== "lobby") { homeError("Cette partie a déjà commencé !"); return; }
  myName = name;
  isHost = (snap.val().hostId === myId);
  await enterRoom(code);
}

// =====================================================================
//  QR CODE — partager le salon
// =====================================================================
// Lien d'invitation : la même page, avec le code dans l'URL
// (en local, ouvert en file://, on met simplement le code dans le QR)
function roomLink(code) {
  if (location.protocol === "file:") return code;
  return location.origin + location.pathname + "?code=" + code;
}

// Extrait un code de partie depuis un texte (lien complet ou 4 lettres)
function codeFromText(text) {
  if (!text) return null;
  const s = String(text).trim();
  const m = s.match(/[?&#]code=([A-Za-z]{4})(?![A-Za-z])/);
  if (m) return m[1].toUpperCase();
  const raw = s.toUpperCase().replace(/[^A-Z]/g, "");
  return raw.length === 4 ? raw : null;
}

let qrDrawnFor = "";
// Dessine le QR code du salon dans le canvas (une seule fois par code)
function drawRoomQR(code) {
  const canvas = $("qr-canvas");
  if (!canvas || qrDrawnFor === code) return;
  if (typeof qrcode === "undefined") { hide(canvas); return; }
  const qr = qrcode(0, "M");           // 0 = taille auto, M = correction moyenne
  qr.addData(roomLink(code));
  qr.make();

  const n = qr.getModuleCount();
  const quiet = 2;                      // marge blanche (en modules)
  const cell = Math.max(3, Math.floor(240 / (n + quiet * 2)));
  const size = cell * (n + quiet * 2);
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#12101e";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
  }
  show(canvas);
  qrDrawnFor = code;
}

// Copie le lien d'invitation dans le presse-papier
async function copyRoomLink() {
  if (!roomCode) return;
  const btn = $("btn-copy-link");
  const link = roomLink(roomCode);
  try {
    await navigator.clipboard.writeText(link);
    btn.textContent = "✅ Lien copié !";
  } catch (e) {
    // Navigateurs sans presse-papier : on affiche le lien à recopier
    btn.textContent = link;
  }
  setTimeout(() => { btn.textContent = "🔗 Copier le lien"; }, 2500);
}

// =====================================================================
//  SCANNER UN QR CODE (caméra)
// =====================================================================
let scanStream = null;      // flux vidéo en cours
let scanDetector = null;    // BarcodeDetector natif (si dispo)
let scanTimer = null;       // boucle d'analyse
let scanCanvas = null;      // canvas utilisé par jsQR
let jsqrLoading = null;

function scanMsg(txt) { $("scanner-msg").textContent = txt; }

// jsQR n'est chargé que si le navigateur n'a pas BarcodeDetector (iOS…)
function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (!jsqrLoading) {
    jsqrLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/jsQR.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return jsqrLoading;
}

async function openScanner() {
  show($("scanner"));
  scanMsg("Ouverture de la caméra…");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanMsg("Le scan a besoin d'une connexion sécurisée (https). Utilise le code à 4 lettres 🙂");
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
  } catch (e) {
    scanMsg("Caméra indisponible — autorise l'accès dans ton navigateur, ou entre le code à 4 lettres.");
    return;
  }

  const video = $("scanner-video");
  video.srcObject = scanStream;
  try { await video.play(); } catch (e) { /* certains navigateurs jouent tout seuls */ }

  if ("BarcodeDetector" in window) {
    try { scanDetector = new BarcodeDetector({ formats: ["qr_code"] }); }
    catch (e) { scanDetector = null; }
  }
  if (!scanDetector) {
    try { await loadJsQR(); }
    catch (e) { scanMsg("Impossible de charger le lecteur de QR code 😕"); return; }
  }

  scanMsg("Vise le QR code de la partie 🎯");
  scanTimer = setInterval(scanTick, 150);
}

async function scanTick() {
  const video = $("scanner-video");
  if (!scanStream || !video.videoWidth) return;
  let text = null;
  try {
    if (scanDetector) {
      const codes = await scanDetector.detect(video);
      if (codes && codes.length) text = codes[0].rawValue;
    } else if (window.jsQR) {
      if (!scanCanvas) scanCanvas = document.createElement("canvas");
      const w = 400;
      const h = Math.round(video.videoHeight * (w / video.videoWidth));
      scanCanvas.width = w; scanCanvas.height = h;
      const ctx = scanCanvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
      if (res) text = res.data;
    }
  } catch (e) { return; } // image pas prête : on réessaie au tour suivant
  if (text) onScanned(text);
}

function onScanned(text) {
  const code = codeFromText(text);
  if (!code) { scanMsg("Ce QR code n'est pas celui d'une partie 🤔"); return; }
  closeScanner();
  soundGood();
  $("input-code").value = code;
  hide($("home-error"));
  const name = $("input-name").value.trim();
  if (name) joinRoom();
  else { inviteMessage(code); $("input-name").focus(); }
}

function closeScanner() {
  clearInterval(scanTimer); scanTimer = null;
  scanDetector = null;
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  $("scanner-video").srcObject = null;
  hide($("scanner"));
}

// =====================================================================
//  ENTRER / QUITTER UNE PARTIE
// =====================================================================
async function enterRoom(code) {
  roomCode = code;
  roomRef = db.ref("rooms/" + code);
  const playerRef = roomRef.child("players/" + myId);
  await playerRef.set({ name: myName, score: 0 });
  playerRef.onDisconnect().remove();

  $("room-badge").textContent = "Salon " + code;
  show($("room-badge"));
  hide($("home-invite"));
  hide($("home-error"));

  roomRef.on("value", (snap) => {
    currentRoom = snap.val();
    if (!currentRoom) { leaveRoom(); return; }
    render(currentRoom);
    if (isHost) hostLogic(currentRoom);
  });
}

function leaveRoom() {
  if (roomRef) {
    roomRef.off();
    roomRef.child("players/" + myId).remove();
  }
  roomRef = null; roomCode = null; currentRoom = null;
  isHost = false; lastKey = ""; qrDrawnFor = "";
  clearTimeout(quizTimer); quizTimerKey = "";
  hide($("room-badge"));
  showScreen("screen-home");
}

// =====================================================================
//  AIGUILLAGE DE L'AFFICHAGE
// =====================================================================
function render(room) {
  // Détecter une nouvelle "manche" pour réinitialiser les drapeaux locaux
  const key = roundKey(room);
  if (key !== lastKey) {
    const firstRender = lastKey === "";
    lastKey = key;
    roleAck = false; clueSubmitted = false; voteSubmitted = false; answerSubmitted = false;
    loupPicked = false;
    if (!firstRender) soundForPhase(room); // son au changement de phase (pas au tout 1er rendu)
  }

  if (room.status === "lobby" || !room.game) { renderLobby(room); return; }

  const g = room.game;
  if (g.name === "intrus") {
    if (g.phase === "clue") { roleAck ? renderClue(room) : renderRole(room); }
    else if (g.phase === "vote") { renderVote(room); }
    else if (g.phase === "reveal") { renderReveal(room); }
  } else if (g.name === "quiz") {
    if (g.phase === "question") { renderQuizQuestion(room); }
    else if (g.phase === "reveal") { renderQuizReveal(room); }
    else if (g.phase === "final") { renderFinal(room); }
  } else if (g.name === "repliques") {
    if (g.phase === "answer") { renderRepAnswer(room); }
    else if (g.phase === "vote") { renderRepVote(room); }
    else if (g.phase === "reveal") { renderRepReveal(room); }
    else if (g.phase === "final") { renderFinal(room); }
  } else if (g.name === "loup") {
    renderLoup(room);
  }
}

function roundKey(room) {
  if (room.status === "lobby" || !room.game) return "lobby";
  const g = room.game;
  if (g.name === "intrus") return "intrus:" + g.round;
  if (g.name === "quiz") return "quiz:" + g.qIndex;
  if (g.name === "repliques") return "repliques:" + g.roundNo;
  if (g.name === "loup") return "loup:" + g.nightNo + ":" + g.phase;
  return "?";
}

// Petit utilitaire : liste de joueurs triée par score
function fillScoreList(ulId, players, extraPoints) {
  const ul = $(ulId);
  ul.innerHTML = "";
  Object.keys(players)
    .sort((a, b) => (players[b].score || 0) - (players[a].score || 0))
    .forEach((id, i) => {
      const li = document.createElement("li");
      const medal = ["🥇", "🥈", "🥉"][i] || "";
      const name = players[id].name + (id === myId ? " (toi)" : "");
      let right = (players[id].score || 0) + " pts";
      if (extraPoints && extraPoints[id] != null) right += "  (+" + extraPoints[id] + ")";
      li.innerHTML = "<span class='pl'>" + avatarHTML(id, players[id].name) + medal + " " + name +
        "</span><span class='score'>" + right + "</span>";
      ul.appendChild(li);
    });
}

// =====================================================================
//  HUB / SALON (menu des jeux)
// =====================================================================
function renderLobby(room) {
  showScreen("screen-lobby");
  $("lobby-code").textContent = roomCode;
  drawRoomQR(roomCode);
  const players = room.players || {};
  fillScoreList("lobby-players", players);
  const n = Object.keys(players).length;

  if (isHost) {
    show($("game-menu")); hide($("lobby-wait"));
    document.querySelector('.game-choice[data-game="intrus"]').disabled = n < 3;
    document.querySelector('.game-choice[data-game="quiz"]').disabled = n < 2;
    document.querySelector('.game-choice[data-game="repliques"]').disabled = n < 3;
    document.querySelector('.game-choice[data-game="loup"]').disabled = n < 4;
    $("lobby-hint").textContent =
      (n < 2) ? "En attente de joueurs... (min. 2 pour le Quiz, 3 pour L'Intrus/Répliques, 4 pour le Loup-Garou)"
      : (n < 3) ? "Le Quiz est jouable ! (Intrus/Répliques : 3 joueurs, Loup-Garou : 4)"
      : (n < 4) ? "Il ne manque plus qu'un joueur pour le Loup-Garou 🐺"
      : "Tous les jeux sont disponibles 🎉";
  } else {
    hide($("game-menu")); show($("lobby-wait"));
  }
}

// =====================================================================
//  ============ JEU 1 : L'INTRUS ============
// =====================================================================
function renderRole(room) {
  showScreen("screen-role");
  const g = room.game;
  const intrusIds = g.intrusIds || [];
  if (intrusIds.includes(myId)) {
    $("role-word").textContent = "❓ INTRUS";
    $("role-word").classList.add("is-intrus");
    $("role-hint").textContent = intrusIds.length > 1
      ? "Tu es l'un des " + intrusIds.length + " intrus ! Bluffe pour ne pas te faire repérer. 😈"
      : "Tu ne connais pas le mot ! Écoute les autres et bluffe. 😈";
  } else {
    $("role-word").textContent = g.word;
    $("role-word").classList.remove("is-intrus");
    $("role-hint").textContent = "Donne un indice sans révéler le mot, et démasque l'intrus !";
  }
}

function renderClue(room) {
  showScreen("screen-clue");
  const g = room.game;
  const clues = g.clues || {};
  const players = room.players || {};
  $("clue-instr").innerHTML = g.clueMode === "libre"
    ? "Écris un <strong>indice court</strong> lié au mot secret (sans le dire !)."
    : "Écris <strong>un seul mot</strong> lié au mot secret (sans le dire !).";
  $("input-clue").placeholder = g.clueMode === "libre" ? "Ton indice..." : "Un mot...";
  if (clueSubmitted || clues[myId]) {
    hide($("input-clue")); hide($("btn-clue")); show($("clue-waiting"));
  } else {
    show($("input-clue")); show($("btn-clue")); hide($("clue-waiting"));
  }
  $("clue-list").innerHTML =
    "<li class='muted'>Indices reçus : " + Object.keys(clues).length + " / " + Object.keys(players).length + "</li>";
}

function renderVote(room) {
  showScreen("screen-vote");
  const g = room.game;
  const players = room.players || {};
  const clues = g.clues || {};
  const votes = g.votes || {};

  const cl = $("vote-clues"); cl.innerHTML = "";
  Object.keys(players).forEach((id) => {
    const li = document.createElement("li");
    li.innerHTML = "<strong>" + players[id].name + "</strong> : " + (clues[id] || "—");
    cl.appendChild(li);
  });

  const vl = $("vote-list"); vl.innerHTML = "";
  if (voteSubmitted || votes[myId]) {
    show($("vote-waiting"));
    vl.innerHTML = "<li class='muted'>Votes reçus : " + Object.keys(votes).length + " / " + Object.keys(players).length + "</li>";
  } else {
    hide($("vote-waiting"));
    Object.keys(players).forEach((id) => {
      if (id === myId) return;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "btn btn-outline vote-btn";
      btn.textContent = players[id].name;
      btn.addEventListener("click", () => castVote(id));
      li.appendChild(btn); vl.appendChild(li);
    });
  }
}

function renderReveal(room) {
  showScreen("screen-reveal");
  const r = (room.game && room.game.result) || {};
  $("reveal-word").textContent = r.word || "?";
  $("reveal-intrus").textContent = r.intrusName || "?";
  if (r.tie) {
    $("reveal-title").textContent = "Égalité !";
    $("reveal-emoji").textContent = "🤷";
    $("reveal-text").textContent = "Personne n'a été éliminé. L'intrus s'en sort !";
  } else if (r.civiliansWin) {
    $("reveal-title").textContent = "Intrus démasqué ! 🎉";
    $("reveal-emoji").textContent = "🎉";
    $("reveal-text").textContent = r.accusedName + " était bien l'intrus. Bien joué !";
  } else {
    $("reveal-title").textContent = "L'intrus gagne ! 😈";
    $("reveal-emoji").textContent = "😈";
    $("reveal-text").textContent = "Vous avez accusé " + r.accusedName + "... mais l'intrus était ailleurs !";
  }
  // Bouton de l'hôte : manche suivante ou retour au menu
  const g = room.game;
  if (isHost) {
    show($("btn-menu-1"));
    if ((g.roundNo || 1) < (g.roundsTotal || 1)) {
      $("btn-menu-1").textContent = "Manche suivante ▶ (" + g.roundNo + "/" + g.roundsTotal + ")";
      $("btn-menu-1").onclick = nextIntrusRound;
    } else {
      $("btn-menu-1").textContent = "Retour au menu";
      $("btn-menu-1").onclick = backToMenu;
    }
    $("reveal-hint").textContent = "";
  } else {
    hide($("btn-menu-1"));
    $("reveal-hint").textContent = "En attente de l'hôte...";
  }
}

// ----- Actions / logique Intrus -----
function pickIntrus(ids, n) {
  const shuffled = ids.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(n, ids.length - 1)));
}

function startIntrus() {
  const ids = Object.keys(currentRoom.players || {});
  if (ids.length < 3) return;
  const theme = $("set-intrus-theme").value;
  const nIntrus = parseInt($("set-intrus-count").value, 10);
  const clueMode = $("set-intrus-clue").value;
  const roundsTotal = parseInt($("set-intrus-rounds").value, 10);
  const pool = getWords(theme);
  const word = pool[Math.floor(Math.random() * pool.length)];
  roomRef.update({
    status: "playing",
    game: {
      name: "intrus", phase: "clue", round: Date.now(),
      roundNo: 1, roundsTotal: roundsTotal, theme: theme,
      nIntrus: nIntrus, clueMode: clueMode,
      word: word, intrusIds: pickIntrus(ids, nIntrus),
    },
  });
}

function nextIntrusRound() {
  const g = currentRoom.game;
  const ids = Object.keys(currentRoom.players || {});
  const pool = getWords(g.theme);
  const word = pool[Math.floor(Math.random() * pool.length)];
  roomRef.update({
    "game/round": Date.now(),
    "game/roundNo": (g.roundNo || 1) + 1,
    "game/phase": "clue",
    "game/word": word,
    "game/intrusIds": pickIntrus(ids, g.nIntrus || 1),
    "game/clues": null,
    "game/votes": null,
    "game/result": null,
  });
}

function submitClue() {
  let word = $("input-clue").value.trim();
  if (!word) return;
  if (currentRoom.game.clueMode !== "libre") word = word.split(/\s+/)[0]; // 1 seul mot
  clueSubmitted = true;
  roomRef.child("game/clues/" + myId).set(word);
}
function castVote(targetId) {
  voteSubmitted = true;
  roomRef.child("game/votes/" + myId).set(targetId);
}

function intrusHostLogic(room) {
  const g = room.game;
  const ids = Object.keys(room.players || {});
  if (ids.length < 3) return;
  if (g.phase === "clue") {
    const clues = g.clues || {};
    if (ids.every((id) => clues[id])) roomRef.update({ "game/phase": "vote" });
  } else if (g.phase === "vote") {
    const votes = g.votes || {};
    if (ids.every((id) => votes[id])) computeIntrusResult(room);
  }
}

function computeIntrusResult(room) {
  const g = room.game;
  const players = room.players || {};
  const votes = g.votes || {};
  const intrusIds = g.intrusIds || [];

  const tally = {};
  Object.values(votes).forEach((t) => { tally[t] = (tally[t] || 0) + 1; });
  let max = 0, leaders = [];
  Object.keys(tally).forEach((id) => {
    if (tally[id] > max) { max = tally[id]; leaders = [id]; }
    else if (tally[id] === max) leaders.push(id);
  });

  const intrusName = intrusIds.map((id) => (players[id] ? players[id].name : "?")).join(", ");
  const awardIntrus = () => intrusIds.forEach((id) => {
    if (players[id]) updates["players/" + id + "/score"] = (players[id].score || 0) + 150;
  });
  const updates = {};
  let result;

  if (leaders.length !== 1) {
    result = { tie: true, word: g.word, intrusName: intrusName, civiliansWin: false };
    awardIntrus();
  } else {
    const accusedId = leaders[0];
    const wasIntrus = intrusIds.includes(accusedId);
    result = {
      tie: false, accusedId: accusedId,
      accusedName: players[accusedId] ? players[accusedId].name : "?",
      civiliansWin: wasIntrus, word: g.word, intrusName: intrusName,
    };
    if (wasIntrus) {
      Object.keys(players).forEach((id) => {
        if (!intrusIds.includes(id)) updates["players/" + id + "/score"] = (players[id].score || 0) + 100;
      });
    } else {
      awardIntrus();
    }
  }
  updates["game/phase"] = "reveal";
  updates["game/result"] = result;
  roomRef.update(updates);
}

// =====================================================================
//  ============ JEU 2 : QUIZ ============
// =====================================================================
function startQuiz() {
  const ids = Object.keys(currentRoom.players || {});
  if (ids.length < 2) return;
  const cat = $("set-quiz-cat").value;
  const diff = $("set-quiz-diff").value;
  const count = parseInt($("set-quiz-count").value, 10);
  const timeLimit = parseInt($("set-quiz-time").value, 10);
  const speedBonus = $("set-quiz-bonus").value === "1";
  roomRef.update({
    status: "playing",
    game: {
      name: "quiz", phase: "question", qIndex: 0,
      questions: pickQuestions(count, cat, diff), questionStart: TS,
      timeLimit: timeLimit, speedBonus: speedBonus,
    },
  });
}

function renderQuizQuestion(room) {
  showScreen("screen-quiz");
  const g = room.game;
  const q = g.questions[g.qIndex];
  $("quiz-progress").textContent = "Question " + (g.qIndex + 1) + " / " + g.questions.length;
  $("quiz-question").textContent = q.q;
  const answers = g.answers || {};
  const ul = $("quiz-options"); ul.innerHTML = "";
  if (answerSubmitted || answers[myId]) {
    hide(ul); show($("quiz-waiting"));
  } else {
    hide($("quiz-waiting")); show(ul);
    q.options.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "btn btn-outline quiz-opt";
      btn.textContent = opt;
      btn.addEventListener("click", () => answerQuiz(i));
      li.appendChild(btn); ul.appendChild(li);
    });
  }
}

function answerQuiz(i) {
  answerSubmitted = true;
  roomRef.child("game/answers/" + myId).set({ choice: i, time: TS });
}

function renderQuizReveal(room) {
  showScreen("screen-quiz-reveal");
  const g = room.game;
  const q = g.questions[g.qIndex];
  $("quiz-answer").textContent = q.options[q.correct];
  const pts = (g.lastPoints && g.lastPoints[myId]) || 0;
  $("quiz-points").textContent = pts > 0 ? "✅ +" + pts + " points !" : "❌ Pas de points cette fois.";
  fillScoreList("quiz-scores", room.players || {}, g.lastPoints);
  const last = g.qIndex + 1 >= g.questions.length;
  $("btn-quiz-next").textContent = last ? "Voir le classement final" : "Question suivante";
  hostOrWait("btn-quiz-next", "quiz-reveal-hint", "En attente de l'hôte...");
}

function renderFinal(room) {
  showScreen("screen-final");
  fillScoreList("final-scores", room.players || {});
  hostOrWait("btn-menu-2", "final-hint", "En attente de l'hôte...");
}

function quizHostLogic(room) {
  const g = room.game;
  const ids = Object.keys(room.players || {});
  if (g.phase === "question") {
    scheduleQuizTimer(room);
    const answers = g.answers || {};
    if (ids.length >= 1 && ids.every((id) => answers[id])) computeQuizReveal(room);
  }
}

// L'hôte programme la fin automatique de la question quand le temps est écoulé
function scheduleQuizTimer(room) {
  const g = room.game;
  if (!g.timeLimit) { clearTimeout(quizTimer); quizTimerKey = ""; return; }
  const key = "q" + g.qIndex;
  if (key === quizTimerKey) return; // déjà programmé
  quizTimerKey = key;
  clearTimeout(quizTimer);
  quizTimer = setTimeout(() => {
    const c = currentRoom && currentRoom.game;
    if (c && c.name === "quiz" && c.phase === "question" && c.qIndex === g.qIndex) {
      computeQuizReveal(currentRoom);
    }
  }, g.timeLimit * 1000 + 600);
}

function computeQuizReveal(room) {
  const g = room.game;
  const players = room.players || {};
  const q = g.questions[g.qIndex];
  const answers = g.answers || {};
  const cap = g.timeLimit > 0 ? g.timeLimit : 20;
  const updates = {};
  const lastPoints = {};
  Object.keys(players).forEach((id) => {
    const a = answers[id];
    let pts = 0;
    if (a && a.choice === q.correct) {
      if (!g.speedBonus) {
        pts = 500;
      } else {
        let elapsed = (a.time - g.questionStart) / 1000;
        elapsed = Math.min(cap, Math.max(0, elapsed));
        pts = Math.round(1000 - (elapsed / cap) * 800);
        if (pts < 200) pts = 200;
      }
    }
    lastPoints[id] = pts;
    updates["players/" + id + "/score"] = (players[id].score || 0) + pts;
  });
  updates["game/lastPoints"] = lastPoints;
  updates["game/phase"] = "reveal";
  roomRef.update(updates);
}

// Met à jour le compte à rebours affiché (appelé 4x/seconde)
function tickTimer() {
  const t = $("quiz-timer");
  const g = currentRoom && currentRoom.game;
  const onQuiz = g && g.name === "quiz" && g.phase === "question" && g.timeLimit > 0
    && !$("screen-quiz").classList.contains("hidden");
  if (!onQuiz) { hide(t); return; }
  let remaining = g.timeLimit - (Date.now() - g.questionStart) / 1000;
  remaining = Math.max(0, Math.min(g.timeLimit, remaining));
  t.textContent = "⏱️ " + Math.ceil(remaining) + "s";
  t.classList.toggle("urgent", remaining <= 5);
  show(t);
}

function nextQuizStep() {
  const g = currentRoom.game;
  if (g.qIndex + 1 >= g.questions.length) {
    roomRef.update({ "game/phase": "final" });
  } else {
    roomRef.update({
      "game/qIndex": g.qIndex + 1,
      "game/phase": "question",
      "game/questionStart": TS,
      "game/answers": null,
      "game/lastPoints": null,
    });
  }
}

// =====================================================================
//  ============ JEU 3 : RÉPLIQUES ============
// =====================================================================
function startRepliques() {
  const ids = Object.keys(currentRoom.players || {});
  if (ids.length < 3) return;
  const roundsTotal = parseInt($("set-rep-rounds").value, 10);
  roomRef.update({
    status: "playing",
    game: {
      name: "repliques", phase: "answer", roundNo: 1,
      roundsTotal: roundsTotal, prompts: pickPrompts(roundsTotal),
    },
  });
}

function currentPrompt(g) { return g.prompts[g.roundNo - 1]; }

function renderRepAnswer(room) {
  showScreen("screen-rep-answer");
  const g = room.game;
  $("rep-progress").textContent = "Manche " + g.roundNo + " / " + g.roundsTotal;
  $("rep-prompt").textContent = currentPrompt(g);
  const answers = g.answers || {};
  if (answerSubmitted || answers[myId]) {
    hide($("input-rep")); hide($("btn-rep-send")); show($("rep-answer-waiting"));
  } else {
    show($("input-rep")); show($("btn-rep-send")); hide($("rep-answer-waiting"));
  }
}

function submitRepAnswer() {
  const text = $("input-rep").value.trim();
  if (!text) return;
  answerSubmitted = true;
  roomRef.child("game/answers/" + myId).set(text);
}

function renderRepVote(room) {
  showScreen("screen-rep-vote");
  const g = room.game;
  $("rep-prompt-vote").textContent = currentPrompt(g);
  const answers = g.answers || {};
  const votes = g.votes || {};
  const vl = $("rep-vote-list"); vl.innerHTML = "";
  if (voteSubmitted || votes[myId]) {
    show($("rep-vote-waiting"));
    vl.innerHTML = "<li class='muted'>Votes reçus : " + Object.keys(votes).length + " / " + Object.keys(room.players || {}).length + "</li>";
  } else {
    hide($("rep-vote-waiting"));
    // Réponses anonymes, ordre stable (par identifiant), sauf la sienne
    Object.keys(answers).sort().forEach((authorId) => {
      if (authorId === myId) return;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "btn btn-outline vote-btn";
      btn.textContent = answers[authorId];
      btn.addEventListener("click", () => castRepVote(authorId));
      li.appendChild(btn); vl.appendChild(li);
    });
  }
}

function castRepVote(targetId) {
  voteSubmitted = true;
  roomRef.child("game/votes/" + myId).set(targetId);
}

function renderRepReveal(room) {
  showScreen("screen-rep-reveal");
  const g = room.game;
  const players = room.players || {};
  const answers = g.answers || {};
  const votes = g.votes || {};
  const tally = {};
  Object.values(votes).forEach((t) => { tally[t] = (tally[t] || 0) + 1; });

  const ul = $("rep-results"); ul.innerHTML = "";
  Object.keys(answers)
    .sort((a, b) => (tally[b] || 0) - (tally[a] || 0))
    .forEach((id) => {
      const nb = tally[id] || 0;
      const pts = (g.lastPoints && g.lastPoints[id]) || 0;
      const li = document.createElement("li");
      li.innerHTML = "<div class='ans'>" + answers[id] + "</div>" +
        "<div class='who'>par " + (players[id] ? players[id].name : "?") + "</div>" +
        "<div class='meta'>" + nb + " vote" + (nb > 1 ? "s" : "") + "  •  +" + pts + " pts</div>";
      ul.appendChild(li);
    });

  fillScoreList("rep-scores", players);
  const last = g.roundNo >= g.roundsTotal;
  $("btn-rep-next").textContent = last ? "Voir le classement final" : "Manche suivante";
  hostOrWait("btn-rep-next", "rep-reveal-hint", "En attente de l'hôte...");
}

function repHostLogic(room) {
  const g = room.game;
  const ids = Object.keys(room.players || {});
  if (ids.length < 2) return;
  if (g.phase === "answer") {
    const answers = g.answers || {};
    if (ids.every((id) => answers[id])) roomRef.update({ "game/phase": "vote" });
  } else if (g.phase === "vote") {
    const votes = g.votes || {};
    if (ids.every((id) => votes[id])) computeRepResult(room);
  }
}

function computeRepResult(room) {
  const g = room.game;
  const players = room.players || {};
  const answers = g.answers || {};
  const votes = g.votes || {};
  const tally = {};
  Object.values(votes).forEach((t) => { tally[t] = (tally[t] || 0) + 1; });

  const updates = {};
  const lastPoints = {};
  Object.keys(answers).forEach((id) => {
    const pts = (tally[id] || 0) * 100;
    lastPoints[id] = pts;
    updates["players/" + id + "/score"] = (players[id].score || 0) + pts;
  });
  updates["game/lastPoints"] = lastPoints;
  updates["game/phase"] = "reveal";
  roomRef.update(updates);
}

function nextRepStep() {
  const g = currentRoom.game;
  if (g.roundNo >= g.roundsTotal) {
    roomRef.update({ "game/phase": "final" });
  } else {
    roomRef.update({
      "game/roundNo": g.roundNo + 1,
      "game/phase": "answer",
      "game/answers": null,
      "game/votes": null,
      "game/lastPoints": null,
    });
  }
}

// =====================================================================
//  ============ JEU 4 : LOUP-GAROU ============
// =====================================================================
const LOUP_ROLES = {
  loup:       { label: "🐺 Loup-Garou", emoji: "🐺", desc: "Chaque nuit, dévore un villageois. Ne te fais pas démasquer !" },
  voyante:    { label: "🔮 Voyante",    emoji: "🔮", desc: "Chaque nuit, découvre le rôle d'un joueur." },
  villageois: { label: "🧑‍🌾 Villageois", emoji: "🧑‍🌾", desc: "Trouve et élimine les loups pendant le jour." },
};

function startLoup() {
  const ids = Object.keys(currentRoom.players || {});
  if (ids.length < 4) return;
  const nWolves = parseInt($("set-loup-wolves").value, 10);
  const seer = $("set-loup-seer").value === "1";
  const shuffled = ids.slice().sort(() => Math.random() - 0.5);
  const roles = {};
  let i = 0;
  for (let w = 0; w < nWolves; w++) roles[shuffled[i++]] = "loup";
  if (seer) roles[shuffled[i++]] = "voyante";
  while (i < shuffled.length) roles[shuffled[i++]] = "villageois";
  const alive = {};
  ids.forEach((id) => (alive[id] = true));
  roomRef.update({
    status: "playing",
    game: { name: "loup", phase: "roleReveal", nightNo: 1, settings: { nWolves, seer }, roles, alive },
  });
}

function renderLoup(room) {
  showScreen("screen-loup");
  const g = room.game;
  const players = room.players || {};
  const ids = Object.keys(players);
  const roles = g.roles || {};
  const alive = g.alive || {};
  const myRole = roles[myId];
  const amAlive = alive[myId] !== false;
  const aliveIds = ids.filter((id) => alive[id] !== false);
  const wolfIds = ids.filter((id) => roles[id] === "loup");

  const E = {
    emoji: $("loup-emoji"), title: $("loup-title"), roleBox: $("loup-role-box"),
    text: $("loup-text"), mates: $("loup-mates"), list: $("loup-list"),
    info: $("loup-info"), aliveUl: $("loup-alive"), hostBtn: $("loup-host-btn"), wait: $("loup-wait"),
  };
  E.emoji.textContent = ""; E.title.textContent = ""; E.text.textContent = ""; E.info.textContent = "";
  hide(E.roleBox); hide(E.mates); hide(E.aliveUl); hide(E.hostBtn); hide(E.wait);
  E.list.innerHTML = "";

  function hostBtn(label, fn) {
    if (isHost) { E.hostBtn.textContent = label; E.hostBtn.onclick = fn; show(E.hostBtn); }
    else { show(E.wait); E.wait.textContent = "En attente de l'hôte..."; }
  }
  function waitMsg(msg) { show(E.wait); E.wait.textContent = msg; }
  function pickButtons(targets, fn) {
    targets.forEach((id) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "btn btn-outline vote-btn";
      b.textContent = players[id].name;
      b.addEventListener("click", () => fn(id));
      li.appendChild(b); E.list.appendChild(li);
    });
  }
  function showAlive() {
    show(E.aliveUl); E.aliveUl.innerHTML = "";
    aliveIds.forEach((id) => {
      const li = document.createElement("li");
      li.innerHTML = "<span>❤️ " + players[id].name + (id === myId ? " (toi)" : "") + "</span>";
      E.aliveUl.appendChild(li);
    });
  }

  switch (g.phase) {
    case "roleReveal":
      E.emoji.textContent = LOUP_ROLES[myRole].emoji;
      E.title.textContent = "Ton rôle secret";
      show(E.roleBox); E.roleBox.textContent = LOUP_ROLES[myRole].label;
      E.roleBox.classList.toggle("is-intrus", myRole === "loup");
      E.text.textContent = LOUP_ROLES[myRole].desc;
      if (myRole === "loup" && wolfIds.length > 1) {
        show(E.mates);
        E.mates.textContent = "🐺 Tes complices : " + wolfIds.filter((id) => id !== myId).map((id) => players[id].name).join(", ");
      }
      hostBtn("Commencer la nuit 🌙", () => roomRef.update({ "game/phase": "nightWolves", "game/wolfVotes": null }));
      break;

    case "nightWolves":
      E.emoji.textContent = "🌙"; E.title.textContent = "La nuit tombe";
      if (myRole === "loup" && amAlive) {
        const wv = g.wolfVotes || {};
        if (loupPicked || wv[myId]) { waitMsg("🐺 Choix envoyé. En attente des autres loups..."); }
        else {
          E.text.textContent = "Choisis ta victime :";
          pickButtons(aliveIds.filter((id) => roles[id] !== "loup"), wolfPick);
        }
      } else {
        E.text.textContent = "Le village dort... 😴  Les loups rôdent.";
        waitMsg("Chuuut... la nuit est dangereuse.");
      }
      break;

    case "nightSeer":
      E.emoji.textContent = "🔮"; E.title.textContent = "La voyante consulte les astres";
      if (myRole === "voyante" && amAlive) {
        const res = g.seerResult;
        if (res) {
          E.info.textContent = players[res.target]
            ? players[res.target].name + " est " + LOUP_ROLES[res.role].label : "";
          E.hostBtn.textContent = "Continuer ☀️"; E.hostBtn.onclick = seerContinue; show(E.hostBtn);
        } else {
          E.text.textContent = "Choisis un joueur à sonder :";
          pickButtons(aliveIds.filter((id) => id !== myId), seerPick);
        }
      } else {
        E.text.textContent = "🔮 La voyante lit l'avenir...";
        if (isHost) { E.hostBtn.textContent = "Continuer ☀️"; E.hostBtn.onclick = seerContinue; show(E.hostBtn); }
        else waitMsg("Le village dort encore.");
      }
      break;

    case "dayReveal": {
      E.emoji.textContent = "☀️"; E.title.textContent = "Le jour se lève";
      const v = g.nightVictim;
      E.text.textContent = v
        ? "😢 " + v.name + " (" + LOUP_ROLES[v.role].label + ") a été dévoré cette nuit."
        : "Personne n'est mort cette nuit.";
      showAlive();
      if (g.winner) hostBtn("Voir le résultat 🏆", () => roomRef.update({ "game/phase": "over" }));
      else hostBtn("Continuer 🗣️", () => roomRef.update({ "game/phase": "debate" }));
      break;
    }

    case "debate":
      E.emoji.textContent = "🗣️"; E.title.textContent = "Débat";
      E.text.textContent = "Discutez et démasquez les loups ! Qui est suspect ?";
      showAlive();
      hostBtn("Passer au vote 🗳️", () => roomRef.update({ "game/phase": "dayVote", "game/dayVotes": null }));
      break;

    case "dayVote":
      E.emoji.textContent = "🗳️"; E.title.textContent = "Le vote du village";
      if (amAlive) {
        const dv = g.dayVotes || {};
        if (loupPicked || dv[myId]) {
          waitMsg("✅ Vote enregistré. En attente... (" + Object.keys(dv).length + "/" + aliveIds.length + ")");
        } else {
          E.text.textContent = "Vote pour éliminer un suspect :";
          pickButtons(aliveIds.filter((id) => id !== myId), dayVotePick);
        }
      } else {
        E.text.textContent = "Tu es mort... 👻"; waitMsg("Observe le village en silence.");
      }
      break;

    case "dayResult": {
      E.emoji.textContent = "🔨"; E.title.textContent = "Le village a tranché";
      const el = g.lastEliminated;
      E.text.textContent = el
        ? el.name + " (" + LOUP_ROLES[el.role].label + ") est éliminé."
        : "Égalité : personne n'est éliminé.";
      showAlive();
      if (g.winner) hostBtn("Voir le résultat 🏆", () => roomRef.update({ "game/phase": "over" }));
      else hostBtn("Nuit suivante 🌙", advanceToNextNight);
      break;
    }

    case "over":
      E.emoji.textContent = g.winner === "loups" ? "🐺" : "🎉";
      E.title.textContent = g.winner === "loups" ? "Victoire des Loups !" : "Victoire du Village !";
      show(E.aliveUl); E.aliveUl.innerHTML = "";
      ids.forEach((id) => {
        const li = document.createElement("li");
        li.innerHTML = "<span>" + players[id].name + "</span><span class='score'>" + LOUP_ROLES[roles[id]].label + "</span>";
        E.aliveUl.appendChild(li);
      });
      hostBtn("Retour au menu", backToMenu);
      break;
  }
}

// ----- Actions Loup-Garou -----
function wolfPick(id) { loupPicked = true; roomRef.child("game/wolfVotes/" + myId).set(id); }
function seerPick(id) {
  const role = currentRoom.game.roles[id];
  roomRef.update({ "game/seerResult": { target: id, role: role } });
}
function seerContinue() { roomRef.update({ "game/phase": "dayReveal", "game/seerResult": null }); }
function dayVotePick(id) { loupPicked = true; roomRef.child("game/dayVotes/" + myId).set(id); }

function advanceToNextNight() {
  const g = currentRoom.game;
  roomRef.update({
    "game/phase": "nightWolves", "game/nightNo": (g.nightNo || 1) + 1,
    "game/wolfVotes": null, "game/dayVotes": null,
    "game/seerResult": null, "game/nightVictim": null, "game/lastEliminated": null,
  });
}

// ----- Logique de l'hôte : résolutions -----
function majorityPick(votesObj) {
  const tally = {};
  Object.values(votesObj).forEach((t) => { tally[t] = (tally[t] || 0) + 1; });
  let max = 0, leaders = [];
  Object.keys(tally).forEach((id) => {
    if (tally[id] > max) { max = tally[id]; leaders = [id]; }
    else if (tally[id] === max) leaders.push(id);
  });
  return leaders;
}

function checkWinner(alive, roles, ids) {
  const wolves = ids.filter((id) => roles[id] === "loup" && alive[id] !== false).length;
  const others = ids.filter((id) => roles[id] !== "loup" && alive[id] !== false).length;
  if (wolves === 0) return "village";
  if (wolves >= others) return "loups";
  return null;
}

function awardLoup(updates, players, roles, winner) {
  Object.keys(players).forEach((id) => {
    const isWolf = roles[id] === "loup";
    const won = winner === "loups" ? isWolf : !isWolf;
    if (won) updates["players/" + id + "/score"] = (players[id].score || 0) + 150;
  });
}

function resolveNight(room) {
  const g = room.game;
  const players = room.players || {};
  const ids = Object.keys(players);
  const roles = g.roles || {};
  const alive = Object.assign({}, g.alive);
  const leaders = majorityPick(g.wolfVotes || {});
  const victimId = leaders[Math.floor(Math.random() * leaders.length)];
  alive[victimId] = false;

  const updates = {};
  updates["game/alive/" + victimId] = false;
  updates["game/nightVictim"] = { id: victimId, name: players[victimId].name, role: roles[victimId] };

  const winner = checkWinner(alive, roles, ids);
  if (winner) { updates["game/winner"] = winner; awardLoup(updates, players, roles, winner); }

  const seerAlive = g.settings.seer && ids.some((id) => roles[id] === "voyante" && alive[id] !== false);
  updates["game/phase"] = (!winner && seerAlive) ? "nightSeer" : "dayReveal";
  roomRef.update(updates);
}

function resolveDayVote(room) {
  const g = room.game;
  const players = room.players || {};
  const ids = Object.keys(players);
  const roles = g.roles || {};
  const alive = Object.assign({}, g.alive);
  const leaders = majorityPick(g.dayVotes || {});

  const updates = {};
  if (leaders.length === 1) {
    const elimId = leaders[0];
    alive[elimId] = false;
    updates["game/alive/" + elimId] = false;
    updates["game/lastEliminated"] = { id: elimId, name: players[elimId].name, role: roles[elimId] };
  } else {
    updates["game/lastEliminated"] = null;
  }
  const winner = checkWinner(alive, roles, ids);
  if (winner) { updates["game/winner"] = winner; awardLoup(updates, players, roles, winner); }
  updates["game/phase"] = "dayResult";
  roomRef.update(updates);
}

function loupHostLogic(room) {
  const g = room.game;
  const players = room.players || {};
  const ids = Object.keys(players);
  const roles = g.roles || {};
  const alive = g.alive || {};
  const aliveIds = ids.filter((id) => alive[id] !== false);
  const wolvesAlive = ids.filter((id) => roles[id] === "loup" && alive[id] !== false);

  if (g.phase === "nightWolves") {
    const wv = g.wolfVotes || {};
    if (wolvesAlive.length > 0 && wolvesAlive.every((id) => wv[id])) resolveNight(room);
  } else if (g.phase === "dayVote") {
    const dv = g.dayVotes || {};
    if (aliveIds.length > 0 && aliveIds.every((id) => dv[id])) resolveDayVote(room);
  }
}

// =====================================================================
//  LOGIQUE DE L'HÔTE (aiguillage)
// =====================================================================
function hostLogic(room) {
  if (room.status !== "playing" || !room.game) return;
  if (room.game.name === "intrus") intrusHostLogic(room);
  else if (room.game.name === "quiz") quizHostLogic(room);
  else if (room.game.name === "repliques") repHostLogic(room);
  else if (room.game.name === "loup") loupHostLogic(room);
}

// =====================================================================
//  BOUTONS
// =====================================================================
function hostOrWait(btnId, hintId, waitMsg) {
  if (isHost) { show($(btnId)); $(hintId).textContent = ""; }
  else { hide($(btnId)); $(hintId).textContent = waitMsg; }
}

function backToMenu() {
  roomRef.update({ status: "lobby", game: null });
}

function wireButtons() {
  // Menu des jeux
  document.querySelectorAll(".game-choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const game = btn.getAttribute("data-game");
      if (game === "intrus") startIntrus();
      else if (game === "quiz") startQuiz();
      else if (game === "repliques") startRepliques();
      else if (game === "loup") startLoup();
    });
  });
  // Intrus
  $("btn-role-ok").addEventListener("click", () => { roleAck = true; render(currentRoom); });
  $("btn-clue").addEventListener("click", submitClue);
  $("input-clue").addEventListener("keydown", (e) => { if (e.key === "Enter") submitClue(); });
  // (btn-menu-1 : son action est définie dynamiquement dans renderReveal)
  // Quiz
  $("btn-quiz-next").addEventListener("click", nextQuizStep);
  $("btn-menu-2").addEventListener("click", backToMenu);
  // Répliques
  $("btn-rep-send").addEventListener("click", submitRepAnswer);
  $("input-rep").addEventListener("keydown", (e) => { if (e.key === "Enter") submitRepAnswer(); });
  $("btn-rep-next").addEventListener("click", nextRepStep);
  // Son (activer / couper)
  $("btn-sound").addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("pg_sound", soundOn ? "on" : "off");
    $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
    if (soundOn) soundPop();
  });
  if (!soundOn) $("btn-sound").textContent = "🔇";
  // Quitter
  $("btn-leave").addEventListener("click", leaveRoom);
}
