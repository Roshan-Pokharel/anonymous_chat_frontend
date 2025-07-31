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

// New Game Modal Elements
const createGameModal = document.getElementById("createGameModal");
const createGameForm = document.getElementById("createGameForm");
const roomNameInput = document.getElementById("roomNameInput");
const cancelCreateGameBtn = document.getElementById("cancelCreateGameBtn");

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

const startGameBtnDesktop = document.getElementById("startGameBtnDesktop");
const endGameBtnDesktop = document.getElementById("endGameBtnDesktop");
const startGameBtnMobile = document.getElementById("startGameBtnMobile");
const endGameBtnMobile = document.getElementById("endGameBtnMobile");

const gameStatusSpan = document.getElementById("gameStatus");
const gameWordSpan = document.getElementById("gameWord");
const gameScoresDiv = document.getElementById("gameScores");

const colorPicker = document.getElementById("colorPicker");
const strokeSize = document.getElementById("strokeSize");

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
let currentStrokeColor = "#000000";
let currentStrokeSize = 5;

// Game State
let gameData = {
  isGameActive: false,
  isMyTurn: false,
  word: "",
  drawer: null,
  scores: {},
  roundTimeLeft: 0,
  creatorId: null,
};
let roundTimerInterval;

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
  setupCanvas(); // Initial canvas setup
});
window.addEventListener("resize", () => {
  adjustHeightForKeyboard();
  setupCanvas(); // Re-setup canvas on resize
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

// Game Tool Listeners
colorPicker.addEventListener("change", (e) => {
  currentStrokeColor = e.target.value;
  ctx.strokeStyle = currentStrokeColor;
});
strokeSize.addEventListener("change", (e) => {
  currentStrokeSize = parseInt(e.target.value);
  ctx.lineWidth = currentStrokeSize;
});
clearCanvasBtn.addEventListener("click", () => {
  if (gameData.isMyTurn) {
    socket.emit("game:clear_canvas", { room: currentRoom });
  } else {
    displayError("Only the drawer can clear the canvas!");
  }
});

// Game control buttons
startGameBtnDesktop.addEventListener("click", () => {
  if (gameData.creatorId === myId) {
    socket.emit("game:start", currentRoom);
  } else {
    displayError("Only the room creator can start the game.");
  }
});
startGameBtnMobile.addEventListener("click", () => {
  if (gameData.creatorId === myId) {
    socket.emit("game:start", currentRoom);
  } else {
    displayError("Only the room creator can start the game.");
  }
});

endGameBtnDesktop.addEventListener("click", () => {
  if (gameData.creatorId === myId) {
    socket.emit("game:end", currentRoom);
  } else {
    displayError("Only the room creator can end the game.");
  }
});
endGameBtnMobile.addEventListener("click", () => {
  if (gameData.creatorId === myId) {
    socket.emit("game:end", currentRoom);
  } else {
    displayError("Only the room creator can end the game.");
  }
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

  // Clear previous game state if switching from a game room
  if (currentRoom.startsWith("game-")) {
    endGame();
  }

  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";

  if (!roomName.startsWith("game-")) {
    socket.emit("join room", currentRoom);
    gameContainer.style.display = "none"; // Hide game elements
    drawingTools.style.display = "none";
    gameData.isGameActive = false;
    gameData.isMyTurn = false;
    updateGameControls();
  } else {
    gameContainer.style.display = "flex"; // Show game elements
    socket.emit("game:join", currentRoom); // Join the game room
    setupCanvas(); // Ensure canvas is correctly sized when game container becomes visible
  }
}

function endGame() {
  gameData.isGameActive = false;
  gameData.isMyTurn = false;
  gameData.word = "";
  gameData.drawer = null;
  gameData.scores = {};
  gameData.roundTimeLeft = 0;
  gameData.creatorId = null; // Clear creator ID too
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear canvas
  gameContainer.style.display = "none";
  drawingTools.style.display = "none";
  gameStatusSpan.textContent = "Waiting for game to start...";
  gameWordSpan.textContent = "";
  updateScoresDisplay({});
  clearInterval(roundTimerInterval); // Stop any running timer
  updateGameControls(); // Update button visibility
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
    // This is a common hack for mobile keyboard pushing up content
    // Could also set a dynamic CSS variable for input-area height if needed.
    const inputAreaHeight = document.getElementById("input-area").offsetHeight;
    document.documentElement.style.setProperty(
      "--input-area-height",
      `${inputAreaHeight}px`
    );
    // Example: adjust gameContainer bottom based on inputAreaHeight
    gameContainer.style.bottom = `calc(12px + var(--input-area-height))`;
  } else {
    document.documentElement.style.setProperty("--vh", "1vh"); // Reset on desktop
    document.documentElement.style.setProperty(
      "--input-area-height",
      `68px + 12px`
    ); // Default desktop height
    gameContainer.style.bottom = `calc(16px + 68px + 12px)`;
  }
  setupCanvas(); // Recalculate canvas size after layout adjustment
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

function updateGameControls() {
  const isCreator = gameData.creatorId === myId;
  const inGameRoom = currentRoom.startsWith("game-");
  const isGameActive = gameData.isGameActive;

  // Desktop buttons
  if (startGameBtnDesktop && endGameBtnDesktop) {
    startGameBtnDesktop.style.display =
      inGameRoom && isCreator && !isGameActive ? "block" : "none";
    endGameBtnDesktop.style.display =
      inGameRoom && isCreator && isGameActive ? "block" : "none";
  }
  // Mobile buttons
  if (startGameBtnMobile && endGameBtnMobile) {
    startGameBtnMobile.style.display =
      inGameRoom && isCreator && !isGameActive ? "block" : "none";
    endGameBtnMobile.style.display =
      inGameRoom && isCreator && isGameActive ? "block" : "none";
  }
}

function updateScoresDisplay(scores) {
  gameScoresDiv.innerHTML = "Scores: ";
  if (Object.keys(scores).length === 0) {
    gameScoresDiv.textContent = ""; // Hide if no scores
    return;
  }

  const scoreEntries = Object.entries(scores).sort(
    ([, scoreA], [, scoreB]) => scoreB - scoreA
  );
  scoreEntries.forEach(([playerId, score]) => {
    const user = latestUsers.find((u) => u.id === playerId);
    if (user) {
      const scoreSpan = document.createElement("span");
      scoreSpan.textContent = `${user.name}: ${score} | `;
      gameScoresDiv.appendChild(scoreSpan);
    }
  });
  // Remove the last " | "
  if (
    gameScoresDiv.lastChild &&
    gameScoresDiv.lastChild.textContent.endsWith(" | ")
  ) {
    gameScoresDiv.lastChild.textContent =
      gameScoresDiv.lastChild.textContent.slice(0, -3);
  }
}

// --- GAME LOGIC ---
// Canvas Drawing Functions
function setupCanvas() {
  // Set canvas dimensions to match its parent (#gameContainer)
  // Ensure gameContainer is visible before setting dimensions
  if (gameContainer.style.display === "flex") {
    const containerRect = gameCanvas.parentElement.getBoundingClientRect();
    gameCanvas.width = containerRect.width;
    gameCanvas.height = containerRect.height;
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear on resize

    // Restore drawing properties
    ctx.strokeStyle = currentStrokeColor;
    ctx.lineWidth = currentStrokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
}

function drawLine(x0, y0, x1, y1, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function handleMouseDown(e) {
  if (!gameData.isMyTurn) return; // Only drawer can draw
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function handleMouseMove(e) {
  if (!isDrawing || !gameData.isMyTurn) return;

  const newX = e.offsetX;
  const newY = e.offsetY;

  // Draw locally
  drawLine(lastX, lastY, newX, newY, currentStrokeColor, currentStrokeSize);

  // Emit drawing data to server
  socket.emit("game:draw", {
    room: currentRoom,
    data: {
      x0: lastX,
      y0: lastY,
      x1: newX,
      y1: newY,
      color: currentStrokeColor,
      size: currentStrokeSize,
    },
  });

  [lastX, lastY] = [newX, newY];
}

function handleMouseUp() {
  isDrawing = false;
}

// Game Socket Handlers
socket.on("game:roomsList", (rooms) => {
  updateGameRoomList(rooms);
});

socket.on("game:joined", (roomData) => {
  addMessage(
    { name: "System", text: `You have joined room: ${roomData.name}` },
    "system"
  );
  gameData.creatorId = roomData.creatorId; // Store creator ID
  updateGameControls();
  if (roomData.isRoundActive) {
    // If game is already active, request state
    socket.emit("game:request_state", currentRoom);
  } else {
    gameStatusSpan.textContent = "Waiting for game to start...";
    gameWordSpan.textContent = "";
    drawingTools.style.display = "none";
    updateScoresDisplay(roomData.scores || {});
  }
});

socket.on("game:state", (state) => {
  gameData.isGameActive = state.isRoundActive;
  gameData.word = state.word; // This will be the hidden word for guessers, actual word for drawer
  gameData.drawer = state.drawer;
  gameData.scores = state.scores;
  gameData.roundTimeLeft = state.roundTimeLeft;
  gameData.creatorId = state.creatorId; // Ensure creatorId is updated on state changes

  gameData.isMyTurn = gameData.drawer && gameData.drawer.id === myId;

  // Clear canvas and drawing event listeners when state changes to ensure consistency
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  gameCanvas.removeEventListener("mousedown", handleMouseDown);
  gameCanvas.removeEventListener("mousemove", handleMouseMove);
  gameCanvas.removeEventListener("mouseup", handleMouseUp);
  gameCanvas.removeEventListener("mouseleave", handleMouseUp);

  if (gameData.isMyTurn) {
    gameCanvas.addEventListener("mousedown", handleMouseDown);
    gameCanvas.addEventListener("mousemove", handleMouseMove);
    gameCanvas.addEventListener("mouseup", handleMouseUp);
    gameCanvas.addEventListener("mouseleave", handleMouseUp);
    drawingTools.style.display = "flex"; // Show drawing tools
    gameStatusSpan.textContent = `Your turn! Draw:`;
    gameWordSpan.textContent = `"${gameData.word}"`;
  } else {
    drawingTools.style.display = "none"; // Hide drawing tools
    gameStatusSpan.textContent = `Drawing by: ${
      gameData.drawer ? gameData.drawer.name : "..."
    }`;
    gameWordSpan.textContent = `"${gameData.word.replace(/./g, "_")}"`; // Show blank word for others
  }

  // Update round timer display
  clearInterval(roundTimerInterval);
  if (gameData.isGameActive) {
    updateRoundTimerDisplay(gameData.roundTimeLeft);
    roundTimerInterval = setInterval(() => {
      gameData.roundTimeLeft -= 1000;
      if (gameData.roundTimeLeft < 0) gameData.roundTimeLeft = 0; // Prevent negative
      updateRoundTimerDisplay(gameData.roundTimeLeft);
      if (gameData.roundTimeLeft <= 0) {
        clearInterval(roundTimerInterval);
      }
    }, 1000);
  } else {
    gameStatusSpan.textContent = "Game ended. Waiting for next round...";
    gameWordSpan.textContent = "";
    clearInterval(roundTimerInterval);
  }

  updateScoresDisplay(gameData.scores);
  updateGameControls(); // Re-evaluate button visibility
});

socket.on("game:draw", ({ data }) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
});

socket.on("game:clear_canvas", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
});

socket.on("game:correct_guess", ({ guesser, word, scores }) => {
  addMessage(
    {
      name: "System",
      text: `${guesser.name} guessed the word "${word}"!`,
    },
    "system"
  );
  updateScoresDisplay(scores); // Update scores immediately
  // A new round will be started by the server, and game:state will update clients
});

socket.on("game:message", (message) => {
  addMessage({ name: "System", text: message }, "system");
});

socket.on("game:ended", () => {
  addMessage({ name: "System", text: "Game has ended." }, "system");
  endGame(); // Reset client-side game state
});

function updateGameRoomList(rooms) {
  const renderList = (container) => {
    container.innerHTML = "";
    if (rooms.length === 0) {
      container.innerHTML = "<p>No game rooms available.</p>";
      return;
    }
    rooms.forEach((room) => {
      const roomDiv = document.createElement("div");
      roomDiv.className = `game-room ${
        currentRoom === room.id ? "active" : ""
      }`;
      roomDiv.innerHTML = `
                <span>${room.name} (${room.players.length} players)</span>
                <button data-room-id="${room.id}">Join</button>
            `;
      roomDiv.querySelector("button").onclick = () => {
        switchRoom(room.id, `✏️ Game: ${room.name}`);
        if (allUsersModal.style.display === "flex")
          allUsersModal.style.display = "none"; // Close modal on join
      };
      container.appendChild(roomDiv);
    });
  };
  renderList(gameRoomListDesktop);
  renderList(gameRoomListMobile);
}

createGameRoomBtnDesktop.addEventListener("click", () => {
  createGameModal.style.display = "flex";
  roomNameInput.focus();
});
createGameRoomBtnMobile.addEventListener("click", () => {
  createGameModal.style.display = "flex";
  roomNameInput.focus();
});

cancelCreateGameBtn.addEventListener("click", () => {
  createGameModal.style.display = "none";
});

createGameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = roomNameInput.value.trim();
  if (roomName) {
    socket.emit("game:create", roomName);
    createGameModal.style.display = "none";
    roomNameInput.value = ""; // Clear input
  }
});

function updateRoundTimerDisplay(ms) {
  const seconds = Math.floor(ms / 1000);
  gameStatusSpan.textContent = `Time left: ${seconds}s`;
}

// Ensure initial state of game controls
updateGameControls();
