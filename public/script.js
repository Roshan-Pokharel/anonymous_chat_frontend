// Establish connection to the Socket.IO server
const socket = io("https://anonymous-chat-backend-1.onrender.com");

// --- DOM Element Selectors ---
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const userList = document.getElementById("userList"); // Not used directly in current HTML but good to keep
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
const genderInput = document.getElementById("genderInput"); // Added gender input

const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");
const closeUserModalBtn = allUsersModal.querySelector(".close-modal-btn");

// New Game Modal Elements
const createGameModal = document.getElementById("createGameModal");
const createGameForm = document.getElementById("createGameForm");
const roomNameInput = document.getElementById("roomNameInput");
const cancelCreateGameBtn = document.getElementById("cancelCreateGameBtn");

// Game elements
const gameContainer = document.getElementById("gameContainer");
const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d");
const drawingTools = document.getElementById("drawingTools");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const colorPicker = document.getElementById("colorPicker");
const strokeWidthInput = document.getElementById("strokeWidth");
const gameInfo = document.getElementById("gameInfo");
const startGameBtn = document.getElementById("startGameBtn");
const endGameBtn = document.getElementById("endGameBtn"); // Added end game button

// Room list elements
const roomList = document.getElementById("roomList");
const createGameRoomBtn = document.getElementById("createGameBtn");
const gameRoomsListDiv = document.getElementById("gameRoomsList");
const noGameRoomsMsg = document.getElementById("noGameRoomsMsg");

// Mobile Modal Tab elements
const mobileNavModal = document.getElementById("mobileNavModal");
const mobileModalNavBtns = document.querySelectorAll(".modal-nav-btn");
const mobileModalTabContents = document.querySelectorAll(".modal-tab-content");
const mobileRoomList = document.getElementById("mobileRoomList");
const mobileCreateGameBtn = document.getElementById("mobileCreateGameBtn");
const mobileGameRoomsListDiv = document.getElementById("mobileGameRoomsList");
const mobileNoGameRoomsMsg = document.getElementById("mobileNoGameRoomsMsg");
const mobileAllUsersList = document.getElementById("mobileAllUsersList");
const mobileThemeToggleBtn = document.getElementById("mobileThemeToggle");
const mobileBackgroundOptionsContainer = document.getElementById(
  "mobileBackgroundOptions"
);
const mobileCloseModalBtn = mobileNavModal.querySelector(".close-modal-btn");

// --- Global State ---
let currentRoom = "global";
let nickname = "";
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isDrawer = false; // Flag to indicate if current user is the drawer
let currentWord = "";
let currentDrawer = null;
let gameScores = {};
let userId = null; // To store the unique ID assigned by the server

// Define background images
const backgrounds = [
  { name: "None", value: "" },
  { name: "City", value: "images/city.jpg" },
  { name: "Forest", value: "images/forest.jpg" },
  { name: "Space", value: "images/space.jpg" },
  { name: "Ocean", value: "images/ocean.jpg" },
];

// --- Utility Functions ---
function addMessage(msg, type = "other", sender = "") {
  const item = document.createElement("li");
  item.classList.add("message-bubble", `${type}-message`);

  let content = "";
  if (sender && type !== "system") {
    content += `<strong>${sender}:</strong> `;
  }
  content += msg;

  item.innerHTML = content;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function displayErrorMessage(message) {
  errorMessage.textContent = message;
  setTimeout(() => {
    errorMessage.textContent = "";
  }, 3000);
}

function updateRoomTitle(roomName) {
  roomTitle.textContent = roomName;
}

function generateBackgroundOptions(container, isMobile = false) {
  container.innerHTML = ""; // Clear existing options
  backgrounds.forEach((bg) => {
    const optionDiv = document.createElement("div");
    optionDiv.classList.add("background-option");
    optionDiv.title = bg.name;
    optionDiv.dataset.value = bg.value;

    if (bg.value) {
      optionDiv.style.backgroundImage = `url(${bg.value})`;
    } else {
      optionDiv.style.backgroundColor = "transparent"; // For 'None'
      optionDiv.style.border = "1px dashed var(--border-color)";
      optionDiv.textContent = "None";
      optionDiv.style.display = "flex";
      optionDiv.style.justifyContent = "center";
      optionDiv.style.alignItems = "center";
      optionDiv.style.fontSize = "0.8em";
      optionDiv.style.color = "var(--text-color)";
    }

    optionDiv.addEventListener("click", () => {
      socket.emit("room:background", {
        roomId: currentRoom,
        background: bg.value,
      });
      // Visually update selection for both desktop and mobile
      document
        .querySelectorAll(".background-option")
        .forEach((opt) => opt.classList.remove("selected"));
      optionDiv.classList.add("selected");
    });
    container.appendChild(optionDiv);
  });
}

function applyBackground(backgroundUrl) {
  if (backgroundUrl) {
    messages.style.backgroundImage = `url(${backgroundUrl})`;
    messages.style.backgroundSize = "cover";
    messages.style.backgroundPosition = "center";
  } else {
    messages.style.backgroundImage = "none";
  }
}

function updateGameInfo() {
  gameInfo.innerHTML = ""; // Clear previous info

  if (!currentDrawer && Object.keys(gameScores).length === 0) {
    gameInfo.textContent = "Waiting for game to start...";
    return;
  }

  let infoHtml = "";
  if (currentDrawer) {
    infoHtml += `<div><strong>Drawer:</strong> ${currentDrawer.name}</div>`;
    infoHtml += `<div><strong>Word:</strong> ${
      isDrawer ? currentWord : currentWord.replace(/./g, "_ ")
    }</div>`;
  }

  if (Object.keys(gameScores).length > 0) {
    infoHtml += `<div><strong>Scores:</strong></div><ul>`;
    for (const [id, score] of Object.entries(gameScores)) {
      infoHtml += `<li>${score.name}: ${score.score}</li>`;
    }
    infoHtml += `</ul>`;
  }

  gameInfo.innerHTML = infoHtml;
}

// --- Game Drawing Functions ---
function resizeCanvas() {
  // Set canvas display size to actual size
  gameCanvas.width = gameCanvas.offsetWidth;
  gameCanvas.height = gameCanvas.offsetHeight;

  // If there are existing drawings, redraw them (needs server-side storage of drawing history)
  // For now, if canvas resizes, drawing will be cleared.
  // A more robust solution would involve storing drawing commands and replaying them.
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
}

function drawLine(x0, y0, x1, y1, emit) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = colorPicker.value;
  ctx.lineWidth = strokeWidthInput.value;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.closePath();

  if (emit && isDrawer) {
    socket.emit("game:draw", {
      roomId: currentRoom,
      x0,
      y0,
      x1,
      y1,
      color: colorPicker.value,
      width: strokeWidthInput.value,
    });
  }
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

function handleStart(e) {
  if (isDrawer && gameCanvas.style.cursor === "crosshair") {
    isDrawing = true;
    const pos = getMousePos(e);
    [lastX, lastY] = [pos.x, pos.y];
  }
}

function handleMove(e) {
  if (isDrawing) {
    e.preventDefault(); // Prevent scrolling on touch devices
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y, true);
    [lastX, lastY] = [pos.x, pos.y];
  }
}

function handleEnd() {
  isDrawing = false;
}

// --- Event Listeners ---

// Initial user setup
userForm.addEventListener("submit", (e) => {
  e.preventDefault();
  nickname = nicknameInput.value.trim();
  const age = ageInput.value;
  const gender = genderInput.value;

  if (nickname && age && gender) {
    socket.emit("user:setProfile", { name: nickname, age, gender });
    userModal.classList.remove("active");
  } else {
    displayErrorMessage("Please fill in all profile details.");
  }
});

// Send message
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit("chat:message", { roomId: currentRoom, msg: input.value });
    input.value = "";
  }
});

// Theme toggle
themeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-theme") ? "dark" : "light"
  );
});

mobileThemeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-theme") ? "dark" : "light"
  );
});

// Show all users modal (mobile)
showUsersBtn.addEventListener("click", () => {
  mobileNavModal.classList.add("active");
  // Ensure the users tab is active when opened via showUsersBtn
  mobileModalNavBtns.forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector('.modal-nav-btn[data-tab="users"]')
    .classList.add("active");
  mobileModalTabContents.forEach((tab) => tab.classList.remove("active"));
  document.getElementById("mobileUsersTab").classList.add("active");
});

// Close modals
document.querySelectorAll(".close-modal-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".modal").classList.remove("active");
  });
});

// Create Game Room
createGameRoomBtn.addEventListener("click", () => {
  createGameModal.classList.add("active");
});
mobileCreateGameBtn.addEventListener("click", () => {
  createGameModal.classList.add("active");
  mobileNavModal.classList.remove("active"); // Close mobile nav modal
});

cancelCreateGameBtn.addEventListener("click", () => {
  createGameModal.classList.remove("active");
});

createGameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = roomNameInput.value.trim();
  if (roomName) {
    socket.emit("game:createRoom", { roomName });
    createGameModal.classList.remove("active");
    roomNameInput.value = "";
  }
});

// Start Game
startGameBtn.addEventListener("click", () => {
  socket.emit("game:start", { roomId: currentRoom });
});
mobileStartGameBtn.addEventListener("click", () => {
  socket.emit("game:start", { roomId: currentRoom });
  mobileNavModal.classList.remove("active"); // Close mobile nav modal
});

// End Game
endGameBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to end the game?")) {
    socket.emit("game:end", { roomId: currentRoom });
  }
});

// Canvas drawing event listeners
gameCanvas.addEventListener("mousedown", handleStart);
gameCanvas.addEventListener("mousemove", handleMove);
gameCanvas.addEventListener("mouseup", handleEnd);
gameCanvas.addEventListener("mouseout", handleEnd); // End drawing if mouse leaves canvas

gameCanvas.addEventListener("touchstart", handleStart, { passive: false });
gameCanvas.addEventListener("touchmove", handleMove, { passive: false });
gameCanvas.addEventListener("touchend", handleEnd);
gameCanvas.addEventListener("touchcancel", handleEnd); // Handle touches ending outside canvas

clearCanvasBtn.addEventListener("click", () => {
  if (isDrawer) {
    socket.emit("game:clearCanvas", { roomId: currentRoom });
  }
});

// Initial canvas resize
window.addEventListener("resize", resizeCanvas);

// Initialize background options
generateBackgroundOptions(backgroundOptionsContainer);
generateBackgroundOptions(mobileBackgroundOptionsContainer, true);

// Check for saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-theme");
}

// Mobile modal tab navigation
mobileModalNavBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    mobileModalNavBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const targetTab = btn.dataset.tab;
    mobileModalTabContents.forEach((content) => {
      if (
        content.id ===
        `mobile${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}Tab`
      ) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });
  });
});

// --- Socket.IO Event Handlers ---

socket.on("connect", () => {
  console.log("Connected to server");
  // Show user modal if nickname is not set
  if (!nickname) {
    userModal.classList.add("active");
  }
  userId = socket.id; // Store the assigned socket ID
});

socket.on("user:profileSet", (user) => {
  nickname = user.name;
  userId = user.id; // Ensure client's userId is updated with the persistent ID from server
  console.log("Profile set:", user);
  addMessage(`Welcome, ${user.name}!`, "system");
});

socket.on("chat:message", (data) => {
  const isOwn = data.senderId === userId;
  addMessage(
    data.msg,
    isOwn ? "own" : "other",
    isOwn ? "You" : data.senderName
  );
});

socket.on("chat:history", (messages) => {
  messages.innerHTML = ""; // Clear existing messages
  messages.forEach((data) => {
    const isOwn = data.senderId === userId;
    addMessage(
      data.msg,
      isOwn ? "own" : "other",
      isOwn ? "You" : data.senderName
    );
  });
});

socket.on("user:list", (users) => {
  allUsersList.innerHTML = "";
  mobileAllUsersList.innerHTML = "";
  for (const id in users) {
    const user = users[id];
    const listItem = document.createElement("li");
    listItem.textContent = `${user.name} (Age: ${user.age}, Gender: ${user.gender})`;
    allUsersList.appendChild(listItem);

    const mobileListItem = listItem.cloneNode(true);
    mobileAllUsersList.appendChild(mobileListItem);
  }
});

socket.on("typing:start", (typerNickname) => {
  if (typerNickname !== nickname) {
    typingIndicator.textContent = `${typerNickname} is typing...`;
  }
});

socket.on("typing:stop", () => {
  typingIndicator.textContent = "";
});

socket.on("room:joined", (room) => {
  currentRoom = room.id;
  updateRoomTitle(room.name);
  addMessage(`You joined "${room.name}".`, "system");
  messages.innerHTML = ""; // Clear messages when joining a new room
  applyBackground(room.background);

  // Hide chat area, show game area if it's a game room
  if (room.isGameRoom) {
    gameContainer.style.display = "flex";
    messages.style.display = "none";
    input.placeholder = "Type your guess...";
    resizeCanvas(); // Ensure canvas is correctly sized on room join
  } else {
    gameContainer.style.display = "none";
    drawingTools.style.display = "none"; // Hide tools if not in game room
    gameCanvas.style.cursor = "default";
    messages.style.display = "flex";
    input.placeholder = "Type your message...";
  }

  // Update room list active state
  document.querySelectorAll(".room-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.roomId === room.id) {
      item.classList.add("active");
    }
  });
});

socket.on("room:left", (roomName) => {
  addMessage(`You left "${roomName}".`, "system");
  currentRoom = "global";
  updateRoomTitle("Global Chat");
  messages.innerHTML = ""; // Clear messages
  applyBackground(""); // Remove background
  gameContainer.style.display = "none"; // Hide game if leaving a game room
  drawingTools.style.display = "none";
  gameCanvas.style.cursor = "default";
  messages.style.display = "flex";
  input.placeholder = "Type your message...";

  // Reset active room in UI
  document.querySelectorAll(".room-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.roomId === "global") {
      item.classList.add("active");
    }
  });
});

socket.on("room:backgroundUpdated", ({ roomId, background }) => {
  if (currentRoom === roomId) {
    applyBackground(background);
    // Visually update selected background option
    document.querySelectorAll(".background-option").forEach((opt) => {
      opt.classList.remove("selected");
      if (opt.dataset.value === background) {
        opt.classList.add("selected");
      }
    });
  }
});

socket.on("game:roomsList", (rooms) => {
  gameRoomsListDiv.innerHTML = "<h4>Active Game Rooms</h4>";
  mobileGameRoomsListDiv.innerHTML = "<h4>Active Game Rooms</h4>";

  if (Object.keys(rooms).length === 0) {
    gameRoomsListDiv.appendChild(noGameRoomsMsg);
    mobileGameRoomsListDiv.appendChild(mobileNoGameRoomsMsg);
  } else {
    const ul = document.createElement("ul");
    const mobileUl = document.createElement("ul");
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const li = document.createElement("li");
      li.classList.add("game-room-item");
      li.innerHTML = `<span>${room.name} (${room.players.length}/${room.maxPlayers})</span>`;
      if (!room.isGameActive) {
        const joinBtn = document.createElement("button");
        joinBtn.textContent = "Join";
        joinBtn.onclick = () => socket.emit("room:join", { roomId: room.id });
        li.appendChild(joinBtn);
      } else {
        const activeSpan = document.createElement("span");
        activeSpan.textContent = " (Game Active)";
        activeSpan.style.color = "var(--secondary-accent)";
        li.appendChild(activeSpan);
      }
      ul.appendChild(li);

      const mobileLi = li.cloneNode(true);
      mobileLi.querySelector("button")?.addEventListener("click", () => {
        socket.emit("room:join", { roomId: room.id });
        mobileNavModal.classList.remove("active"); // Close modal on join
      });
      mobileUl.appendChild(mobileLi);
    }
    gameRoomsListDiv.appendChild(ul);
    mobileGameRoomsListDiv.appendChild(mobileUl);
  }
});

socket.on("game:state", (state) => {
  console.log("Game State:", state);
  isDrawer = state.drawer && state.drawer.id === userId;
  currentDrawer = state.drawer;
  currentWord = state.word || ""; // Word for the drawer
  gameScores = state.scores || {}; // Update scores

  if (state.isRoundActive) {
    gameCanvas.style.cursor = isDrawer ? "crosshair" : "not-allowed";
    drawingTools.style.display = isDrawer ? "flex" : "none";
    input.placeholder = isDrawer ? "You are drawing!" : "Type your guess...";
    startGameBtn.style.display = "none"; // Hide start button when game is active
    mobileStartGameBtn.style.display = "none";
    endGameBtn.style.display =
      state.creatorId === userId && state.isRoundActive
        ? "inline-block"
        : "none"; // Show end game if creator
  } else {
    gameCanvas.style.cursor = "default";
    drawingTools.style.display = "none";
    input.placeholder = "Type your message or guess...";
    // Only show start button if user is creator and game is not active
    startGameBtn.style.display =
      state.creatorId === userId ? "inline-block" : "none";
    mobileStartGameBtn.style.display =
      state.creatorId === userId ? "inline-block" : "none";
    endGameBtn.style.display = "none";
  }
  updateGameInfo(); // Update game info display
});

socket.on("game:draw", (data) => {
  // Only draw if not the drawer (to avoid self-redrawing)
  if (data.senderId !== userId) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    drawLine(data.x0, data.y0, data.x1, data.y1, false); // Do not re-emit
  }
});

socket.on("game:clearCanvas", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
});

socket.on("game:message", (message) => {
  addMessage(message, "system");
});

socket.on("game:end", () => {
  addMessage("Game ended!", "system");
  // Reset game specific UI
  gameContainer.style.display = "none";
  drawingTools.style.display = "none";
  gameCanvas.style.cursor = "default";
  messages.style.display = "flex"; // Show chat messages again
  input.placeholder = "Type your message...";
  startGameBtn.style.display = "none";
  mobileStartGameBtn.style.display = "none";
  endGameBtn.style.display = "none";
  isDrawer = false;
  currentDrawer = null;
  currentWord = "";
  gameScores = {};
  updateGameInfo(); // Clear game info
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear canvas
});

socket.on("error", (message) => {
  displayErrorMessage(message);
});

// Populate static room list
document.getElementById("roomList").addEventListener("click", (e) => {
  if (e.target.classList.contains("room-item")) {
    const roomId = e.target.dataset.roomId;
    if (roomId && roomId !== currentRoom) {
      socket.emit("room:join", { roomId });
    }
  }
});

document.getElementById("mobileRoomList").addEventListener("click", (e) => {
  if (e.target.classList.contains("room-item")) {
    const roomId = e.target.dataset.roomId;
    if (roomId && roomId !== currentRoom) {
      socket.emit("room:join", { roomId });
      mobileNavModal.classList.remove("active"); // Close modal on join
    }
  }
});
