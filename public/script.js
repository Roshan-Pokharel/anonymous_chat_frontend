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
const roomPasswordInput = document.getElementById("roomPasswordInput");
const cancelCreateGameBtn = document.getElementById("cancelCreateGameBtn");
const scoreboardModal = document.getElementById("scoreboardModal");
const scoreboardTitle = document.getElementById("scoreboardTitle");
const finalScores = document.getElementById("finalScores");
const closeScoreboardBtn = document.getElementById("closeScoreboardBtn");
const passwordPromptModal = document.getElementById("passwordPromptModal");
const passwordPromptForm = document.getElementById("passwordPromptForm");
const joinPasswordInput = document.getElementById("joinPasswordInput");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");
const passwordError = document.getElementById("passwordError");

// How to Play Modal Elements
const howToPlayModal = document.getElementById("howToPlayModal");
const closeHowToPlayBtn = document.getElementById("closeHowToPlayBtn");
const howToPlayBtnDesktop = document.getElementById("howToPlayBtnDesktop");
const howToPlayBtnMobile = document.getElementById("howToPlayBtnMobile");

// Mobile Modal Tab elements
const mobileModalNav = document.getElementById("mobileModalNav");
const mobileModalContent = document.getElementById("mobileModalContent");
// SMOOTH SWAP: Select the new wrapper for animation
const modalTabWrapper = document.querySelector(".modal-tab-wrapper");
const backgroundOptionsMobileContainer = document.getElementById(
  "backgroundOptionsMobile"
);

// Sidebar elements
const sidebarNav = document.getElementById("sidebar-nav");
const sidebarPanels = document.querySelectorAll(".sidebar-panel");

// Game Elements
const gameContainer = document.getElementById("gameContainer");
const gameCanvas = document.getElementById("gameCanvas");
const gameInfo = document.getElementById("gameInfo");
const gameTimer = document.getElementById("gameTimer"); // New Timer Element
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
const doodleDashToggleBtn = document.getElementById("doodleDashToggleBtn");
const doodleDashControls = document.getElementById("doodleDashControls");

// --- Application & Game State ---
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = null;
let myId = null;
let isTyping = false;
let typingTimer;
const TYPING_TIMER_LENGTH = 1500;
let joiningRoomId = null;
const LOGIN_EXPIRATION_MS = 5 * 60 * 1000;

// Canvas/Drawing State
const ctx = gameCanvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentGameState = {};
let overlayTimer;
let currentDrawingHistory = [];
let roundCountdownInterval = null; // New timer interval

const predefinedBackgrounds = [
  "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=1374&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1575&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1332&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1374&auto=format&fit=crop",
];

// --- Initialization ---
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);
  const savedBackground = localStorage.getItem("chatBackground");
  if (savedBackground) applyBackground(savedBackground);
  adjustHeightForKeyboard();
  populateBackgroundOptions(backgroundOptionsContainer);
  setupMobileModalSwipe();
});
window.addEventListener("resize", () => {
  adjustHeightForKeyboard();
  if (currentRoom && currentRoom.startsWith("game-")) {
    setupCanvas();
  }
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

// --- Mobile Tab Navigation ---
const mobileTabOrder = ["users", "game", "appearance"];

// SMOOTH SWAP: Updated function to use CSS transform for sliding
function switchMobileTab(tabName) {
  const tabIndex = mobileTabOrder.indexOf(tabName);
  if (tabIndex === -1) return;

  // Update nav buttons styling
  document
    .querySelectorAll(".modal-nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector(`.modal-nav-btn[data-tab="${tabName}"]`)
    .classList.add("active");

  // Apply the transform to slide the wrapper
  modalTabWrapper.style.transform = `translateX(-${tabIndex * 100}%)`;
}

mobileModalNav.addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const tabName = e.target.dataset.tab;
  switchMobileTab(tabName);
});

function setupMobileModalSwipe() {
  let touchStartX = 0;
  let touchEndX = 0;
  const swipeThreshold = 50; // Minimum distance for a swipe

  mobileModalContent.addEventListener("touchstart", (e) => {
    // Only start tracking swipe on the tab content area, not the nav buttons
    if (e.target.closest(".modal-tab-viewport")) {
      touchStartX = e.changedTouches[0].screenX;
    }
  });

  mobileModalContent.addEventListener("touchend", (e) => {
    if (touchStartX === 0) return; // Didn't start on the right element
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
    touchStartX = 0; // Reset for next touch
  });

  function handleSwipeGesture() {
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) < swipeThreshold) return; // Not a significant swipe

    const currentActiveBtn = document.querySelector(".modal-nav-btn.active");
    if (!currentActiveBtn) return;

    const currentTabName = currentActiveBtn.dataset.tab;
    const currentIndex = mobileTabOrder.indexOf(currentTabName);

    if (deltaX < 0) {
      // Swiped left
      const nextIndex = (currentIndex + 1) % mobileTabOrder.length;
      switchMobileTab(mobileTabOrder[nextIndex]);
    } else {
      // Swiped right
      const prevIndex =
        (currentIndex - 1 + mobileTabOrder.length) % mobileTabOrder.length;
      switchMobileTab(mobileTabOrder[prevIndex]);
    }
  }
}

sidebarNav.addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const panelId = e.target.dataset.panel;

  document
    .querySelectorAll(".sidebar-nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");

  sidebarPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
});

doodleDashToggleBtn.addEventListener("click", () => {
  doodleDashControls.style.display =
    doodleDashControls.style.display === "none" ? "flex" : "none";
});

// --- Socket Event Handlers ---
socket.on("connect", () => {
  myId = socket.id;
  checkForPersistedLogin();
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
  const isGameRoom = currentRoom && currentRoom.startsWith("game-");
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

function checkForPersistedLogin() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("userInfo"));
    if (storedUser && Date.now() - storedUser.timestamp < LOGIN_EXPIRATION_MS) {
      socket.emit("user info", storedUser.data);
      userModal.style.display = "none";
      switchRoom("public", "🌐 Public Chat");
    } else {
      localStorage.removeItem("userInfo");
      showUserModal();
    }
  } catch (error) {
    showUserModal();
  }
}

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
    const userInfo = { nickname, gender, age };
    socket.emit("user info", userInfo);

    const dataToStore = {
      timestamp: Date.now(),
      data: userInfo,
    };
    localStorage.setItem("userInfo", JSON.stringify(dataToStore));

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
    if (!container) return;
    container.innerHTML = "";

    const publicBtn = document.createElement("div");
    publicBtn.className = "user public-room";
    publicBtn.innerHTML = `🌐 Public Room`;
    publicBtn.onclick = () => {
      switchRoom("public", "🌐 Public Chat");
      if (allUsersModal.style.display === "flex") {
        allUsersModal.style.display = "none";
      }
    };
    container.appendChild(publicBtn);

    latestUsers.forEach((user) => {
      if (user.id === myId) return;

      const div = document.createElement("div");
      div.className = "user";
      const avatarColor = generateColorFromId(user.id);
      const initial = user.name.charAt(0).toUpperCase();

      div.innerHTML = `
        <div class="user-avatar" style="background-color: ${avatarColor};">
          ${initial}
        </div>
        <div class="user-info">
          <div class="user-name" style="color:${getGenderColor(user.gender)};">
            ${user.name}
          </div>
          <div class="user-details">
            <span class="status-dot"></span>
            <span>Online ${getGenderSymbol(user.gender)} ${
        user.age ? "· " + user.age : ""
      }</span>
          </div>
        </div>
        ${unreadPrivate[user.id] ? '<span class="red-dot"></span>' : ""} `;

      div.onclick = () => {
        const privateRoomName = [myId, user.id].sort().join("-");
        switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
        delete unreadPrivate[user.id];
        updateUserList();
        if (allUsersModal.style.display === "flex") {
          allUsersModal.style.display = "none";
        }
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
    setTimeout(() => {
      setupCanvas();
    }, 50);
  } else {
    socket.emit("join room", currentRoom);
    endGame();
  }
  updateGameButtonVisibility({});
}

// --- Helper & UI Functions ---

function generateColorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const color = `hsl(${hash % 360}, 70%, 50%)`;
  return color;
}

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
  if (currentRoom && currentRoom.startsWith("game-")) {
    redrawFromHistory();
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

  const defaultOption = document.createElement("div");
  defaultOption.className = "background-option background-option-default";
  defaultOption.innerHTML = "<span>Default</span>";
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

const openHowToPlayModal = () => (howToPlayModal.style.display = "flex");
howToPlayBtnDesktop.addEventListener("click", openHowToPlayModal);
howToPlayBtnMobile.addEventListener("click", openHowToPlayModal);
closeHowToPlayBtn.addEventListener(
  "click",
  () => (howToPlayModal.style.display = "none")
);
howToPlayModal.addEventListener("click", (e) => {
  if (e.target === howToPlayModal) howToPlayModal.style.display = "none";
});

function showGameOverlayMessage(text, duration = 2500) {
  if (!gameOverlayMessage) return;
  gameOverlayMessage.textContent = text;
  gameOverlayMessage.classList.add("visible");
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    gameOverlayMessage.classList.remove("visible");
  }, duration);
}

// New function to handle the round timer
function updateRoundTimer(endTime) {
  clearInterval(roundCountdownInterval);
  if (!endTime) {
    gameTimer.style.display = "none";
    return;
  }

  gameTimer.style.display = "block";

  const update = () => {
    const timeLeft = Math.round((endTime - Date.now()) / 1000);
    if (timeLeft <= 0) {
      gameTimer.textContent = "0";
      clearInterval(roundCountdownInterval);
    } else {
      gameTimer.textContent = timeLeft;
    }
  };

  update();
  roundCountdownInterval = setInterval(update, 1000);
}

socket.on("game:roomsList", updateGameRoomList);
socket.on("game:joined", (roomData) => {
  if (passwordPromptModal.style.display === "flex") {
    passwordPromptModal.style.display = "none";
  }
  switchRoom(roomData.id, `🎮 ${roomData.name}`);
  if (allUsersModal.style.display === "flex") {
    allUsersModal.style.display = "none";
  }
});

socket.on("game:join_error", (message) => {
  if (passwordPromptModal.style.display === "flex") {
    passwordError.textContent = message;
    passwordError.style.display = "block";
    joinPasswordInput.focus();
  } else {
    displayError(message);
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
    // Start or update the timer
    if (state.roundEndTime) {
      updateRoundTimer(state.roundEndTime);
    }
  } else {
    updateRoundTimer(null); // Hide timer if round is not active
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
  currentDrawingHistory = [];
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  showGameOverlayMessage("New Round!", 2000);
});

socket.on("game:correct_guess", ({ guesser, word }) => {
  showGameOverlayMessage(`✅ ${guesser.name} guessed it!`, 3000);
  addMessage(
    {
      text: `${guesser.name} guessed the word! It was "${word}".`,
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
  currentDrawingHistory.push(data);
  const { x0, y0, x1, y1 } = data;
  const w = gameCanvas.clientWidth;
  const h = gameCanvas.clientHeight;
  if (w === 0 || h === 0) return;
  drawLine(x0 * w, y0 * h, x1 * w, y1 * h, false);
});

socket.on("game:drawing_history", (history) => {
  currentDrawingHistory = history;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  redrawFromHistory();
});

socket.on("game:clear_canvas", () => {
  currentDrawingHistory = [];
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
});

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
  const password = roomPasswordInput.value.trim();
  if (roomName) {
    socket.emit("game:create", { roomName, password });
    createGameModal.style.display = "none";
    roomNameInput.value = "";
    roomPasswordInput.value = "";
  }
});

passwordPromptForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const password = joinPasswordInput.value;
  if (joiningRoomId && password) {
    socket.emit("game:join", { roomId: joiningRoomId, password });
    joinPasswordInput.value = "";
  }
});
cancelJoinBtn.addEventListener("click", () => {
  passwordPromptModal.style.display = "none";
  joiningRoomId = null;
  joinPasswordInput.value = "";
  passwordError.style.display = "none";
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
  currentDrawingHistory = [];
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  socket.emit("game:clear_canvas", currentRoom);
});

function updateGameButtonVisibility(state) {
  const isGameActive = state && state.isRoundActive;
  const isCreator = state && state.creatorId === myId;
  const isGameRoom = currentRoom && currentRoom.startsWith("game-");

  const showStart = isGameRoom && isCreator && !isGameActive;
  const showStop = isGameRoom && isCreator && isGameActive;

  startGameBtn.style.display = showStart ? "block" : "none";
  stopGameBtn.style.display = showStop ? "block" : "none";
  startGameBtnMobile.style.display = showStart ? "block" : "none";
  stopGameBtnMobile.style.display = showStop ? "block" : "none";

  if (showStart) {
    startGameBtn.classList.add("btn-start");
    startGameBtnMobile.classList.add("btn-start");
  } else {
    startGameBtn.classList.remove("btn-start");
    startGameBtnMobile.classList.remove("btn-start");
  }
  if (showStop) {
    stopGameBtn.classList.add("btn-danger");
    stopGameBtnMobile.classList.add("btn-danger");
  } else {
    stopGameBtn.classList.remove("btn-danger");
    stopGameBtnMobile.classList.remove("btn-danger");
  }

  if (state && state.players) {
    const canStart = state.players.length >= 2;
    startGameBtn.disabled = !canStart;
    startGameBtnMobile.disabled = !canStart;
    if (!canStart && !isGameActive && gameInfo) {
      gameInfo.textContent = "Waiting for at least 2 players to start...";
    }
  }
}

function updateGameRoomList(rooms) {
  const renderList = (container) => {
    if (!container) return;
    container.innerHTML = "";
    if (rooms.length === 0) {
      container.innerHTML = '<p class="no-rooms-msg">No active game rooms.</p>';
      return;
    }
    rooms.forEach((room) => {
      const item = document.createElement("div");
      item.className = "game-room-item";
      const lockIcon = room.hasPassword ? "🔒 " : "";
      item.innerHTML = `<span title="${room.name} (by ${room.creatorName})">${lockIcon}${room.name} (${room.players.length}p)</span><button data-room-id="${room.id}">Join</button>`;

      const joinBtn = item.querySelector("button");
      if (room.inProgress) {
        joinBtn.disabled = true;
        joinBtn.textContent = "Active";
      }

      joinBtn.onclick = () => {
        if (room.hasPassword) {
          joiningRoomId = room.id;
          passwordError.style.display = "none";
          passwordPromptModal.style.display = "flex";
          joinPasswordInput.focus();
        } else {
          socket.emit("game:join", { roomId: room.id });
        }
      };
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

// --- Canvas Functions ---
function redrawFromHistory() {
  if (!ctx) return;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  ctx.strokeStyle = document.body.classList.contains("dark-mode")
    ? "#FFFFFF"
    : "#000000";
  const w = gameCanvas.clientWidth;
  const h = gameCanvas.clientHeight;
  if (w === 0 || h === 0) return;

  currentDrawingHistory.forEach((data) => {
    const { x0, y0, x1, y1 } = data;
    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    ctx.lineTo(x1 * w, y1 * h);
    ctx.stroke();
    ctx.closePath();
  });
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = gameCanvas.getBoundingClientRect();
  gameCanvas.width = rect.width * dpr;
  gameCanvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  redrawFromHistory();
}

function drawLine(x0, y0, x1, y1, emit = false) {
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
  if (w === 0 || h === 0) return;

  const drawData = { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h };
  currentDrawingHistory.push(drawData);

  socket.emit("game:draw", {
    room: currentRoom,
    data: drawData,
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
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getMousePos(e);
  drawLine(lastX, lastY, pos.x, pos.y, true);
  [lastX, lastY] = [pos.x, pos.y];
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
  if (gameInfo) gameInfo.textContent = "";
  if (drawingTools) drawingTools.style.display = "none";
  if (gameCanvas) gameCanvas.style.cursor = "default";
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  updateGameButtonVisibility({});
  updateRoundTimer(null); // Hide and clear timer
  currentGameState = {};
  currentDrawingHistory = [];
}
