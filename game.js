// Prosta gra „Escape Room: Release Day"

const state = {
  teamName: "",
  mode: "solo",
  sprint: 1,
  score: 0,
  timerSeconds: 10 * 60, // 10 minut
  timerId: null,
  startTimestamp: null,
  backlogItems: [],
  stories: [],
  finished: false,
  // Multiplayer
  socket: null,
  roomId: null,
  opponentName: null,
  opponentScore: 0,
  isHost: false,
  multiplayerReady: false,
};

// Dane przykładowe
const BACKLOG_ITEMS = [
  {
    id: "pb-login-ui",
    title: "Jako użytkownik mogę zobaczyć formularz logowania",
    points: 5,
    priority: "High",
    mustHave: true,
  },
  {
    id: "pb-reset-pass",
    title: "Jako użytkownik mogę zresetować hasło przez e-mail",
    points: 8,
    priority: "High",
    mustHave: true,
  },
  {
    id: "pb-dark-mode",
    title: "Jako użytkownik mogę włączyć dark mode",
    points: 3,
    priority: "Low",
    mustHave: false,
  },
  {
    id: "pb-fancy-anim",
    title: "Animacje 3D przy logowaniu",
    points: 5,
    priority: "Low",
    mustHave: false,
  },
  {
    id: "pb-analytics",
    title: "Zbieranie metryk logowania (analytics)",
    points: 5,
    priority: "Medium",
    mustHave: false,
  },
];

const STORIES = [
  {
    id: "st-login-ok",
    text: "Jako użytkownik mogę zalogować się poprawnym hasłem",
    matchesGoal: true,
  },
  {
    id: "st-login-lock",
    text: "Konto blokuje się po 5 nieudanych próbach logowania",
    matchesGoal: true,
  },
  {
    id: "st-reset-email",
    text: "Otrzymuję e-mail z linkiem do resetu hasła",
    matchesGoal: true,
  },
  {
    id: "st-profile-avatar",
    text: "Mogę ustawić awatar w profilu",
    matchesGoal: false,
  },
  {
    id: "st-theme-custom",
    text: "Mogę zmienić kolor motywu aplikacji",
    matchesGoal: false,
  },
];

// Utils
function $(selector) {
  return document.querySelector(selector);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Aktualizuj wyświetlanie wyniku i wyślij do serwera (jeśli multiplayer)
function updateScoreDisplay() {
  $("#hud-score").textContent = state.score.toString();
  sendScoreUpdate();
}

function sendScoreUpdate() {
  if (state.mode === "multiplayer" && state.socket && state.roomId) {
    state.socket.emit("scoreUpdate", {
      roomId: state.roomId,
      score: state.score,
    });
  }
}

// Inicjalizacja UI
function init() {
  bindStartScreen();
  buildBacklog();
  buildStories();
  bindBacklogLogic();
  bindStoriesLogic();
  bindConflictRoom();
  bindRestart();
  bindRanking();
  bindMultiplayer();
}

function bindStartScreen() {
  const btnStart = $("#btn-start");
  btnStart.addEventListener("click", () => {
    const teamNameInput = $("#team-name");
    const modeSelect = $("#mode-select");
    const name = teamNameInput.value.trim() || "Anonimowy Zespół";
    state.teamName = name;
    state.mode = modeSelect.value;
    state.startTimestamp = Date.now();
    state.finished = false;

    if (state.mode === "multiplayer") {
      // Przejdź do ekranu multiplayer
      $("#screen-start").classList.remove("active");
      $("#screen-multiplayer").classList.add("active");
      initMultiplayer();
      return;
    }

    $("#hud-team").textContent = name;
    $("#hud-score").textContent = "0";
    $("#hud-sprint").textContent = "1";
    $("#hud-timer").textContent = formatTime(state.timerSeconds);
    $("#hud-multiplayer").classList.add("hidden");

    $("#screen-start").classList.remove("active");
    $("#screen-game").classList.add("active");
    $("#hud").classList.remove("hidden");

    startTimer();
  });
}

// Timer & zakończenie gry
function startTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = setInterval(() => {
    if (state.finished) {
      clearInterval(state.timerId);
      return;
    }
    state.timerSeconds -= 1;
    if (state.timerSeconds < 0) {
      state.timerSeconds = 0;
      $("#hud-timer").textContent = formatTime(state.timerSeconds);
      endGame(false, "Czas minął! Release poszedł bez pełnego przygotowania.");
      clearInterval(state.timerId);
      return;
    }
    $("#hud-timer").textContent = formatTime(state.timerSeconds);
  }, 1000);
}

function endGame(success, reason) {
  if (state.finished) return;
  state.finished = true;

  const elapsedSeconds =
    10 * 60 - state.timerSeconds >= 0 ? 10 * 60 - state.timerSeconds : 0;

  // Multiplayer - wyślij wynik i czekaj na wynik przeciwnika
  if (state.mode === "multiplayer" && state.socket) {
    state.socket.emit("gameFinished", {
      roomId: state.roomId,
      teamName: state.teamName,
      score: state.score,
      time: elapsedSeconds,
    });
    // Pokaż ekran oczekiwania na przeciwnika
    showWaitingForOpponent();
    return; // Nie pokazuj ekranu końcowego jeszcze
  }

  // Solo/Versus - pokaż wynik od razu
  showEndScreen(success, reason, elapsedSeconds);
}

function showWaitingForOpponent() {
  $("#screen-game").classList.remove("active");
  $("#screen-end").classList.add("active");
  $("#hud").classList.add("hidden");

  const endTitle = $("#end-title");
  const endSummary = $("#end-summary");
  const endTeam = $("#end-team");
  const endScore = $("#end-score");
  const endTime = $("#end-time");

  endTeam.textContent = state.teamName;
  endScore.textContent = state.score.toString();
  endTime.textContent = formatTime(
    10 * 60 - state.timerSeconds >= 0 ? 10 * 60 - state.timerSeconds : 0
  );

  endTitle.textContent = "Ukończyłeś grę!";
  endSummary.textContent =
    "Czekasz na zakończenie gry przez przeciwnika...";

  $("#end-multiplayer-result").classList.add("hidden");
  $("#end-waiting-opponent").classList.remove("hidden");
}

function showEndScreen(success, reason, elapsedSeconds) {
  $("#screen-game").classList.remove("active");
  $("#screen-end").classList.add("active");
  $("#hud").classList.add("hidden");

  const endTitle = $("#end-title");
  const endSummary = $("#end-summary");
  const endTeam = $("#end-team");
  const endScore = $("#end-score");
  const endTime = $("#end-time");

  endTeam.textContent = state.teamName;
  endScore.textContent = state.score.toString();
  endTime.textContent = formatTime(elapsedSeconds);

  // Zapisz wynik
  saveScore(state.teamName, state.score, elapsedSeconds, state.mode);

  if (success) {
    endTitle.textContent = "Gratulacje! Uciekłeś przed Release Day!";
    endSummary.textContent =
      reason ||
      "Twój zespół wykorzystał praktyki Scrum, aby bezpiecznie dowieźć release.";
  } else {
    endTitle.textContent = "Nie udało się uciec przed deadlinem…";
    endSummary.textContent =
      reason ||
      "To dobra okazja, by zastanowić się, jak lepiej planować Sprint i chronić jakość.";
  }

  $("#end-multiplayer-result").classList.add("hidden");
}

function showMultiplayerResult(result) {
  // Upewnij się, że ekran końcowy jest widoczny
  $("#screen-game").classList.remove("active");
  $("#screen-end").classList.add("active");
  $("#hud").classList.add("hidden");

  // Ukryj ekran oczekiwania
  $("#end-waiting-opponent").classList.add("hidden");

  const endOpponentName = $("#end-opponent-name");
  const endOpponentScore = $("#end-opponent-score");
  const endOpponentTime = $("#end-opponent-time");
  const endWinner = $("#end-winner");
  const multiplayerResult = $("#end-multiplayer-result");
  const endTeam = $("#end-team");
  const endScore = $("#end-score");
  const endTime = $("#end-time");
  const endTitle = $("#end-title");
  const endSummary = $("#end-summary");

  // Zaktualizuj własne wyniki
  endTeam.textContent = state.teamName;
  endScore.textContent = result.myScore.toString();
  endTime.textContent = formatTime(result.myTime);

  // Zaktualizuj wyniki przeciwnika
  endOpponentName.textContent = result.opponentName || "—";
  endOpponentScore.textContent = result.opponentScore.toString();
  if (endOpponentTime) {
    endOpponentTime.textContent = formatTime(result.opponentTime);
  }

  // Określ zwycięzcę i zaktualizuj tytuł
  if (result.isDraw) {
    endWinner.textContent = "🤝 Remis!";
    endWinner.style.color = "#fbbf24";
    endTitle.textContent = "Remis!";
    endSummary.textContent = "Oba zespoły osiągnęły identyczny wynik.";
  } else if (result.isWinner) {
    endWinner.textContent = "🏆 Wygrałeś!";
    endWinner.style.color = "#4ade80";
    endTitle.textContent = "Gratulacje! Wygrałeś!";
    endSummary.textContent = "Twój zespół pokonał przeciwnika w Escape Room: Release Day!";
  } else {
    endWinner.textContent = "Przegrałeś. Spróbuj ponownie!";
    endWinner.style.color = "#fb7185";
    endTitle.textContent = "Przegrana";
    endSummary.textContent = "Przeciwnik zdobył więcej punktów lub ukończył szybciej. Spróbuj ponownie!";
  }

  // Usuń poprzedni powód jeśli istnieje
  const existingReason = multiplayerResult.querySelector(".result-reason");
  if (existingReason) {
    existingReason.remove();
  }

  // Pokaż powód wygranej/przegranej
  if (result.reason) {
    const reasonText = document.createElement("p");
    reasonText.className = "result-reason";
    reasonText.textContent = `Powód: ${result.reason}`;
    multiplayerResult.appendChild(reasonText);
  }

  multiplayerResult.classList.remove("hidden");

  // Zapisz wynik do rankingu
  saveScore(state.teamName, result.myScore, result.myTime, state.mode);
}

// Pokój 1 – Sprint Backlog
function buildBacklog() {
  state.backlogItems = BACKLOG_ITEMS.map((i) => ({ ...i }));
  const productList = $("#product-backlog");
  productList.innerHTML = "";

  state.backlogItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "card";
    li.draggable = true;
    li.dataset.id = item.id;
    li.dataset.points = String(item.points);
    li.dataset.mustHave = String(item.mustHave);

    li.innerHTML = `
      <div class="card-title">${item.title}</div>
      <div class="card-meta">
        <span class="points-pill">${item.points} SP</span>
        <span class="prio-pill">${item.priority}</span>
      </div>
    `;
    productList.appendChild(li);
  });

  initDragAndDrop();
  updateSprintPoints();
}

function bindBacklogLogic() {
  const btnValidate = $("#btn-validate-backlog");
  const feedback = $("#feedback-backlog");

  btnValidate.addEventListener("click", () => {
    const sprintList = $("#sprint-backlog");
    const cards = Array.from(sprintList.querySelectorAll(".card"));
    const maxPoints = Number(sprintList.dataset.maxPoints || "20");

    let totalSp = 0;
    let allMustHaveIncluded = true;

    cards.forEach((el) => {
      totalSp += Number(el.dataset.points || "0");
    });

    BACKLOG_ITEMS.forEach((item) => {
      if (item.mustHave) {
        const present = cards.some((el) => el.dataset.id === item.id);
        if (!present) allMustHaveIncluded = false;
      }
    });

    if (!allMustHaveIncluded) {
      feedback.textContent =
        "Nie wszystkie kluczowe elementy (must have) trafiły do Sprint Backlogu.";
      feedback.className = "feedback error";
      state.score -= 5;
    } else if (totalSp > maxPoints) {
      feedback.textContent =
        "Sprint jest przeładowany. Zespół nie ma szans zrealizować tylu punktów.";
      feedback.className = "feedback error";
      state.score -= 3;
    } else if (totalSp < 8) {
      feedback.textContent =
        "Sprint jest zbyt mały – zespół nie wykorzysta efektywnie swojego czasu.";
      feedback.className = "feedback error";
      state.score -= 2;
    } else {
      feedback.textContent =
        "Świetnie! Sprint Backlog zawiera najważniejsze elementy w realistycznym zakresie.";
      feedback.className = "feedback ok";
      state.score += 15;
      goToRoom("stories");
    }

    updateScoreDisplay();
  });
}

function updateSprintPoints() {
  const sprintList = $("#sprint-backlog");
  const cards = Array.from(sprintList.querySelectorAll(".card"));
  let total = 0;
  cards.forEach((el) => {
    total += Number(el.dataset.points || "0");
  });
  $("#current-points").textContent = String(total);
}

// Pokój 2 – User Stories
function buildStories() {
  state.stories = STORIES.map((s) => ({ ...s }));
  const pool = $("#stories-pool");
  pool.innerHTML = "";

  state.stories.forEach((st) => {
    const li = document.createElement("li");
    li.className = "card";
    li.draggable = true;
    li.dataset.id = st.id;
    li.dataset.matchesGoal = String(st.matchesGoal);
    li.innerHTML = `
      <div class="card-title">${st.text}</div>
    `;
    pool.appendChild(li);
  });

  initDragAndDrop();
}

function bindStoriesLogic() {
  const btnValidate = $("#btn-validate-stories");
  const feedback = $("#feedback-stories");

  btnValidate.addEventListener("click", () => {
    const sprintList = $("#stories-sprint");
    const laterList = $("#stories-later");
    const inSprint = Array.from(sprintList.querySelectorAll(".card"));
    const later = Array.from(laterList.querySelectorAll(".card"));

    let correct = 0;
    let total = state.stories.length;

    inSprint.forEach((el) => {
      if (el.dataset.matchesGoal === "true") correct++;
    });
    later.forEach((el) => {
      if (el.dataset.matchesGoal === "false") correct++;
    });

    if (correct === total) {
      feedback.textContent =
        "Idealnie! Wszystkie User Stories są zgodne z celem Sprintu.";
      feedback.className = "feedback ok";
      state.score += 15;
      updateScoreDisplay();
      goToRoom("conflict");
    } else {
      feedback.textContent = `Poprawnie sklasyfikowano ${correct} z ${total} historii. Spróbuj jeszcze raz – myśl o wartości względem celu Sprintu.`;
      feedback.className = "feedback error";
      state.score -= 3;
      updateScoreDisplay();
    }
  });
}

// Pokój 3 – Konflikt PO–Dev
function bindConflictRoom() {
  const buttons = document.querySelectorAll(".choice-btn");
  const feedback = $("#feedback-conflict");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.choice;

      buttons.forEach((b) => {
        b.classList.remove("correct", "wrong");
      });

      if (choice === "increment") {
        btn.classList.add("correct");
        feedback.textContent =
          "Brawo! Wydanie tylko ukończonego, przetestowanego Inkrementu jest zgodne ze Scrumem i chroni jakość.";
        feedback.className = "feedback ok";
        state.score += 20;
        updateScoreDisplay();
        endGame(true);
      } else if (choice === "delay") {
        btn.classList.add("wrong");
        feedback.textContent =
          "Przesunięcie release'u bywa konieczne, ale w Scrumie kluczowe jest dostarczenie działającego Inkrementu w rytmie Sprintów.";
        feedback.className = "feedback error";
        state.score += 5;
        updateScoreDisplay();
        endGame(true, "Udało się dowieźć release, ale z opóźnieniem – warto lepiej planować Sprinty.");
      } else {
        btn.classList.add("wrong");
        feedback.textContent =
          "To podejście narusza zasady jakości i przejrzystości w Scrumie. Zastanów się, jak chronić użytkownika i produkt.";
        feedback.className = "feedback error";
        state.score -= 8;
        updateScoreDisplay();
      }
    });
  });
}

// Drag & Drop dla backlogu i stories
function initDragAndDrop() {
  const cards = document.querySelectorAll(".card");
  const droppables = document.querySelectorAll(".droppable, #product-backlog, #stories-pool");

  cards.forEach((card) => {
    card.addEventListener("dragstart", () => {
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      updateSprintPoints();
    });
  });

  droppables.forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".card.dragging");
      if (!dragging) return;
      zone.classList.remove("drag-over");

      // Prosta logika – zawsze można przenieść
      zone.appendChild(dragging);
      updateSprintPoints();
    });
  });
}

// Przejścia między pokojami
function goToRoom(key) {
  const rooms = document.querySelectorAll(".room");
  rooms.forEach((r) => r.classList.remove("active"));

  if (key === "stories") {
    $("#room-stories").classList.add("active");
    state.sprint = 2;
  } else if (key === "conflict") {
    $("#room-conflict").classList.add("active");
    state.sprint = 3;
  } else {
    $("#room-backlog").classList.add("active");
    state.sprint = 1;
  }

  $("#hud-sprint").textContent = state.sprint.toString();
}

// Restart gry
function bindRestart() {
  const btnRestart = $("#btn-restart");
  btnRestart.addEventListener("click", () => {
    // Reset stanu
    state.score = 0;
    state.sprint = 1;
    state.timerSeconds = 10 * 60;
    state.finished = false;

    $("#hud-score").textContent = "0";
    $("#hud-sprint").textContent = "1";

    // Reset UI
    $("#screen-end").classList.remove("active");
    $("#screen-start").classList.add("active");

    // Opróżnij listy i zbuduj na nowo
    $("#sprint-backlog").innerHTML = "";
    $("#stories-sprint").innerHTML = "";
    $("#stories-later").innerHTML = "";
    buildBacklog();
    buildStories();
    $("#feedback-backlog").textContent = "";
    $("#feedback-backlog").className = "feedback";
    $("#feedback-stories").textContent = "";
    $("#feedback-stories").className = "feedback";
    $("#feedback-conflict").textContent = "";
    $("#feedback-conflict").className = "feedback";
  });
}

// Ranking - zapisywanie i wyświetlanie (MySQL przez API)
async function saveScore(teamName, score, time, mode) {
  try {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName,
        score,
        time,
        mode,
      }),
    });

    if (!response.ok) {
      console.error("Błąd zapisywania wyniku:", response.statusText);
      // Fallback do localStorage jeśli API nie działa
      saveScoreLocalStorage(teamName, score, time, mode);
      return;
    }

    const result = await response.json();
    console.log("Wynik zapisany:", result);
  } catch (error) {
    console.error("Błąd zapisywania wyniku:", error);
    // Fallback do localStorage jeśli API nie działa
    saveScoreLocalStorage(teamName, score, time, mode);
  }
}

async function getScores(sortBy = "score") {
  try {
    const response = await fetch(`/api/scores?sort=${sortBy}`);
    
    if (!response.ok) {
      console.error("Błąd pobierania wyników:", response.statusText);
      // Fallback do localStorage
      return getScoresLocalStorage();
    }

    const data = await response.json();
    return data.scores || [];
  } catch (error) {
    console.error("Błąd pobierania wyników:", error);
    // Fallback do localStorage
    return getScoresLocalStorage();
  }
}

// Fallback do localStorage (dla kompatybilności wstecznej)
function saveScoreLocalStorage(teamName, score, time, mode) {
  const scores = getScoresLocalStorage();
  scores.push({
    teamName,
    score,
    time,
    mode,
    date: new Date().toISOString(),
  });
  localStorage.setItem("escapeRoomScores", JSON.stringify(scores));
}

function getScoresLocalStorage() {
  const stored = localStorage.getItem("escapeRoomScores");
  return stored ? JSON.parse(stored) : [];
}

function bindRanking() {
  const btnRanking = $("#btn-ranking");
  const btnRankingFromEnd = $("#btn-ranking-from-end");
  const btnBackFromRanking = $("#btn-back-from-ranking");
  const rankingSort = $("#ranking-sort");

  btnRanking.addEventListener("click", () => {
    showRanking();
  });

  btnRankingFromEnd.addEventListener("click", () => {
    showRanking();
  });

  btnBackFromRanking.addEventListener("click", () => {
    $("#screen-ranking").classList.remove("active");
    $("#screen-start").classList.add("active");
  });

  rankingSort.addEventListener("change", () => {
    showRanking();
  });
}

async function showRanking() {
  $("#screen-start").classList.remove("active");
  $("#screen-end").classList.remove("active");
  $("#screen-game").classList.remove("active");
  $("#screen-multiplayer").classList.remove("active");
  $("#screen-ranking").classList.add("active");

  const sortBy = $("#ranking-sort").value;
  const tbody = $("#ranking-tbody");
  const emptyMsg = $("#ranking-empty");

  // Pokaż wskaźnik ładowania
  tbody.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px;'>Ładowanie wyników...</td></tr>";

  try {
    const scores = await getScores(sortBy);

    if (scores.length === 0) {
      tbody.innerHTML = "";
      emptyMsg.classList.remove("hidden");
      return;
    }

    emptyMsg.classList.add("hidden");
    tbody.innerHTML = "";

    scores.forEach((entry, index) => {
      const tr = document.createElement("tr");
      const date = new Date(entry.date);
      const dateStr = date.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const modeLabel =
        entry.mode === "multiplayer" ? "Multiplayer" : entry.mode === "versus" ? "Versus" : "Solo";

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.teamName}</td>
        <td>${entry.score}</td>
        <td>${formatTime(entry.time)}</td>
        <td>${dateStr}</td>
        <td>${modeLabel}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Błąd wyświetlania rankingu:", error);
    tbody.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px; color: #fb7185;'>Błąd ładowania wyników</td></tr>";
  }
}

// Multiplayer
function initMultiplayer() {
  // Sprawdź, czy Socket.io jest dostępny
  if (typeof io === "undefined") {
    $("#multiplayer-status-text").textContent =
      "Socket.io nie jest załadowany. Upewnij się, że otwierasz grę przez serwer (http://localhost:3001), a nie bezpośrednio plik HTML.";
    $("#multiplayer-status").style.borderColor = "#fb7185";
    return;
  }

  // Sprawdź, czy otwieramy przez serwer (nie file://)
  if (window.location.protocol === "file:") {
    $("#multiplayer-status-text").textContent =
      "Multiplayer wymaga serwera. Uruchom: npm start, a następnie otwórz http://localhost:3001";
    $("#multiplayer-status").style.borderColor = "#fb7185";
    return;
  }

  // Spróbuj połączyć z Socket.io
  try {
    // Użyj aktualnego hosta i portu
    const socketUrl = window.location.origin;
    console.log("Łączenie z Socket.io:", socketUrl);
    
    state.socket = io(socketUrl, {
      transports: ["polling"], // Polling najpierw, potem websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false,
    });
    
    setupSocketListeners();
  } catch (e) {
    console.error("Błąd inicjalizacji Socket.io:", e);
    $("#multiplayer-status-text").textContent =
      "Błąd połączenia: " + (e.message || "Nieznany błąd");
    $("#multiplayer-status").style.borderColor = "#fb7185";
  }
}

function setupSocketListeners() {
  if (!state.socket) return;

  state.socket.on("connect", () => {
    console.log("Połączono z serwerem Socket.io");
    $("#multiplayer-status-text").textContent = "Połączono z serwerem";
    $("#multiplayer-status").style.borderColor = "#4ade80";
  });

  state.socket.on("connect_error", (error) => {
    console.error("Błąd połączenia Socket.io:", error);
    $("#multiplayer-status-text").textContent =
      "Nie można połączyć z serwerem. Upewnij się, że serwer działa (npm start)";
    $("#multiplayer-status").style.borderColor = "#fb7185";
  });

  state.socket.on("disconnect", (reason) => {
    console.log("Rozłączono z serwerem:", reason);
    $("#multiplayer-status-text").textContent = "Rozłączono z serwerem";
    $("#multiplayer-status").style.borderColor = "#fb7185";
  });

  state.socket.on("error", (error) => {
    console.error("Błąd Socket.io:", error);
    $("#multiplayer-status-text").textContent =
      "Błąd: " + (error.message || "Nieznany błąd");
    $("#multiplayer-status").style.borderColor = "#fb7185";
  });

  state.socket.on("roomCreated", (data) => {
    state.roomId = data.roomId;
    state.isHost = true;
    $("#mp-room-id").textContent = data.roomId;
    $("#mp-room-id-display").classList.remove("hidden");
    $("#multiplayer-create").classList.add("hidden");
    $("#multiplayer-waiting").classList.remove("hidden");
    $("#mp-waiting-room-id").textContent = data.roomId;
    $("#mp-waiting-team-name").textContent = state.teamName;
  });

  state.socket.on("roomJoined", (data) => {
    state.roomId = data.roomId;
    state.isHost = false;
    $("#multiplayer-join").classList.add("hidden");
    $("#multiplayer-waiting").classList.remove("hidden");
    $("#mp-waiting-room-id").textContent = data.roomId;
    $("#mp-waiting-team-name").textContent = state.teamName;
  });

  state.socket.on("opponentJoined", (data) => {
    state.opponentName = data.opponentName;
    $("#multiplayer-waiting").classList.add("hidden");
    $("#multiplayer-ready").classList.remove("hidden");
    $("#mp-ready-opponent").textContent = data.opponentName;
    state.multiplayerReady = true;
  });

  state.socket.on("gameStart", () => {
    startMultiplayerGame();
  });

  state.socket.on("opponentUpdate", (data) => {
    state.opponentScore = data.score || 0;
    $("#hud-opponent-score").textContent = state.opponentScore.toString();
  });

  state.socket.on("opponentFinished", (data) => {
    // Przeciwnik ukończył, ale jeszcze czekamy na wynik końcowy
    if (data.waiting) {
      // Tylko zaktualizuj HUD, ale nie pokazuj wyniku jeszcze
      state.opponentScore = data.score || 0;
      state.opponentName = data.teamName || state.opponentName;
      $("#hud-opponent-score").textContent = state.opponentScore.toString();
    }
  });

  state.socket.on("gameResult", (result) => {
    // Otrzymaliśmy końcowy wynik - obie drużyny ukończyły
    console.log("Otrzymano wynik końcowy:", result);
    showMultiplayerResult(result);
  });
}

function bindMultiplayer() {
  const btnCreateRoom = $("#btn-create-room");
  const btnJoinRoom = $("#btn-join-room");
  const btnStartMultiplayer = $("#btn-start-multiplayer");
  const btnBackFromMultiplayer = $("#btn-back-from-multiplayer");
  const btnCopyRoomId = $("#btn-copy-room-id");

  btnCreateRoom.addEventListener("click", () => {
    const teamName = $("#mp-team-name").value.trim() || "Zespół 1";
    state.teamName = teamName;
    if (state.socket) {
      state.socket.emit("createRoom", { teamName });
    }
  });

  btnJoinRoom.addEventListener("click", () => {
    const teamName = $("#mp-join-team-name").value.trim() || "Zespół 2";
    const roomId = $("#mp-join-room-id").value.trim();
    if (!roomId) {
      alert("Podaj ID pokoju");
      return;
    }
    state.teamName = teamName;
    if (state.socket) {
      state.socket.emit("joinRoom", { roomId, teamName });
    }
  });

  btnStartMultiplayer.addEventListener("click", () => {
    if (state.socket && state.isHost) {
      state.socket.emit("startGame", { roomId: state.roomId });
    }
  });

  btnBackFromMultiplayer.addEventListener("click", () => {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    $("#screen-multiplayer").classList.remove("active");
    $("#screen-start").classList.add("active");
    resetMultiplayerState();
  });

  btnCopyRoomId.addEventListener("click", () => {
    const roomId = $("#mp-room-id").textContent;
    navigator.clipboard.writeText(roomId).then(() => {
      btnCopyRoomId.textContent = "Skopiowano!";
      setTimeout(() => {
        btnCopyRoomId.textContent = "Kopiuj";
      }, 2000);
    });
  });
}

function resetMultiplayerState() {
  state.roomId = null;
  state.opponentName = null;
  state.opponentScore = 0;
  state.isHost = false;
  state.multiplayerReady = false;
  $("#multiplayer-create").classList.remove("hidden");
  $("#multiplayer-join").classList.remove("hidden");
  $("#multiplayer-waiting").classList.add("hidden");
  $("#multiplayer-ready").classList.add("hidden");
  $("#mp-room-id-display").classList.add("hidden");
}

function startMultiplayerGame() {
  $("#screen-multiplayer").classList.remove("active");
  $("#screen-game").classList.add("active");
  $("#hud").classList.remove("hidden");
  $("#hud-multiplayer").classList.remove("hidden");

  $("#hud-team").textContent = state.teamName;
  $("#hud-opponent-name").textContent = state.opponentName || "—";
  $("#hud-opponent-score").textContent = "0";
  $("#hud-score").textContent = "0";
  $("#hud-sprint").textContent = "1";
  $("#hud-timer").textContent = formatTime(state.timerSeconds);

  state.startTimestamp = Date.now();
  state.finished = false;
  state.score = 0;
  state.sprint = 1;
  state.timerSeconds = 10 * 60;

  // Reset pokoi
  $("#sprint-backlog").innerHTML = "";
  $("#stories-sprint").innerHTML = "";
  $("#stories-later").innerHTML = "";
  buildBacklog();
  buildStories();

  startTimer();
}


document.addEventListener("DOMContentLoaded", init);


