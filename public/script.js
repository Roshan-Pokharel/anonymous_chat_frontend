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
const backgroundInput = document.getElementById("backgroundInput");
const setBackgroundBtn = document.getElementById("setBackgroundBtn");

// Modal elements
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");

// All users modal (for mobile view)
const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");

// --- Application State ---
let latestUsers = []; // Cache of the current user list
let unreadPrivate = {}; // Tracks unread messages from users { userId: true }
let currentRoom = "public"; // The room the user is currently in
let myId = null; // The user's own socket ID

// --- Typing Indicator Logic ---
let typingTimer;
let isTyping = false;
const TYPING_TIMER_LENGTH = 1500; // 1.5 seconds

input.addEventListener("input", () => {
  if (input.value.length > 0 && !isTyping) {
    isTyping = true;
    socket.emit("typing", { room: currentRoom });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    // If input is cleared, immediately stop typing
    if (input.value.length === 0) {
      isTyping = false;
      socket.emit("stop typing", { room: currentRoom });
    }
  }, TYPING_TIMER_LENGTH);
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

// --- Theme/Dark Mode Logic ---
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
  const isDarkMode = document.body.classList.contains("dark-mode");
  const newTheme = isDarkMode ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("chatTheme", newTheme);
});

// --- Main Chat Logic ---

// Shows the initial modal to get user information
function showUserModal() {
  userModal.style.display = "flex";
  nicknameInput.focus();

  userForm.onsubmit = function (e) {
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
      ageInput.style.borderColor = "#e75480";
      return;
    }
    socket.emit("user info", { nickname, gender, age });
    userModal.style.display = "none";
    socket.emit("join room", "public");
  };
}

socket.on("connect", () => {
  myId = socket.id;
  showUserModal();
});

// Handle form submission to send a message
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat message", { room: currentRoom, text: input.value });
    clearTimeout(typingTimer);
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
    input.value = "";
    setTimeout(() => input.focus(), 10); // Refocus input after sending
  }
});

// Helper functions for styling
function getGenderSymbol(gender) {
  return gender === "female" ? "♀" : "♂";
}
function getNameColor(gender) {
  return gender === "female" ? "#e75480" : "#3b82f6";
}

// Adds a message bubble to the chat window
function addMessage(msg) {
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

  item.innerHTML = `
    <div class="bubble">
      <span style="color:${getNameColor(msg.gender)};font-weight:600;">
        ${msg.name} ${getGenderSymbol(msg.gender)}${
    msg.age ? " · " + msg.age : ""
  }:</span> ${msg.text}
      ${readReceiptHTML}
    </div>
  `;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;

  // If this is an incoming message in an active private chat, notify server it has been read
  if (!isMe && isPrivate) {
    socket.emit("message read", {
      room: currentRoom,
      messageId: msg.messageId,
    });
  }
}

// Listener for incoming chat messages
socket.on("chat message", (msg) => {
  if (msg.room === currentRoom) {
    typingIndicator.textContent = "";
    typingIndicator.style.opacity = "0";
  }
  if (msg.room !== "public" && currentRoom !== msg.room && msg.to === myId) {
    unreadPrivate[msg.id] = true;
    updateUserList();
  }
  if (msg.room === currentRoom) {
    addMessage(msg);
    if (msg.room !== "public") {
      const otherId = msg.id === myId ? msg.to : msg.id;
      delete unreadPrivate[otherId];
      updateUserList();
    }
  }
});

// Listener for receiving room history
socket.on("room history", (msgs) => {
  messages.innerHTML = "";
  msgs.forEach(addMessage);
});

// Updates the user list in the sidebar
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
      `<span style="color:${getNameColor(user.gender)};font-weight:600;">
      ${user.name} ${getGenderSymbol(user.gender)}${
        user.age ? " · " + user.age : ""
      }</span>` +
      (unreadPrivate[user.id] ? '<span class="red-dot"></span>' : "");
    div.onclick = () => {
      const privateRoomName = [myId, user.id].sort().join("-");
      switchRoom(privateRoomName, `🔒 Chat with ${user.name}`);
      delete unreadPrivate[user.id]; // Mark as read on click
      updateUserList();
    };
    userList.appendChild(div);
  });
}

// Central function to handle switching rooms
function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;
  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";

  // --- FIX FOR BACKGROUND IMAGE ---
  // Reset background and remove the helper class when switching rooms
  messages.style.backgroundImage = "none";
  messages.classList.remove("has-background");
  // --- END FIX ---

  socket.emit("join room", currentRoom);
}

// Listener for user list updates
socket.on("user list", (users) => {
  latestUsers = users;
  updateUserList();
});

// --- Mobile-specific Logic ---
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
      `<span style="color:${getNameColor(user.gender)};font-weight:600;">
        ${user.name} ${getGenderSymbol(user.gender)}${
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
  allUsersModal.style.display = "flex";
};

allUsersModal.addEventListener("click", (e) => {
  if (e.target === allUsersModal) {
    allUsersModal.style.display = "none";
  }
});

// --- Event Listeners for New Features ---

socket.on("rate limit", (msg) => {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => {
    errorMessage.textContent = "";
    errorMessage.style.opacity = "0";
  }, 3000);
});

socket.on("message was read", ({ room, messageId }) => {
  if (room === currentRoom) {
    const messageEl = document.querySelector(
      `.msg[data-message-id="${messageId}"]`
    );
    if (messageEl) {
      const receiptEl = messageEl.querySelector(".read-receipt");
      if (receiptEl) {
        receiptEl.textContent = "✓✓";
        receiptEl.classList.add("read");
      }
    }
  }
});

setBackgroundBtn.addEventListener("click", () => {
  const url = backgroundInput.value.trim();
  if (url) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      socket.emit("set background", { room: currentRoom, backgroundUrl: url });
      backgroundInput.value = "";
    } else {
      errorMessage.textContent = "Please enter a valid URL.";
      errorMessage.style.opacity = "1";
      setTimeout(() => {
        errorMessage.style.opacity = "0";
      }, 3000);
    }
  }
});

// --- FIX FOR BACKGROUND IMAGE ---
// Listen for background updates from the server
socket.on("background updated", ({ room, backgroundUrl }) => {
  if (room === currentRoom) {
    messages.style.backgroundImage = `url(${backgroundUrl})`;
    // Add a class to enable semi-transparent bubble styles
    messages.classList.add("has-background");
  }
});
// --- END FIX ---

// --- Mobile Keyboard & Initialization ---
function adjustHeightForKeyboard() {
  if (window.innerWidth <= 768) {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
}

window.addEventListener("resize", adjustHeightForKeyboard);

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);
  adjustHeightForKeyboard();
});
