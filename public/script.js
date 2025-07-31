// --- Establish Socket.IO Connection ---
const socket = io("https://anonymous-chat-backend-1.onrender.com");

// --- DOM Element Selectors ---
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");
const mobileMenuModal = document.getElementById("mobileMenuModal");
const closeMobileModalBtn = document.getElementById("closeMobileModalBtn");
const mobileModalNav = document.getElementById("mobileModalNav");
const mobileModalContent = document.getElementById("mobileModalContent");
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const roomTitle = document.getElementById("roomTitle");
const showMenuBtn = document.getElementById("showMenuBtn");
const themeToggleBtn = document.getElementById("theme-toggle");
const typingIndicator = document.getElementById("typing-indicator");
const errorMessage = document.getElementById("error-message");

// --- Application State ---
let myId = null;
let currentRoom = "public";
let isTyping = false;
let typingTimer;

// --- Game Elements & State ---
const gameContainer = document.getElementById("gameContainer");
const gameCanvas = document.getElementById("gameCanvas");
const gameInfoBar = document.getElementById("gameInfoBar");
const drawingTools = document.getElementById("drawingTools");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const gameControlsDesktop = document.getElementById("gameControlsDesktop");
const gameControlsMobile = document.getElementById("gameControlsMobile");
const ctx = gameCanvas.getContext("2d");
let isDrawing = false;
let lastX = 0,
  lastY = 0;

// --- Initialization ---
window.addEventListener("load", () => {
  applyTheme(localStorage.getItem("chatTheme") || "light");
  applyBackground(localStorage.getItem("chatBackground"));
  setupCanvas();
  showUserModal();
});

window.addEventListener("resize", setupCanvas);

// --- Event Listeners ---
themeToggleBtn.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";
  applyTheme(newTheme);
  localStorage.setItem("chatTheme", newTheme);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit("chat message", { room: currentRoom, text: input.value });
    input.value = "";
  }
});

input.addEventListener("input", () => {
  clearTimeout(typingTimer);
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", { room: currentRoom });
  }
  typingTimer = setTimeout(() => {
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
  }, 1500);
});

showMenuBtn.addEventListener(
  "click",
  () => (mobileMenuModal.style.display = "flex")
);
closeMobileModalBtn.addEventListener(
  "click",
  () => (mobileMenuModal.style.display = "none")
);
mobileMenuModal.addEventListener("click", (e) => {
  if (e.target === mobileMenuModal) mobileMenuModal.style.display = "none";
});

mobileModalNav.addEventListener("click", (e) => {
  if (!e.target.matches(".modal-nav-btn")) return;
  const tab = e.target.dataset.tab;
  document
    .querySelectorAll(".modal-nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");
  document.querySelectorAll(".modal-tab-content").forEach((content) => {
    content.style.display = content.id === `${tab}Tab` ? "block" : "none";
  });
});

// --- Socket Event Handlers ---
socket.on("connect", () => {
  myId = socket.id;
});
socket.on("user list", updateAllUserLists);
socket.on("room history", (msgs) => {
  messages.innerHTML = "";
  msgs.forEach((msg) => addMessage(msg));
});
socket.on("chat message", (msg) => {
  addMessage(msg);
});
socket.on("typing", ({ name, room }) => {
  if (room === currentRoom) showTypingIndicator(name);
});
socket.on("stop typing", ({ room }) => {
  if (room === currentRoom) hideTypingIndicator();
});
socket.on("rate limit", (msg) => displayError(msg));
socket.on("game:state_update", updateGameUI);
socket.on("game:word_prompt", (word) => {
  gameInfoBar.textContent = `Your word is: ${word}`;
});
socket.on("game:message", ({ text }) => addMessage({ text }, "system"));
socket.on("game:correct_guess", ({ guesser, word }) =>
  addMessage(
    { text: `${guesser.name} guessed the word correctly! It was "${word}".` },
    "system"
  )
);
socket.on("game:error", (error) => displayError(error));
socket.on("game:draw", (data) => drawLine(data, false));
socket.on("game:clear_canvas", () =>
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
);

// --- Core Functions ---
function showUserModal() {
  userModal.style.display = "flex";
  nicknameInput.focus();
  userForm.onsubmit = (e) => {
    e.preventDefault();
    const nickname = nicknameInput.value.trim();
    const age = ageInput.value.trim();
    if (!nickname || !age || isNaN(age) || age < 18 || age > 99)
      return displayError("Invalid name or age.");
    socket.emit("user info", { nickname, gender: userForm.gender.value, age });
    userModal.style.display = "none";
    socket.emit("join room", "public");
  };
}

function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;
  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  hideTypingIndicator();
  socket.emit("join room", currentRoom);
  updateGameUI(null); // Clear game state when switching rooms
}

function addMessage(msg, type = "") {
  hideTypingIndicator();
  const item = document.createElement("div");
  item.classList.add("msg", type || (msg.id === myId ? "me" : "other"));
  const nameHTML =
    type === "system"
      ? ""
      : `<span style="color:${
          msg.id === myId ? "" : getGenderColor(msg.gender)
        };">${msg.name} ♂</span>`;
  item.innerHTML = `<div class="bubble">${nameHTML}${msg.text}</div>`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function updateAllUserLists(users) {
  const lists = [
    document.getElementById("userList"),
    document.getElementById("allUsersList"),
  ];
  lists.forEach((list) => {
    if (!list) return;
    list.innerHTML = "";
    // Public room button
    const publicBtn = document.createElement("div");
    publicBtn.className = "user";
    publicBtn.textContent = "🌐 Public Room";
    publicBtn.onclick = () => {
      switchRoom("public", "🌐 Public Chat");
      mobileMenuModal.style.display = "none";
    };
    list.appendChild(publicBtn);
    // User buttons
    users.forEach((user) => {
      if (user.id === myId) return;
      const userDiv = document.createElement("div");
      userDiv.className = "user";
      userDiv.innerHTML = `<span style="color:${getGenderColor(
        user.gender
      )};">${user.name}</span>`;
      userDiv.onclick = () => {
        const privateRoomName = [myId, user.id].sort().join("-");
        switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
        mobileMenuModal.style.display = "none";
      };
      list.appendChild(userDiv);
    });
  });
}

// --- UI & Helper Functions ---
function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  // Redraw canvas with correct color on theme change
  ctx.strokeStyle = theme === "dark" ? "#FFFFFF" : "#000000";
}

function applyBackground(url) {
  messages.style.backgroundImage = url ? `url(${url})` : "none";
  messages.classList.toggle("has-background", !!url);
  if (url) localStorage.setItem("chatBackground", url);
  else localStorage.removeItem("chatBackground");
}

function displayError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => (errorMessage.style.opacity = "0"), 3000);
}
function showTypingIndicator(name) {
  typingIndicator.textContent = `${name} is typing...`;
  typingIndicator.style.opacity = "1";
}
function hideTypingIndicator() {
  typingIndicator.style.opacity = "0";
}
function getGenderColor(gender) {
  return gender === "female" ? "#e75480" : "#3b82f6";
}

// --- Game UI & Logic ---
function updateGameUI(state) {
  const containers = [gameControlsDesktop, gameControlsMobile];
  if (!state) {
    gameContainer.style.display = "none";
    containers.forEach(
      (c) =>
        (c.innerHTML =
          "<button onclick=\"socket.emit('game:create', currentRoom)\">Create Game</button>")
    );
    return;
  }

  gameContainer.style.display = state.status === "playing" ? "flex" : "none";
  gameCanvas.classList.toggle(
    "can-draw",
    state.drawer && state.drawer.id === myId
  );
  drawingTools.style.display =
    state.drawer && state.drawer.id === myId ? "flex" : "none";

  if (state.status === "playing" && state.drawer) {
    gameInfoBar.textContent =
      state.drawer.id === myId
        ? "You are drawing!"
        : `${state.drawer.name} is drawing...`;
  }

  containers.forEach((container) => {
    container.innerHTML = ""; // Clear previous controls
    if (state.status === "lobby") {
      container.innerHTML += `<h4>Game Lobby</h4><p>Host: ${state.host.name}</p>`;
      const playerList = document.createElement("ul");
      playerList.className = "game-player-list";
      Object.values(state.players).forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p.name;
        if (p.id === state.host.id) li.classList.add("is-host");
        playerList.appendChild(li);
      });
      container.appendChild(playerList);

      if (state.host.id === myId) {
        container.innerHTML +=
          "<button onclick=\"socket.emit('game:start', currentRoom)\">Start Game</button>";
        container.innerHTML +=
          '<button class="secondary" onclick="socket.emit(\'game:cancel\', currentRoom)">Cancel Game</button>';
      } else if (!state.players[myId]) {
        container.innerHTML +=
          "<button onclick=\"socket.emit('game:join', currentRoom)\">Join Game</button>";
      } else {
        container.innerHTML += "<p>Waiting for host to start...</p>";
        container.innerHTML +=
          '<button class="secondary" onclick="socket.emit(\'game:cancel\', currentRoom)">Leave Game</button>';
      }
    } else if (state.status === "playing") {
      container.innerHTML += `<h4>Game in Progress</h4><p>Drawer: ${state.drawer.name}</p><h5>Scores:</h5>`;
      const scoreList = document.createElement("ul");
      scoreList.className = "game-player-list";
      for (const pid in state.scores) {
        if (state.players[pid]) {
          const li = document.createElement("li");
          li.textContent = `${state.players[pid].name}: ${state.scores[pid]}`;
          scoreList.appendChild(li);
        }
      }
      container.appendChild(scoreList);
      container.innerHTML +=
        '<button class="secondary" onclick="socket.emit(\'game:cancel\', currentRoom)">End/Leave Game</button>';
    }
  });
}

// --- Canvas Drawing Logic ---
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = gameCanvas.getBoundingClientRect();
  gameCanvas.width = rect.width * dpr;
  gameCanvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = document.body.classList.contains("dark-mode")
    ? "#FFFFFF"
    : "#000000";
}

function drawLine(data, emit = true) {
  ctx.beginPath();
  ctx.moveTo(data.x0, data.y0);
  ctx.lineTo(data.x1, data.y1);
  ctx.stroke();
  ctx.closePath();
  if (emit) {
    socket.emit("game:draw", { room: currentRoom, drawData: data });
  }
}

function handleStart(e) {
  if (!gameCanvas.classList.contains("can-draw")) return;
  e.preventDefault();
  isDrawing = true;
  const pos = getMousePos(e);
  [lastX, lastY] = [pos.x, pos.y];
}

function handleMove(e) {
  if (!isDrawing || !gameCanvas.classList.contains("can-draw")) return;
  e.preventDefault();
  const pos = getMousePos(e);
  drawLine({ x0: lastX, y0: lastY, x1: pos.x, y1: pos.y });
  [lastX, lastY] = [pos.x, pos.y];
}

function handleEnd(e) {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
}

function getMousePos(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// Attach all drawing listeners
["mousedown", "touchstart"].forEach((evt) =>
  gameCanvas.addEventListener(evt, handleStart, { passive: false })
);
["mousemove", "touchmove"].forEach((evt) =>
  gameCanvas.addEventListener(evt, handleMove, { passive: false })
);
["mouseup", "mouseleave", "touchend"].forEach((evt) =>
  gameCanvas.addEventListener(evt, handleEnd, { passive: false })
);
clearCanvasBtn.addEventListener("click", () =>
  socket.emit("game:clear_canvas", currentRoom)
);

// Populate static background options on load
document.addEventListener("DOMContentLoaded", () => {
  const bgContainer = document.getElementById("backgroundOptions");
  const bgMobileContainer = document.getElementById("backgroundOptionsMobile");
  const populate = (container) => {
    if (!container) return;
    container.innerHTML =
      '<button class="background-option-default">Default</button>';
    const predefined = [
      "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=1374&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1575&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1470&auto=format&fit=crop",
    ];
    predefined.forEach((url) => {
      const option = document.createElement("div");
      option.className = "background-option";
      option.style.backgroundImage = `url(${url})`;
      option.dataset.url = url;
      container.appendChild(option);
    });
    container.addEventListener("click", (e) => {
      if (e.target.matches(".background-option-default")) applyBackground(null);
      if (e.target.matches(".background-option"))
        applyBackground(e.target.dataset.url);
    });
  };
  populate(bgContainer);
  populate(bgMobileContainer);
});
