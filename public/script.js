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
const scoreboardContent = document.getElementById("scoreboardContent");
const finalScoreboardModal = document.getElementById("finalScoreboardModal");
const finalScoresList = document.getElementById("finalScoresList");

// Game elements
const gameContainer = document.getElementById("gameContainer");
const gameCanvas = document.getElementById("gameCanvas");
const gameInfo = document.getElementById("gameInfo");
const drawingTools = document.getElementById("drawingTools");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const gameRoomListDesktop = document.getElementById("gameRoomListDesktop");
const gameRoomListMobile = document.getElementById("gameRoomListMobile");
const startGameBtn = document.getElementById("startGameBtn");
const stopGameBtn = document.getElementById("stopGameBtn");
const startGameBtnMobile = document.getElementById("startGameBtnMobile");
const stopGameBtnMobile = document.getElementById("stopGameBtnMobile");
const createGameRoomBtn = document.getElementById("createGameRoomBtn");
const createGameRoomBtnMobile = document.getElementById(
  "createGameRoomBtnMobile"
);
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const leaveRoomBtnMobile = document.getElementById("leaveRoomBtnMobile");
const roundEndMessageDisplay = document.getElementById(
  "roundEndMessageDisplay"
); // New element for round end messages

let myId;
let currentRoomId = null;
let currentGameState = {
  isRoundActive: false,
  drawer: null,
  word: "", // Only known to drawer
  scores: {},
  creatorId: null,
  players: [],
};
let drawingHistory = []; // Stores lines for the current round
let ctx; // Canvas 2D context
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Set up canvas context when available
gameCanvas.addEventListener("touchstart", (e) => e.preventDefault(), {
  passive: false,
});
gameCanvas.addEventListener("touchmove", (e) => e.preventDefault(), {
  passive: false,
});

window.onload = () => {
  setupCanvas();
  // Call this function to set the viewport height variable for CSS
  setVhProperty();
  // Check for saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }

  // Request existing game rooms on load
  socket.emit("room:get_game_rooms");
  // Request all users on load
  socket.emit("user:get_all");
};

// Update --vh property on resize for mobile responsiveness
window.addEventListener("resize", setVhProperty);
function setVhProperty() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

function setupCanvas() {
  if (gameCanvas) {
    ctx = gameCanvas.getContext("2d");
    // Set initial canvas size
    resizeCanvas();
    // Set default drawing properties
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";
  }
}

function resizeCanvas() {
  if (gameCanvas) {
    // Get the computed style of the parent container to determine available space
    const gameContainerRect = gameContainer.getBoundingClientRect();

    // Set canvas dimensions based on the parent's available space
    gameCanvas.width = gameContainerRect.width;
    gameCanvas.height = gameContainerRect.height;

    // Redraw existing drawing history after resize to prevent loss
    redrawCanvas();
  }
}

// Re-draw all lines from history
function redrawCanvas() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear entire canvas
  drawingHistory.forEach((line) => {
    drawLine(
      line.x1,
      line.y1,
      line.x2,
      line.y2,
      false,
      line.color,
      line.lineWidth
    ); // Don't broadcast again
  });
}

// Listen for window resize to adjust canvas size
window.addEventListener("resize", resizeCanvas);

// Function to draw a line on the canvas
function drawLine(
  x1,
  y1,
  x2,
  y2,
  emit,
  color = ctx.strokeStyle,
  lineWidth = ctx.lineWidth
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.closePath();

  if (
    emit &&
    currentRoomId &&
    currentGameState.isRoundActive &&
    currentGameState.drawer.id === myId
  ) {
    socket.emit("game:draw", { x1, y1, x2, y2, color, lineWidth });
  }
}

// Mouse events
gameCanvas.addEventListener("mousedown", handleStart);
gameCanvas.addEventListener("mousemove", handleMove);
gameCanvas.addEventListener("mouseup", handleEnd);
gameCanvas.addEventListener("mouseout", handleEnd);
// Touch events
gameCanvas.addEventListener("touchstart", handleStart, { passive: false });
gameCanvas.addEventListener("touchmove", handleMove, { passive: false });
gameCanvas.addEventListener("touchend", handleEnd);

function handleStart(e) {
  if (currentGameState.isRoundActive && currentGameState.drawer.id === myId) {
    isDrawing = true;
    const pos = getMousePos(e);
    [lastX, lastY] = [pos.x, pos.y];
  }
}

function handleMove(e) {
  if (isDrawing) {
    e.preventDefault(); // Prevent scrolling on touch devices
    const pos = getMousePos(e);
    drawLine(lastX, lastY, pos.x, pos.y, true); // Emit drawing data
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

// Clear canvas button
clearCanvasBtn.addEventListener("click", () => {
  if (currentGameState.isRoundActive && currentGameState.drawer.id === myId) {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    drawingHistory = []; // Clear local history
    socket.emit("game:clear_canvas"); // Notify server to clear for others
  }
});

// Socket.IO event handlers

socket.on("connect", () => {
  myId = socket.id;
  console.log("Connected to server with ID:", myId);
});

socket.on("user:profile_set", (user) => {
  console.log("Profile set:", user);
  userModal.style.display = "none"; // Hide modal after profile is set
});

socket.on("user:list_updated", (users) => {
  userList.innerHTML = "";
  allUsersList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user.name;
    userList.appendChild(li);

    const allUserLi = document.createElement("li");
    allUserLi.textContent = `${user.name} (Age: ${user.age})`;
    allUsersList.appendChild(allUserLi);
  });
});

socket.on("chat:message", (message) => {
  const item = document.createElement("li");
  item.innerHTML = `<strong>${message.user.name}:</strong> ${message.text}`;
  if (message.isSystem) {
    item.classList.add("system-message");
  } else if (message.user.id === myId) {
    item.classList.add("my-message");
  } else {
    item.classList.add("other-message");
  }

  // Add delete button for own messages
  if (message.user.id === myId && !message.isSystem) {
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "x";
    deleteBtn.classList.add("delete-message-btn");
    deleteBtn.onclick = () => {
      socket.emit("message:delete", message.id);
    };
    item.appendChild(deleteBtn);
  }

  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight; // Scroll to bottom
});

socket.on("message:deleted", (messageId) => {
  const messageElements = messages.querySelectorAll("li");
  messageElements.forEach((li) => {
    // This is a simplistic way to find based on content;
    // A better way would be to add a data-message-id attribute to each li
    if (
      li.querySelector(".delete-message-btn") &&
      li
        .querySelector(".delete-message-btn")
        .onclick.toString()
        .includes(messageId)
    ) {
      li.remove();
    }
  });
});

socket.on("chat:error", (msg) => {
  errorMessage.textContent = msg;
  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.display = "none";
  }, 3000);
});

socket.on("chat:typing_status", ({ user, isTyping }) => {
  if (isTyping && user !== "System") {
    typingIndicator.textContent = `${user} is typing...`;
    typingIndicator.style.display = "block";
  } else {
    typingIndicator.textContent = "";
    typingIndicator.style.display = "none";
  }
});

socket.on("chat:history", (history) => {
  messages.innerHTML = ""; // Clear existing messages
  history.forEach((message) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${message.user.name}:</strong> ${message.text}`;
    if (message.isSystem) {
      item.classList.add("system-message");
    } else if (message.user.id === myId) {
      item.classList.add("my-message");
    } else {
      item.classList.add("other-message");
    }

    // Add delete button for own messages
    if (message.user.id === myId && !message.isSystem) {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "x";
      deleteBtn.classList.add("delete-message-btn");
      deleteBtn.onclick = () => {
        socket.emit("message:delete", message.id);
      };
      item.appendChild(deleteBtn);
    }
    messages.appendChild(item);
  });
  messages.scrollTop = messages.scrollHeight;
});

// Game Room Specific Events
socket.on("game:room_created", ({ roomId, roomName }) => {
  createGameModal.style.display = "none";
  joinGameRoom(roomId, roomName);
});

socket.on("game:rooms_list_updated", (rooms) => {
  const renderRooms = (container) => {
    container.innerHTML = ""; // Clear existing list
    if (rooms.length === 0) {
      const msg = document.createElement("p");
      msg.className = "no-rooms-msg";
      msg.textContent = "No active game rooms.";
      container.appendChild(msg);
      return;
    }
    rooms.forEach((room) => {
      const roomDiv = document.createElement("div");
      roomDiv.className = "game-room-item";
      roomDiv.innerHTML = `
                <span>${room.name} (Created by: ${room.creatorName})</span>
                <button class="join-room-btn" data-room-id="${room.id}" data-room-name="${room.name}">Join</button>
            `;
      container.appendChild(roomDiv);
    });
  };

  renderRooms(gameRoomListDesktop);
  renderRooms(gameRoomListMobile); // Assuming you have a mobile list element

  // Attach event listeners to new join buttons
  document.querySelectorAll(".join-room-btn").forEach((button) => {
    button.onclick = (e) => {
      const roomId = e.target.dataset.roomId;
      const roomName = e.target.dataset.roomName;
      socket.emit("room:join", roomId);
      // Update UI to reflect joining the room (handled by game:joined)
      currentRoomId = roomId;
      roomTitle.textContent = roomName; // Set room title
      showGameUI(); // Show game canvas and tools
      document.getElementById("allUsersModal").style.display = "none"; // Hide modals if open
      document.getElementById("createGameModal").style.display = "none";
    };
  });
});

socket.on("game:room_removed", (roomId) => {
  // Remove the room from the displayed lists
  const removeRoomFromList = (container) => {
    const roomItems = container.querySelectorAll(".game-room-item");
    roomItems.forEach((item) => {
      if (
        item.querySelector(".join-room-btn") &&
        item.querySelector(".join-room-btn").dataset.roomId === roomId
      ) {
        item.remove();
      }
    });
    // If no rooms left, display the "No active game rooms" message
    if (
      container.children.length === 0 ||
      container.querySelector(".no-rooms-msg")
    ) {
      const msg = document.createElement("p");
      msg.className = "no-rooms-msg";
      msg.textContent = "No active game rooms.";
      container.appendChild(msg);
    }
  };

  removeRoomFromList(gameRoomListDesktop);
  removeRoomFromList(gameRoomListMobile);

  // If the currently joined room is terminated, hide game UI
  if (currentRoomId === roomId) {
    hideGameUI();
    currentRoomId = null;
    roomTitle.textContent = "Anonymous Chat & Doodle"; // Reset title
    // Display a message to the user that the game ended
    const item = document.createElement("li");
    item.innerHTML = `<strong class="system-message">System:</strong> The game room has been terminated.`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }
});

socket.on("room:joined", (roomId) => {
  currentRoomId = roomId;
  console.log("Joined room:", roomId);
  hideChatElements(); // Hide chat when in game room
  showGameUI(); // Show game canvas and controls
  messages.innerHTML = ""; // Clear messages specific to global chat
});

socket.on("game:state", (gameState) => {
  currentGameState = { ...currentGameState, ...gameState };
  console.log("Game State Updated:", currentGameState);

  updateGameInfo(); // Update player list, scores, drawer info

  // Show/hide drawing tools based on if I am the drawer
  if (currentGameState.drawer && currentGameState.drawer.id === myId) {
    drawingTools.style.display = "flex";
    input.placeholder = "Type your guesses here..."; // Placeholder for guessing
  } else {
    drawingTools.style.display = "none";
    input.placeholder = "Type your guesses here...";
  }

  // Show/hide start/stop game buttons for creator
  const isCreator = currentGameState.creatorId === myId;
  startGameBtn.style.display =
    isCreator && !currentGameState.isRoundActive ? "block" : "none";
  startGameBtnMobile.style.display =
    isCreator && !currentGameState.isRoundActive ? "block" : "none";
  stopGameBtn.style.display =
    isCreator && currentGameState.isRoundActive ? "block" : "none";
  stopGameBtnMobile.style.display =
    isCreator && currentGameState.isRoundActive ? "block" : "none";

  // Redraw canvas with current drawing history when game state is updated (e.g., new joiner)
  if (gameState.drawingHistory) {
    drawingHistory = gameState.drawingHistory;
    redrawCanvas();
  }
});

socket.on("game:your_word", (word) => {
  if (currentGameState.drawer && currentGameState.drawer.id === myId) {
    currentGameState.word = word;
    gameInfo.innerHTML = `<h2>You are drawing!</h2><p>Your word is: <strong>${word}</strong></p>`;
    drawingTools.style.display = "flex";
    input.placeholder = "You are drawing. Chat with others...";
  }
});

socket.on("game:drawing", (lineData) => {
  // Only draw if not the drawer (drawer already draws locally)
  if (currentGameState.drawer && currentGameState.drawer.id !== myId) {
    drawLine(
      lineData.x1,
      lineData.y1,
      lineData.x2,
      lineData.y2,
      false,
      lineData.color,
      lineData.lineWidth
    );
    drawingHistory.push(lineData); // Add to local history for redraws
  }
});

socket.on("game:canvas_cleared", () => {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawingHistory = []; // Clear local history
});

socket.on("game:new_round", (data) => {
  drawingHistory = []; // Clear drawing history for new round
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear canvas

  const roundTimeMessage = document.createElement("li");
  roundTimeMessage.classList.add("system-message", "round-start-message");
  roundTimeMessage.innerHTML = `<strong>System:</strong> New round starting! You have ${
    data.roundTime / 1000
  } seconds.`;
  messages.appendChild(roundTimeMessage);
  messages.scrollTop = messages.scrollHeight;

  // Optionally remove the round start message after a few seconds
  setTimeout(() => {
    roundTimeMessage.remove();
  }, 3000);
});

socket.on("game:message", (data) => {
  if (data.type === "round_end") {
    displayRoundEndMessage(data.message);
  } else {
    // Normal system message, display in chat
    const item = document.createElement("li");
    item.innerHTML = `<strong>System:</strong> ${data.message}`;
    item.classList.add("system-message");
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }
});

function displayRoundEndMessage(message) {
  roundEndMessageDisplay.textContent = message;
  roundEndMessageDisplay.style.display = "block";
  setTimeout(() => {
    roundEndMessageDisplay.style.display = "none";
  }, 2000); // Hide after 2 seconds
}

socket.on("game:final_scores", (scores) => {
  finalScoresList.innerHTML = "";
  const sortedScores = Object.entries(scores).sort(
    ([, scoreA], [, scoreB]) => scoreB - scoreA
  );

  if (sortedScores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No scores recorded.";
    finalScoresList.appendChild(li);
  } else {
    sortedScores.forEach(([userId, score]) => {
      const player = currentGameState.players.find((p) => p.id === userId);
      const playerName = player ? player.name : "Unknown Player";
      const li = document.createElement("li");
      li.textContent = `${playerName}: ${score} points`;
      finalScoresList.appendChild(li);
    });
  }
  finalScoreboardModal.style.display = "block";
});

socket.on("game:terminated", (roomId) => {
  console.log(
    `Game room ${roomId} was terminated by creator or due to no players.`
  );
  if (currentRoomId === roomId) {
    hideGameUI();
    currentRoomId = null;
    roomTitle.textContent = "Anonymous Chat & Doodle";
    finalScoreboardModal.style.display = "none"; // Hide final scores if open
    // Display a message in the chat that the game ended
    const item = document.createElement("li");
    item.innerHTML = `<strong class="system-message">System:</strong> The game has ended.`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }
  socket.emit("room:get_game_rooms"); // Request updated list of available rooms
});

// UI Update Functions
function updateGameInfo() {
  let infoHtml = "<h3>Game Info</h3>";
  if (currentGameState.isRoundActive) {
    infoHtml += `<p>Drawer: <strong>${
      currentGameState.drawer ? currentGameState.drawer.name : "N/A"
    }</strong></p>`;
    // Show "Your Word" only to the drawer
    if (currentGameState.drawer && currentGameState.drawer.id === myId) {
      infoHtml += `<p>Your word: <strong>${currentGameState.word}</strong></p>`;
    } else {
      infoHtml += `<p>Guess the word!</p>`;
    }
  } else {
    infoHtml += "<p>Game is not active. Creator can start.</p>";
  }

  infoHtml += "<h4>Scores:</h4>";
  infoHtml += "<ul>";
  const sortedScores = Object.entries(currentGameState.scores).sort(
    ([, scoreA], [, scoreB]) => scoreB - scoreA
  );
  currentGameState.players.forEach((player) => {
    const score = currentGameState.scores[player.id] || 0;
    infoHtml += `<li>${player.name}: ${score}</li>`;
  });
  infoHtml += "</ul>";

  // Display current players in the room
  infoHtml += "<h4>Players in Room:</h4>";
  infoHtml += "<ul>";
  currentGameState.players.forEach((player) => {
    infoHtml += `<li>${player.name} ${player.id === myId ? "(You)" : ""} ${
      player.id === currentGameState.creatorId ? "(Creator)" : ""
    }</li>`;
  });
  infoHtml += "</ul>";

  gameInfo.innerHTML = infoHtml;
}

function showGameUI() {
  document.getElementById("chatContainer").classList.add("in-game"); // Adjust layout for game
  gameContainer.style.display = "block";
  document.getElementById("input-area").classList.add("in-game"); // Adjust input area
  messages.classList.add("in-game"); // Adjust message area
  showChatElements(); // Re-show chat elements that are part of the game UI
  leaveRoomBtn.style.display = "block"; // Show leave room button
  leaveRoomBtnMobile.style.display = "block"; // Show leave room button
}

function hideGameUI() {
  document.getElementById("chatContainer").classList.remove("in-game");
  gameContainer.style.display = "none";
  drawingTools.style.display = "none";
  startGameBtn.style.display = "none";
  stopGameBtn.style.display = "none";
  startGameBtnMobile.style.display = "none";
  stopGameBtnMobile.style.display = "none";
  document.getElementById("input-area").classList.remove("in-game");
  messages.classList.remove("in-game");
  roundEndMessageDisplay.style.display = "none"; // Hide message when game ends
  showChatElements(); // Ensure chat elements are visible and properly styled for non-game
  leaveRoomBtn.style.display = "none"; // Hide leave room button
  leaveRoomBtnMobile.style.display = "none"; // Hide leave room button

  // Clear canvas
  if (ctx) {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    drawingHistory = [];
  }
  currentGameState = {
    isRoundActive: false,
    drawer: null,
    word: "",
    scores: {},
    creatorId: null,
    players: [],
  };
}

function hideChatElements() {
  // Elements that are typically part of global chat, but change behavior/visibility in game
  // In your current setup, chat messages are part of game UI, so this might not be needed
  // unless there are other elements you specifically want to hide/show.
}

function showChatElements() {
  // Ensure chat elements are visible and in their default state
  // This is the opposite of hideChatElements
}

// --- Event Listeners ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat:message", input.value);
    input.value = "";
    socket.emit("chat:typing", false); // Stop typing after sending message
  }
});

let typingTimeout;
input.addEventListener("input", () => {
  socket.emit("chat:typing", true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("chat:typing", false);
  }, 1000);
});

// User profile modal submission
userForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  const age = parseInt(ageInput.value, 10);

  if (nickname && age >= 18) {
    socket.emit("user:set_profile", { nickname, age });
  } else {
    alert("Please enter a valid nickname and ensure age is 18 or older.");
  }
});

// Create Game Modal submission
createGameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = roomNameInput.value.trim();
  if (roomName) {
    socket.emit("room:create_game", { roomName });
  } else {
    alert("Please enter a room name.");
  }
});

// Game control buttons
startGameBtn.addEventListener("click", () => socket.emit("game:start"));
startGameBtnMobile.addEventListener("click", () => socket.emit("game:start"));
stopGameBtn.addEventListener("click", () => socket.emit("game:stop_game"));
stopGameBtnMobile.addEventListener("click", () =>
  socket.emit("game:stop_game")
);

leaveRoomBtn.addEventListener("click", () => {
  if (currentRoomId) {
    socket.emit("room:leave", currentRoomId);
    hideGameUI();
    currentRoomId = null;
    roomTitle.textContent = "Anonymous Chat & Doodle"; // Reset room title
    messages.innerHTML = ""; // Clear messages after leaving room
    // Also, update the game room list
    socket.emit("room:get_game_rooms");
  }
});

leaveRoomBtnMobile.addEventListener("click", () => {
  if (currentRoomId) {
    socket.emit("room:leave", currentRoomId);
    hideGameUI();
    currentRoomId = null;
    roomTitle.textContent = "Anonymous Chat & Doodle"; // Reset room title
    messages.innerHTML = ""; // Clear messages after leaving room
    // Also, update the game room list
    socket.emit("room:get_game_rooms");
  }
});

// --- Theme Toggle ---
themeToggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  // Save preference to localStorage
  if (document.body.classList.contains("dark-mode")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
});

// --- Modal Controls ---
const modal = document.querySelector(".modal"); // Select any modal
window.addEventListener("click", (event) => {
  if (event.target === userModal) {
    // Prevent closing user modal if profile not set
    if (!myId || !socket.id) {
      return;
    }
    userModal.style.display = "none";
  } else if (event.target === allUsersModal) {
    allUsersModal.style.display = "none";
  } else if (event.target === createGameModal) {
    createGameModal.style.display = "none";
  } else if (event.target === scoreboardModal) {
    scoreboardModal.style.display = "none";
  } else if (event.target === finalScoreboardModal) {
    finalScoreboardModal.style.display = "none";
  }
});

document.getElementById("showUsersBtn").addEventListener("click", () => {
  allUsersModal.style.display = "block";
});

document.getElementById("createGameRoomBtn").addEventListener("click", () => {
  createGameModal.style.display = "block";
  roomNameInput.value = ""; // Clear previous input
});
document
  .getElementById("createGameRoomBtnMobile")
  .addEventListener("click", () => {
    createGameModal.style.display = "block";
    roomNameInput.value = ""; // Clear previous input
  });

document.getElementById("cancelCreateGameBtn").addEventListener("click", () => {
  createGameModal.style.display = "none";
});

document
  .getElementById("closeAllUsersModalBtn")
  .addEventListener("click", () => {
    allUsersModal.style.display = "none";
  });

document
  .getElementById("closeScoreboardModalBtn")
  .addEventListener("click", () => {
    scoreboardModal.style.display = "none";
  });

document
  .getElementById("closeFinalScoreboardModalBtn")
  .addEventListener("click", () => {
    finalScoreboardModal.style.display = "none";
  });

// Background options functionality (existing)
const backgrounds = [
  { name: "Nebula", file: "bg-nebula.jpg" },
  { name: "Forest", file: "bg-forest.jpg" },
  { name: "Abstract", file: "bg-abstract.jpg" },
  { name: "City Night", file: "bg-city-night.jpg" },
  { name: "Ocean", file: "bg-ocean.jpg" },
];

function loadBackgroundOptions() {
  backgroundOptionsContainer.innerHTML = ""; // Clear existing options
  backgrounds.forEach((bg, index) => {
    const option = document.createElement("div");
    option.classList.add("background-option");
    option.style.backgroundImage = `url(./assets/${bg.file})`; // Assuming images are in an assets folder
    option.dataset.backgroundFile = bg.file;
    option.title = bg.name;

    option.addEventListener("click", () => {
      document.body.style.backgroundImage = `url(./assets/${bg.file})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundPosition = "center";
      localStorage.setItem("selectedBackground", bg.file); // Save preference
    });
    backgroundOptionsContainer.appendChild(option);
  });
}

// Load background options on page load
loadBackgroundOptions();

// Apply saved background on load
const savedBackground = localStorage.getItem("selectedBackground");
if (savedBackground) {
  document.body.style.backgroundImage = `url(./assets/${savedBackground})`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundAttachment = "fixed";
  document.body.style.backgroundPosition = "center";
}
