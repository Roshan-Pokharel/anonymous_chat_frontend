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
const createGameRoomBtnDesktop = document.getElementById(
  "createGameRoomBtnDesktop"
);
const createGameRoomBtnMobile = document.getElementById(
  "createGameRoomBtnMobile"
);
const gameRoomListDesktop = document.getElementById("gameRoomListDesktop");
const gameRoomListMobile = document.getElementById("gameRoomListMobile");
const startGameBtn = document.getElementById("startGameBtn");

// --- Application & Game State ---
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = "public";
let myId = null;
let isTyping = false;
let typingTimer;
const TYPING_TIMER_LENGTH = 1500;

// Canvas/Drawing State
const ctx = gameCanvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;

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
};

allUsersModal.addEventListener("click", (e) => {
  if (e.target === allUsersModal) {
    allUsersModal.style.display = "none";
  }
});

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
  // Only show message if it's for the current room OR it's a private message notification
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
  const isSystem = type === "system" || msg.name === "System";
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

  item.innerHTML = `<div class="bubble">${nameHTML}${msg.text}${readReceiptHTML}</div>`;
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
  processList(userList); // For desktop sidebar
  processList(allUsersList); // For mobile modal
}

function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;

  // Leave the old room if it's a game room
  if (currentRoom.startsWith("game-")) {
    endGame(); // Clean up game UI
  }

  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";

  // Only emit join room for non-game rooms, as game room joining is handled separately
  if (!roomName.startsWith("game-")) {
    socket.emit("join room", currentRoom);
    endGame();
    startGameBtn.style.display = "none";
  } else {
    // We are in a game room, show the game container
    gameContainer.style.display = "flex";
  }
}

// --- Helper & UI Functions ---
function getGenderSymbol(gender) {
  return gender === "female" ? "♀" : "♂";
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

// Game Socket Handlers
socket.on("game:roomsList", (rooms) => {
  updateGameRoomList(rooms);
});

socket.on("game:joined", (roomData) => {
  switchRoom(roomData.id, `🎮 ${roomData.name}`);
  if (allUsersModal.style.display === "flex") {
    allUsersModal.style.display = "none";
  }
});

socket.on("game:state", (state) => {
  gameContainer.style.display = "flex";

  // Show/hide start button for creator
  if (state.creatorId === myId && !state.isRoundActive) {
    startGameBtn.style.display = "block";
    startGameBtn.disabled = false;
    gameInfo.textContent = 'You are the host. Press "Start Game" when ready.';
  } else {
    startGameBtn.style.display = "none";
  }

  if (state.isRoundActive) {
    if (state.drawer.id === myId) {
      gameInfo.textContent = "Your turn to draw!";
      drawingTools.style.display = "flex";
      gameCanvas.style.cursor = "crosshair";
    } else {
      gameInfo.textContent = `${state.drawer.name} is drawing...`;
      drawingTools.style.display = "none";
      gameCanvas.style.cursor = "not-allowed";
    }
  }
});

socket.on("game:word_prompt", (word) => {
  gameInfo.textContent = `Your turn! Draw the word: ${word}`;
});

socket.on("game:message", (text) => {
  addMessage({ text }, "system");
});

socket.on("game:correct_guess", ({ guesser, word, scores }) => {
  addMessage(
    { text: `${guesser.name} guessed the word correctly! It was "${word}".` },
    "system"
  );
});

socket.on("game:end", (text) => {
  addMessage({ text }, "system");
  endGame(false); // Don't switch rooms, just end the game UI
  startGameBtn.style.display = "block";
  startGameBtn.disabled = false;
});

socket.on("game:draw", (data) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, false);
});

socket.on("game:clear_canvas", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
});

// Game UI Event Listeners
const handleCreateGameRoom = () => {
  const roomName = prompt("Enter a name for your game room:", "My Doodle Room");
  if (roomName && roomName.trim()) {
    socket.emit("game:create", roomName.trim());
  }
};
createGameRoomBtnDesktop.addEventListener("click", handleCreateGameRoom);
createGameRoomBtnMobile.addEventListener("click", handleCreateGameRoom);

startGameBtn.addEventListener("click", () => {
  if (currentRoom.startsWith("game-")) {
    socket.emit("game:start", currentRoom);
    startGameBtn.disabled = true;
    startGameBtn.style.display = "none";
  }
});

clearCanvasBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  socket.emit("game:clear_canvas", currentRoom);
});

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

      const roomInfo = document.createElement("span");
      roomInfo.title = `${room.name} (by ${room.creatorName})`;
      roomInfo.textContent = `${room.name} (${room.players.length}p)`;

      const joinBtn = document.createElement("button");
      joinBtn.textContent = "Join";
      joinBtn.onclick = () => {
        socket.emit("game:join", room.id);
      };

      item.appendChild(roomInfo);
      item.appendChild(joinBtn);
      container.appendChild(item);
    });
  };
  renderList(gameRoomListDesktop);
  renderList(gameRoomListMobile);
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
  socket.emit("game:draw", { room: currentRoom, data: { x0, y0, x1, y1 } });
}

function handleStart(e) {
  if (gameInfo.textContent.startsWith("Your turn")) {
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
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}
// Mouse events
gameCanvas.addEventListener("mousedown", handleStart);
gameCanvas.addEventListener("mousemove", handleMove);
gameCanvas.addEventListener("mouseup", handleEnd);
gameCanvas.addEventListener("mouseout", handleEnd);
// Touch events
gameCanvas.addEventListener("touchstart", handleStart);
gameCanvas.addEventListener("touchmove", handleMove);
gameCanvas.addEventListener("touchend", handleEnd);

function endGame(hideContainer = true) {
  if (hideContainer) gameContainer.style.display = "none";
  gameInfo.textContent = "";
  drawingTools.style.display = "none";
  gameCanvas.style.cursor = "default";
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  startGameBtn.style.display = "none";
}
