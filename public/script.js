// Establish connection to the Socket.IO server
// IMPORTANT: Replace with your actual server URL in a production environment
const socket = io("https://anonymous-chat-backend-1.onrender.com");

// --- DOM Element Selectors ---
// General
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");
const topBar = document.getElementById("topBar");
const viewTitle = document.getElementById("viewTitle");
const themeToggleBtn = document.getElementById("theme-toggle");
const gameToggleBtn = document.getElementById("game-toggle-btn");
const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");

// View Containers
const chatAppContainer = document.getElementById("chat-app-container");
const gameAppContainer = document.getElementById("game-app-container");

// Chat App
const chatMessages = document.getElementById("messages");
const chatForm = document.getElementById("form");
const chatInput = document.getElementById("input");
const userList = document.getElementById("userList");
const showUsersBtn = document.getElementById("showUsersBtn");
const typingIndicator = document.getElementById("typing-indicator");
const errorMessage = document.getElementById("error-message");
const backgroundOptionsContainer = document.getElementById("backgroundOptions");
const backgroundOptionsMobileContainer = document.getElementById(
  "backgroundOptionsMobile"
);

// Game App
const lobbyView = document.getElementById("lobby-view");
const createGameBtn = document.getElementById("create-game-btn");
const gameNameInput = document.getElementById("game-name-input");
const gameList = document.getElementById("game-list");
const gameRoomView = document.getElementById("game-room-view");
const gameRoomName = document.getElementById("game-room-name");
const playerScores = document.getElementById("player-scores");
const leaveGameBtn = document.getElementById("leave-game-btn");
const startGameBtn = document.getElementById("start-game-btn");
const canvas = document.getElementById("drawing-canvas");
const ctx = canvas.getContext("2d");
const drawingTools = document.getElementById("drawing-tools");
const colorPicker = document.getElementById("color-picker");
const brushSize = document.getElementById("brush-size");
const clearCanvasBtn = document.getElementById("clear-canvas-btn");
const timerDisplay = document.getElementById("timer");
const wordDisplay = document.getElementById("word-display");
const roundInfoDisplay = document.getElementById("round-info");
const gameMessages = document.getElementById("game-messages");
const gameChatForm = document.getElementById("game-chat-form");
const gameChatInput = document.getElementById("game-chat-input");

// --- Application State ---
let myId = null;
let currentView = "chat"; // 'chat' or 'game'

// Chat state
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = "public";
let typingTimer;
let isTyping = false;
const TYPING_TIMER_LENGTH = 1500;
const predefinedBackgrounds = [
  "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=1374&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1575&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1470&auto=format&fit=crop",
];

// Game state
let drawing = false;
let canDraw = false;
let lastX = 0;
let lastY = 0;

// --- View Management ---
function setView(view) {
  currentView = view;
  if (view === "chat") {
    chatAppContainer.style.display = "flex";
    gameAppContainer.style.display = "none";
    viewTitle.textContent = "🌐 Public Chat"; // Reset title
    gameToggleBtn.textContent = "🎨 Play Game";
  } else {
    // game
    chatAppContainer.style.display = "none";
    gameAppContainer.style.display = "block";
    viewTitle.textContent = "🎨 Doodle Dash Lobby";
    gameToggleBtn.textContent = "Back to Chat";
    socket.emit("lobby:request_update"); // Get latest game list when switching
  }
}

gameToggleBtn.addEventListener("click", () => {
  setView(currentView === "chat" ? "game" : "chat");
});

// --- Initial Setup ---
userForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  const age = ageInput.value.trim();
  const gender = userForm.gender.value;

  if (nickname && age && gender) {
    socket.emit("user:set_info", { nickname, age, gender });
    userModal.style.display = "none";
    topBar.style.display = "flex";
    setView("chat"); // Start in chat view
  }
});

// --- Theme Logic ---
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggleBtn.textContent = "☀️";
  } else {
    document.body.classList.remove("dark-mode");
    themeToggleBtn.textContent = "🌙";
  }
}
themeToggleBtn.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";
  applyTheme(newTheme);
  localStorage.setItem("chatTheme", newTheme);
});

// --- CHAT APP LOGIC ---
function addChatMessageToUI(msg) {
  const item = document.createElement("div");
  item.classList.add("msg");
  item.setAttribute("data-message-id", msg.messageId);
  const isMe = msg.id && msg.id === myId;
  item.classList.add(isMe ? "me" : "other");
  const isPrivate = currentRoom !== "public";
  const readReceiptHTML =
    isMe && isPrivate
      ? `<span class="read-receipt">${
          msg.status === "read" ? "✓✓" : "✓"
        }</span>`
      : "";
  item.innerHTML = `<div class="bubble"><span style="color:${getNameColor(
    msg.gender
  )};">${msg.name} ${getGenderSymbol(msg.gender)}${
    msg.age ? " · " + msg.age : ""
  }</span>${msg.text}${readReceiptHTML}</div>`;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (!isMe && isPrivate) {
    socket.emit("message read", {
      room: currentRoom,
      messageId: msg.messageId,
    });
  }
}

function updateUserList() {
  userList.innerHTML = "";
  const publicBtn = document.createElement("div");
  publicBtn.className = "user";
  publicBtn.textContent = "🌐 Public Room";
  publicBtn.onclick = () => switchRoom("public", "🌐 Public Chat");
  userList.appendChild(publicBtn);
  latestUsers.forEach((user) => {
    if (user.id === myId) return;
    const div = document.createElement("div");
    div.className = "user";
    div.innerHTML =
      `<span style="color:${getNameColor(user.gender)};">${
        user.name
      } ${getGenderSymbol(user.gender)}${
        user.age ? " · " + user.age : ""
      }</span>` +
      (unreadPrivate[user.id] ? '<span class="red-dot"></span>' : "");
    div.onclick = () => {
      const privateRoomName = [myId, user.id].sort().join("-");
      switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
      delete unreadPrivate[user.id];
      updateUserList();
    };
    userList.appendChild(div);
  });
}

function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;
  currentRoom = roomName;
  viewTitle.textContent = title;
  chatMessages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";
  socket.emit("chat:join_room", currentRoom);
}

function getGenderSymbol(gender) {
  return gender === "female" ? "♀" : "♂";
}
function getNameColor(gender) {
  return gender === "female" ? "#e75480" : "#3b82f6";
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (chatInput.value.trim()) {
    socket.emit("chat:message", { room: currentRoom, text: chatInput.value });
    clearTimeout(typingTimer);
    isTyping = false;
    socket.emit("chat:stop_typing", { room: currentRoom });
    chatInput.value = "";
  }
});

chatInput.addEventListener("input", () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit("chat:typing", { room: currentRoom });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    socket.emit("chat:stop_typing", { room: currentRoom });
  }, TYPING_TIMER_LENGTH);
});

showUsersBtn.onclick = () => {
  allUsersList.innerHTML = "";
  const publicBtn = document.createElement("div");
  publicBtn.className = "user";
  publicBtn.textContent = "🌐 Public Room";
  publicBtn.onclick = () => {
    switchRoom("public", "🌐 Public Chat");
    allUsersModal.style.display = "none";
  };
  allUsersList.appendChild(publicBtn);
  latestUsers.forEach((user) => {
    if (user.id === myId) return;
    const div = document.createElement("div");
    div.className = "user";
    div.innerHTML =
      `<span style="color:${getNameColor(user.gender)};">${
        user.name
      } ${getGenderSymbol(user.gender)}${
        user.age ? " · " + user.age : ""
      }</span>` +
      (unreadPrivate[user.id] ? '<span class="red-dot"></span>' : "");
    div.onclick = () => {
      const privateRoomName = [myId, user.id].sort().join("-");
      switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
      delete unreadPrivate[user.id];
      updateUserList();
      allUsersModal.style.display = "none";
    };
    allUsersList.appendChild(div);
  });
  populateBackgroundOptions(backgroundOptionsMobileContainer);
  allUsersModal.style.display = "flex";
};

function applyBackground(url) {
  chatMessages.style.backgroundImage = url ? `url(${url})` : "none";
  chatMessages.classList.toggle("has-background", !!url);
  localStorage.setItem("chatBackground", url || "");
}

function populateBackgroundOptions(container) {
  if (!container) return;
  container.innerHTML = "";
  const defaultOption = document.createElement("button");
  defaultOption.className = "background-option-default";
  defaultOption.textContent = "Default";
  defaultOption.addEventListener("click", () => applyBackground(null));
  container.appendChild(defaultOption);
  predefinedBackgrounds.forEach((url) => {
    const option = document.createElement("div");
    option.className = "background-option";
    option.style.backgroundImage = `url(${url})`;
    option.addEventListener("click", () => applyBackground(url));
    container.appendChild(option);
  });
}

// --- GAME APP LOGIC ---
function resizeCanvas() {
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
}

function startDrawing(e) {
  if (canDraw) {
    drawing = true;
    [lastX, lastY] = getMousePos(e);
  }
}
function stopDrawing() {
  if (canDraw) {
    drawing = false;
    ctx.beginPath();
  }
}

function draw(e) {
  if (!drawing || !canDraw) return;
  e.preventDefault();
  const [x, y] = getMousePos(e);
  const drawData = {
    from: { x: lastX, y: lastY },
    to: { x, y },
    color: colorPicker.value,
    size: brushSize.value,
  };
  socket.emit("game:draw", drawData);
  lastX = x;
  lastY = y;
}

function handleIncomingDraw(data) {
  ctx.beginPath();
  ctx.moveTo(data.from.x, data.from.y);
  ctx.lineTo(data.to.x, data.to.y);
  ctx.strokeStyle = data.color;
  ctx.lineWidth = data.size;
  ctx.lineCap = "round";
  ctx.stroke();
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || e.touches[0].clientX;
  const clientY = e.clientY || e.touches[0].clientY;
  return [clientX - rect.left, clientY - rect.top];
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateGameList(games) {
  gameList.innerHTML =
    Object.keys(games).length === 0
      ? "<p>No active games. Create one!</p>"
      : "";
  for (const gameId in games) {
    const game = games[gameId];
    const item = document.createElement("div");
    item.className = "game-list-item";
    item.innerHTML = `<span>${game.name}</span><span>${game.players.length}/10</span><button data-game-id="${gameId}">Join</button>`;
    gameList.appendChild(item);
  }
}

function showGameLobby() {
  lobbyView.style.display = "block";
  gameRoomView.style.display = "none";
  viewTitle.textContent = "🎨 Doodle Dash Lobby";
}
function showGameRoom() {
  lobbyView.style.display = "none";
  gameRoomView.style.display = "block";
  resizeCanvas();
}

function updateGameState(state) {
  showGameRoom();
  gameRoomName.textContent = state.name;
  playerScores.innerHTML = "";
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${p.score} ${
      p.id === state.currentDrawerId ? "✏️" : ""
    }`;
    playerScores.appendChild(li);
  });
  timerDisplay.textContent = `Time: ${state.timer}s`;
  roundInfoDisplay.textContent = `Round ${state.currentRound}/${state.maxRounds}`;
  wordDisplay.textContent = state.wordToGuess;
  canDraw =
    state.drawer && state.drawer.id === myId && state.status === "in-progress";
  drawingTools.style.display = canDraw ? "flex" : "none";
  canvas.style.cursor = canDraw ? "crosshair" : "default";
  startGameBtn.style.display =
    state.hostId === myId && state.status === "waiting" ? "block" : "none";
}

function addGameChatMessage(data) {
  const item = document.createElement("div");
  item.classList.add("message");
  if (data.type === "system") {
    item.classList.add("system");
    item.innerHTML = data.message;
  } else if (data.type === "correct-guess") {
    item.classList.add("correct-guess");
    item.innerHTML = `🎉 ${data.name} guessed the word!`;
  } else {
    item.innerHTML = `<b>${data.name}:</b> ${data.message}`;
  }
  gameMessages.appendChild(item);
  gameMessages.scrollTop = gameMessages.scrollHeight;
}

createGameBtn.addEventListener("click", () => {
  const name = gameNameInput.value.trim();
  if (name) {
    socket.emit("lobby:create_game", { name });
    gameNameInput.value = "";
  }
});
gameList.addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") {
    socket.emit("lobby:join_game", { gameId: e.target.dataset.gameId });
  }
});
leaveGameBtn.addEventListener("click", () => socket.emit("game:leave"));
startGameBtn.addEventListener("click", () => socket.emit("game:start"));
gameChatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const guess = gameChatInput.value.trim();
  if (guess) {
    socket.emit("game:guess", { guess });
    gameChatInput.value = "";
  }
});
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchmove", draw);
clearCanvasBtn.addEventListener("click", () =>
  socket.emit("game:clear_canvas")
);

// --- GLOBAL SOCKET LISTENERS ---
socket.on("connect", () => {
  myId = socket.id;
  userModal.style.display = "flex";
});

// Chat Listeners
socket.on("user list", (users) => {
  latestUsers = users;
  updateUserList();
});
socket.on("chat:message", (msg) => {
  if (msg.room === currentRoom) {
    typingIndicator.style.opacity = "0";
    addChatMessageToUI(msg);
    if (msg.room !== "public") {
      delete unreadPrivate[msg.id === myId ? msg.to : msg.id];
      updateUserList();
    }
  } else if (msg.room !== "public" && msg.to === myId) {
    unreadPrivate[msg.id] = true;
    updateUserList();
  }
});
socket.on("chat:history", (msgs) => {
  chatMessages.innerHTML = "";
  msgs.forEach(addChatMessageToUI);
});
socket.on("chat:typing", ({ name, room }) => {
  if (room === currentRoom) {
    typingIndicator.textContent = `${name} is typing...`;
    typingIndicator.style.opacity = "1";
  }
});
socket.on("chat:stop_typing", ({ room }) => {
  if (room === currentRoom) {
    typingIndicator.style.opacity = "0";
  }
});
socket.on("chat:rate_limit", (msg) => {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => (errorMessage.style.opacity = "0"), 3000);
});
socket.on("chat:message_read", ({ room, messageId }) => {
  if (room === currentRoom) {
    const el = document.querySelector(
      `.msg[data-message-id="${messageId}"] .read-receipt`
    );
    if (el) {
      el.textContent = "✓✓";
      el.classList.add("read");
    }
  }
});

// Game Listeners
socket.on("lobby:update", (games) => updateGameList(games));
socket.on("game:joined", (state) => updateGameState(state));
socket.on("game:state_update", (state) => updateGameState(state));
socket.on("game:left", () => showGameLobby());
socket.on("game:draw_event", (data) => handleIncomingDraw(data));
socket.on("game:clear_canvas", () => clearCanvas());
socket.on("game:chat_message", (data) => addGameChatMessage(data));

// --- Window Listeners ---
window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);
  const savedBg = localStorage.getItem("chatBackground");
  if (savedBg) applyBackground(savedBg);
  populateBackgroundOptions(backgroundOptionsContainer);
});
