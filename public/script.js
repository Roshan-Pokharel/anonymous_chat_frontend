// Establish connection to the Socket.IO server
const socket = io("https://anonymous-chat-backend-1.onrender.com");

// --- DOM Element Selectors ---
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const userList = document.getElementById("userList");
const roomTitle = document.getElementById("roomTitle");
const showUsersBtn = document.getElementById("showUsersBtn");
const themeToggleBtn = document.getElementById("theme-toggle");
const typingIndicator = document.getElementById("typing-indicator");
const errorMessage = document.getElementById("error-message");
const backgroundOptionsContainer = document.getElementById("backgroundOptions");

// Modal elements
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");
const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");
const createGameModal = document.getElementById("createGameModal");
const createGameForm = document.getElementById("createGameForm");
const roomNameInput = document.getElementById("roomNameInput");
const cancelCreateGameBtn = document.getElementById("cancelCreateGameBtn");
const scoreboardModal = document.getElementById("scoreboardModal");
const scoreboardTitle = document.getElementById("scoreboardTitle");
const finalScores = document.getElementById("finalScores");
const closeScoreboardBtn = document.getElementById("closeScoreboardBtn");

// Mobile Modal Tab elements
const mobileModalNav = document.getElementById("mobileModalNav");
const modalTabs = document.querySelectorAll(".modal-tab-content");
const backgroundOptionsMobileContainer = document.getElementById(
  "backgroundOptionsMobile"
);

// Game Elements
const gameContainer = document.getElementById("gameContainer");
const gameCanvas = document.getElementById("gameCanvas");
const gameInfo = document.getElementById("gameInfo");
const drawingTools = document.getElementById("drawingTools");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const gameOverlayMessage = document.getElementById("gameOverlayMessage");
const createGameRoomBtnDesktop = document.getElementById(
  "createGameRoomBtnDesktop"
);
const createGameRoomBtnMobile = document.getElementById(
  "createGameRoomBtnMobile"
);
const gameRoomListDesktop = document.getElementById("gameRoomListDesktop");
const gameRoomListMobile = document.getElementById("gameRoomListMobile");
const startGameBtn = document.getElementById("startGameBtn");
const stopGameBtn = document.getElementById("stopGameBtn");
const startGameBtnMobile = document.getElementById("startGameBtnMobile");
const stopGameBtnMobile = document.getElementById("stopGameBtnMobile");

// --- Application & Game State ---
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = null; // FIX: Initialize currentRoom to null
let myId = null;
let isTyping = false;
let typingTimer;
const TYPING_TIMER_LENGTH = 1500;

// Canvas/Drawing State
const ctx = gameCanvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentGameState = {};
let overlayTimer;

// --- PREDEFINED BACKGROUNDS (Client-side) ---
const predefinedBackgrounds = [
  "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=1374&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1575&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1332&auto=format&fit=crop",
];

// --- Initialization ---
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);
  const savedBackground = localStorage.getItem("chatBackground");
  if (savedBackground) applyBackground(savedBackground);
  adjustHeightForKeyboard();
  populateBackgroundOptions(backgroundOptionsContainer);
  setupCanvas();
});
window.addEventListener("resize", () => {
  adjustHeightForKeyboard();
  setupCanvas();
});

// --- Event Listeners ---
input.addEventListener("input", () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", { room: currentRoom });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
  }, TYPING_TIMER_LENGTH);
});

themeToggleBtn.addEventListener("click", () => {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const newTheme = isDarkMode ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("chatTheme", newTheme);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit("chat message", { room: currentRoom, text: input.value });
    clearTimeout(typingTimer);
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
    input.value = "";
    setTimeout(() => input.focus(), 10);
  }
});

showUsersBtn.onclick = () => {
  populateBackgroundOptions(backgroundOptionsMobileContainer);
  allUsersModal.style.display = "flex";
  updateGameButtonVisibility(currentGameState);
};

allUsersModal.addEventListener("click", (e) => {
  if (e.target === allUsersModal) allUsersModal.style.display = "none";
});
scoreboardModal.addEventListener("click", (e) => {
  if (e.target === scoreboardModal) scoreboardModal.style.display = "none";
});
closeScoreboardBtn.onclick = () => (scoreboardModal.style.display = "none");

mobileModalNav.addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const tabName = e.target.dataset.tab;
  document
    .querySelectorAll(".modal-nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");
  modalTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.id === `${tabName}Tab`);
  });
});

// --- Socket Event Handlers ---
socket.on("connect", () => {
  myId = socket.id;
  showUserModal();
});

socket.on("typing", ({ name, room }) => {
  if (room === currentRoom) {
    typingIndicator.textContent = `${name} is typing...`;
    typingIndicator.style.opacity = "1";
  }
});
socket.on("stop typing", ({ room }) => {
  if (room === currentRoom) {
    typingIndicator.textContent = "";
    typingIndicator.style.opacity = "0";
  }
});
socket.on("user list", (users) => {
  latestUsers = users;
  updateUserList();
});
socket.on("room history", (msgs) => {
  messages.innerHTML = "";
  msgs.forEach(addMessage);
});
socket.on("rate limit", (msg) => displayError(msg));
socket.on("message was read", ({ room, messageId }) => {
  if (room === currentRoom) {
    const msgEl = document.querySelector(
      `.msg[data-message-id="${messageId}"] .read-receipt`
    );
    if (msgEl) {
      msgEl.textContent = "✓✓";
      msgEl.classList.add("read");
    }
  }
});

socket.on("chat message", (msg) => {
  const isGameRoom = currentRoom.startsWith("game-");
  if (msg.room === currentRoom) {
    typingIndicator.textContent = "";
    typingIndicator.style.opacity = "0";
    addMessage(msg);
    if (!isGameRoom && msg.room !== "public") {
      const otherId = msg.id === myId ? msg.to : msg.id;
      delete unreadPrivate[otherId];
      updateUserList();
    }
  } else if (!isGameRoom && msg.room !== "public" && msg.to === myId) {
    unreadPrivate[msg.id] = true;
    updateUserList();
  }
});

// --- Core Functions ---
function showUserModal() {
  userModal.style.display = "flex";
  nicknameInput.focus();
  userForm.onsubmit = (e) => {
    e.preventDefault();
    const nickname = nicknameInput.value.trim();
    const gender = userForm.gender.value;
    const age = ageInput.value.trim();
    if (!nickname) {
      nicknameInput.focus();
      return;
    }
    if (!age || isNaN(age) || age < 18 || age > 99) {
      ageInput.focus();
      ageInput.style.borderColor = "var(--error-color)";
      return;
    }
    socket.emit("user info", { nickname, gender, age });
    userModal.style.display = "none";
    switchRoom("public", "🌐 Public Chat");
  };
}

function addMessage(msg, type = "") {
  const item = document.createElement("div");
  item.classList.add("msg");
  if (msg.messageId) {
    item.setAttribute("data-message-id", msg.messageId);
  }

  const isMe = msg.id && msg.id === myId;
  const isSystem =
    type === "system" || msg.name === "System" || msg.isGameEvent;
  if (isSystem) item.classList.add("system");
  else item.classList.add(isMe ? "me" : "other");

  const readReceiptHTML =
    isMe && currentRoom !== "public" && !currentRoom.startsWith("game-")
      ? `<span class="read-receipt">${
          msg.status === "read" ? "✓✓" : "✓"
        }</span>`
      : "";

  const nameHTML = isSystem
    ? ""
    : `<span style="color:${getGenderColor(msg.gender)};">${
        msg.name
      }${getGenderSymbol(msg.gender)}${msg.age ? " · " + msg.age : ""}</span>`;

  const messageContent = isSystem
    ? `<strong>${msg.text}</strong>`
    : `${nameHTML}${msg.text}${readReceiptHTML}`;

  item.innerHTML = `<div class="bubble">${messageContent}</div>`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;

  if (
    !isMe &&
    !isSystem &&
    currentRoom !== "public" &&
    !currentRoom.startsWith("game-")
  ) {
    socket.emit("message read", {
      room: currentRoom,
      messageId: msg.messageId,
    });
  }
}

function updateUserList() {
  const processList = (container) => {
    container.innerHTML = "";
    const publicBtn = document.createElement("div");
    publicBtn.className = "user";
    publicBtn.textContent = "🌐 Public Room";
    publicBtn.onclick = () => {
      switchRoom("public", "🌐 Public Chat");
      if (allUsersModal.style.display === "flex")
        allUsersModal.style.display = "none";
    };
    container.appendChild(publicBtn);

    latestUsers.forEach((user) => {
      if (user.id === myId) return;
      const div = document.createElement("div");
      div.className = "user";
      div.innerHTML =
        `<span style="color:${getGenderColor(user.gender)};">${
          user.name
        }${getGenderSymbol(user.gender)}${
          user.age ? " · " + user.age : ""
        }</span>` +
        (unreadPrivate[user.id] ? '<span class="red-dot"></span>' : "");
      div.onclick = () => {
        const privateRoomName = [myId, user.id].sort().join("-");
        switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
        delete unreadPrivate[user.id];
        updateUserList();
        if (allUsersModal.style.display === "flex")
          allUsersModal.style.display = "none";
      };
      container.appendChild(div);
    });
  };
  processList(userList);
  processList(allUsersList);
}

function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;

  if (currentRoom && currentRoom.startsWith("game-")) {
    socket.emit("game:leave", currentRoom);
    endGame();
  }

  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";

  if (roomName.startsWith("game-")) {
    gameContainer.style.display = "flex";
  } else {
    socket.emit("join room", currentRoom);
    endGame();
  }
  updateGameButtonVisibility({});
}

// --- Helper & UI Functions ---
function getGenderSymbol(gender) {
  return gender === "female" ? " ♀" : " ♂";
}
function getGenderColor(gender) {
  return gender === "female" ? "#e75480" : "#3b82f6";
}
function adjustHeightForKeyboard() {
  if (window.innerWidth <= 768) {
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`
    );
  }
}
function displayError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => {
    errorMessage.textContent = "";
    errorMessage.style.opacity = "0";
  }, 3000);
}
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggleBtn.textContent = "☀️";
  } else {
    document.body.classList.remove("dark-mode");
    themeToggleBtn.textContent = "🌙";
  }
}
function applyBackground(url) {
  if (url) {
    messages.style.backgroundImage = `url(${url})`;
    messages.classList.add("has-background");
    localStorage.setItem("chatBackground", url);
  } else {
    messages.style.backgroundImage = "none";
    messages.classList.remove("has-background");
    localStorage.removeItem("chatBackground");
  }
}
function populateBackgroundOptions(container) {
  if (!container) return;
  container.innerHTML = "";
  const defaultOption = document.createElement("button");
  defaultOption.className = "background-option-default";
  defaultOption.textContent = "Default";
  defaultOption.onclick = () => applyBackground(null);
  container.appendChild(defaultOption);
  predefinedBackgrounds.forEach((url) => {
    const option = document.createElement("div");
    option.className = "background-option";
    option.style.backgroundImage = `url(${url})`;
    option.onclick = () => applyBackground(url);
    container.appendChild(option);
  });
}

// --- GAME LOGIC ---

function showGameOverlayMessage(text, duration = 2500) {
  if (!gameOverlayMessage) return;
  gameOverlayMessage.textContent = text;
  gameOverlayMessage.classList.add("visible");
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    gameOverlayMessage.classList.remove("visible");
  }, duration);
}

socket.on("game:roomsList", updateGameRoomList);
socket.on("game:joined", (roomData) => {
  switchRoom(roomData.id, `🎮 ${roomData.name}`);
  if (allUsersModal.style.display === "flex") {
    allUsersModal.style.display = "none";
  }
});

socket.on("game:state", (state) => {
  currentGameState = state;
  gameContainer.style.display = "flex";
  updateGameButtonVisibility(state);
  if (state.isRoundActive) {
    const isDrawer = state.drawer && state.drawer.id === myId;
    gameInfo.textContent = isDrawer
      ? "Your turn to draw!"
      : `${state.drawer.name} is drawing...`;
    drawingTools.style.display = isDrawer ? "flex" : "none";
    gameCanvas.style.cursor = isDrawer ? "crosshair" : "not-allowed";
  } else {
    if (state.creatorId === myId) {
      gameInfo.textContent = 'You are the host. Press "Start Game" when ready.';
    } else {
      const creator = latestUsers.find((u) => u.id === state.creatorId);
      gameInfo.textContent = `Waiting for ${
        creator ? creator.name : "the host"
      } to start the game.`;
    }
  }
});

socket.on("game:word_prompt", (word) => {
  showGameOverlayMessage(`Draw: ${word}`, 4000);
});
socket.on("game:message", (text) => showGameOverlayMessage(text));
socket.on("game:new_round", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  showGameOverlayMessage("New Round!", 2000);
});
socket.on("game:correct_guess", ({ guesser, word }) => {
  showGameOverlayMessage(`✅ ${guesser.name} guessed it!`, 3000);
  addMessage(
    {
      text: `${guesser.name} guessed the word correctly! It was "${word}".`,
      isGameEvent: true,
    },
    "system"
  );
});

socket.on("game:end", (text) => {
  addMessage({ text, isGameEvent: true }, "system");
  endGame(false);
  updateGameButtonVisibility({ ...currentGameState, isRoundActive: false });
});

socket.on("game:over", ({ winner, scores }) => {
  showGameOverlayMessage(`🎉 ${winner.name} wins the game!`, 4000);
  showScoreboard(winner, scores);
  endGame(true);
});

socket.on("game:terminated", (message) => {
  showGameOverlayMessage(message, 3000);
  endGame();
  switchRoom("public", "🌐 Public Chat");
});

socket.on("game:draw", (data) => {
  const { x0, y0, x1, y1 } = data;
  const w = gameCanvas.clientWidth;
  const h = gameCanvas.clientHeight;
  drawLine(x0 * w, y0 * h, x1 * w, y1 * h, false);
});

socket.on("game:drawing_history", (history) => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  history.forEach((data) => {
    const { x0, y0, x1, y1 } = data;
    const w = gameCanvas.clientWidth;
    const h = gameCanvas.clientHeight;
    drawLine(x0 * w, y0 * h, x1 * w, y1 * h, false);
  });
});

socket.on("game:clear_canvas", () =>
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
);

function handleCreateGameRoom() {
  createGameModal.style.display = "flex";
  roomNameInput.focus();
}
createGameRoomBtnDesktop.addEventListener("click", handleCreateGameRoom);
createGameRoomBtnMobile.addEventListener("click", () => {
  if (allUsersModal.style.display === "flex")
    allUsersModal.style.display = "none";
  handleCreateGameRoom();
});
cancelCreateGameBtn.addEventListener(
  "click",
  () => (createGameModal.style.display = "none")
);

createGameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = roomNameInput.value.trim();
  if (roomName) {
    socket.emit("game:create", roomName);
    createGameModal.style.display = "none";
    roomNameInput.value = "";
  }
});

function handleStartGame() {
  if (currentRoom.startsWith("game-")) socket.emit("game:start", currentRoom);
}
startGameBtn.addEventListener("click", handleStartGame);
startGameBtnMobile.addEventListener("click", handleStartGame);

function handleStopGame() {
  if (currentRoom.startsWith("game-")) socket.emit("game:stop", currentRoom);
}
stopGameBtn.addEventListener("click", handleStopGame);
stopGameBtnMobile.addEventListener("click", handleStopGame);

clearCanvasBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  socket.emit("game:clear_canvas", currentRoom);
});

function updateGameButtonVisibility(state) {
  const isGameActive = state && state.isRoundActive;
  const isCreator = state && state.creatorId === myId;
  const isGameRoom = currentRoom && currentRoom.startsWith("game-");
  startGameBtn.style.display =
    isGameRoom && isCreator && !isGameActive ? "block" : "none";
  stopGameBtn.style.display =
    isGameRoom && isCreator && isGameActive ? "block" : "none";
  startGameBtnMobile.style.display =
    isGameRoom && isCreator && !isGameActive ? "block" : "none";
  stopGameBtnMobile.style.display =
    isGameRoom && isCreator && isGameActive ? "block" : "none";
  if (state && state.players) {
    const canStart = state.players.length >= 2;
    startGameBtn.disabled = !canStart;
    startGameBtnMobile.disabled = !canStart;
    if (!canStart && !isGameActive) {
      gameInfo.textContent = "Waiting for at least 2 players to start...";
    }
  }
}

function updateGameRoomList(rooms) {
  const renderList = (container) => {
    container.innerHTML = "";
    if (rooms.length === 0) {
      container.innerHTML = '<p class="no-rooms-msg">No active game rooms.</p>';
      return;
    }
    rooms.forEach((room) => {
      const item = document.createElement("div");
      item.className = "game-room-item";
      item.innerHTML = `<span title="${room.name} (by ${room.creatorName})">${room.name} (${room.players.length}p)</span><button data-room-id="${room.id}">Join</button>`;
      item.querySelector("button").onclick = () =>
        socket.emit("game:join", room.id);
      container.appendChild(item);
    });
  };
  renderList(gameRoomListDesktop);
  renderList(gameRoomListMobile);
}

function showScoreboard(winner, scores) {
  scoreboardTitle.innerHTML = `🏆 ${winner.name} Wins!`;
  finalScores.innerHTML = "<h3>Final Scores:</h3>";
  const scoreList = document.createElement("ul");
  const sortedPlayerIds = Object.keys(scores).sort(
    (a, b) => scores[b] - scores[a]
  );
  sortedPlayerIds.forEach((playerId) => {
    const user = latestUsers.find((u) => u.id === playerId) || {
      name: "A player",
      gender: "male",
    };
    const scoreItem = document.createElement("li");
    scoreItem.innerHTML = `<span class="score-name" style="color:${getGenderColor(
      user.gender
    )};">${user.name}${getGenderSymbol(
      user.gender
    )}</span><span class="score-points">${scores[playerId]} points</span>`;
    scoreList.appendChild(scoreItem);
  });
  finalScores.appendChild(scoreList);
  scoreboardModal.style.display = "flex";
}

// Canvas Functions
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = gameCanvas.getBoundingClientRect();
  gameCanvas.width = rect.width * dpr;
  gameCanvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
}

function drawLine(x0, y0, x1, y1, emit) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = document.body.classList.contains("dark-mode")
    ? "#FFFFFF"
    : "#000000";
  ctx.stroke();
  ctx.closePath();
  if (!emit) return;
  const w = gameCanvas.clientWidth;
  const h = gameCanvas.clientHeight;
  socket.emit("game:draw", {
    room: currentRoom,
    data: { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h },
  });
}

function handleStart(e) {
  if (
    currentGameState.isRoundActive &&
    currentGameState.drawer &&
    currentGameState.drawer.id === myId
  ) {
    isDrawing = true;
    const pos = getMousePos(e);
    [lastX, lastY] = [pos.x, pos.y];
  }
}
function handleMove(e) {
  if (isDrawing) {
    e.preventDefault();
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y, true);
    [lastX, lastY] = [pos.x, pos.y];
  }
}
function handleEnd() {
  isDrawing = false;
}
function getMousePos(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

gameCanvas.addEventListener("mousedown", handleStart);
gameCanvas.addEventListener("mousemove", handleMove);
gameCanvas.addEventListener("mouseup", handleEnd);
gameCanvas.addEventListener("mouseout", handleEnd);
gameCanvas.addEventListener("touchstart", handleStart);
gameCanvas.addEventListener("touchmove", handleMove);
gameCanvas.addEventListener("touchend", handleEnd);

function endGame(hideContainer = true) {
  if (hideContainer) gameContainer.style.display = "none";
  gameInfo.textContent = "";
  drawingTools.style.display = "none";
  gameCanvas.style.cursor = "default";
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  updateGameButtonVisibility({});
  currentGameState = {};
}
