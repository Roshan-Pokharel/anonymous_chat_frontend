const socket = io("https://anonymous-chat-backend-1.onrender.com");
// DOM Elements
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const userList = document.getElementById("userList");
const roomTitle = document.getElementById("roomTitle");
const showUsersBtn = document.getElementById("showUsersBtn");
const themeToggleBtn = document.getElementById("theme-toggle");
const typingIndicator = document.getElementById("typing-indicator");
// --- ✨ NEW: Element selectors for new features ---
const errorMessage = document.getElementById("error-message");
const backgroundInput = document.getElementById("backgroundInput");
const setBackgroundBtn = document.getElementById("setBackgroundBtn");
// ---

// Modal elements
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");

// All users modal (for mobile)
const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");

// State
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = "public";
let myId = null;

// --- TYPING INDICATOR LOGIC ---
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

// --- THEME/DARK MODE LOGIC ---
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

// --- MAIN CHAT LOGIC ---

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

socket.on("nickname taken", () => {
  nicknameInput.style.borderColor = "#e11d48";
  nicknameInput.value = "";
  nicknameInput.placeholder = "Nickname already taken!";
  nicknameInput.focus();
});

socket.on("connect", () => {
  myId = socket.id;
  showUserModal();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit("chat message", { room: currentRoom, text: input.value });
    clearTimeout(typingTimer);
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
    input.value = "";
    setTimeout(() => input.focus(), 10);
  }
});

input.addEventListener("focus", () => {
  setTimeout(() => {
    messages.scrollTop = messages.scrollHeight;
  }, 100);
});

function getGenderSymbol(gender) {
  return gender === "female" ? "♀" : "♂";
}
function getNameColor(gender) {
  return gender === "female" ? "#e75480" : "#3b82f6";
}

function addMessage(msg) {
  const item = document.createElement("div");
  item.classList.add("msg");
  // ✨ NEW: Set message ID attribute for read receipt tracking
  item.setAttribute("data-message-id", msg.messageId);

  const isMe = msg.id && msg.id === myId;
  item.classList.add(isMe ? "me" : "other");

  // ✨ NEW: Read receipt logic for private chats
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

  // ✨ NEW: If this is an incoming message in an active private chat, notify server it has been read
  if (!isMe && isPrivate) {
    socket.emit("message read", {
      room: currentRoom,
      messageId: msg.messageId,
    });
  }
}

socket.on("chat message", (msg) => {
  // When a new message arrives, hide the typing indicator
  if (msg.room === currentRoom) {
    typingIndicator.textContent = "";
    typingIndicator.style.opacity = "0";
  }
  // Handle unread notifications for private messages
  if (msg.room !== "public" && currentRoom !== msg.room && msg.to === myId) {
    unreadPrivate[msg.id] = true;
    updateUserList();
  }
  // Add message to the UI if it's for the current room
  if (msg.room === currentRoom) {
    addMessage(msg);
    if (msg.room !== "public") {
      const otherId = msg.id === myId ? msg.to : msg.id;
      unreadPrivate[otherId] = false;
      updateUserList();
    }
  }
});

socket.on("room history", (msgs) => {
  messages.innerHTML = "";
  msgs.forEach(addMessage);
});

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
      unreadPrivate[user.id] = false; // Mark as read on click
      updateUserList();
    };
    userList.appendChild(div);
  });
}

// ✨ NEW: Central function to handle room switching
function switchRoom(roomName, title) {
  if (currentRoom === roomName) return;
  currentRoom = roomName;
  roomTitle.textContent = title;
  messages.innerHTML = "";
  typingIndicator.textContent = "";
  typingIndicator.style.opacity = "0";
  // Reset background, a new one will be loaded if it exists for the room
  messages.style.backgroundImage = "none";
  socket.emit("join room", currentRoom);
}

socket.on("user list", (users) => {
  latestUsers = users;
  updateUserList();
});

showUsersBtn.onclick = () => {
  if (window.innerWidth <= 768) {
    allUsersList.innerHTML = "";
    const publicBtn = document.createElement("div");
    publicBtn.className = "user";
    publicBtn.style =
      "padding:10px;border-radius:6px;margin-bottom:8px;cursor:pointer;text-align:center;";
    publicBtn.textContent = "🌐 Public Room";
    publicBtn.onclick = () => {
      switchRoom("public", "🌐 Public Chat");
      allUsersModal.style.display = "none";
    };
    allUsersList.appendChild(publicBtn);

    const countDiv = document.createElement("div");
    countDiv.style =
      "text-align:center;margin-bottom:8px;color:#4f46e5;font-weight:600;";
    countDiv.textContent = `Online Users: ${latestUsers.length}`;
    allUsersList.appendChild(countDiv);

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
        unreadPrivate[user.id] = false;
        updateUserList();
        allUsersModal.style.display = "none";
      };
      allUsersList.appendChild(div);
    });
    allUsersModal.style.display = "flex";
  }
};

allUsersModal.addEventListener("click", (e) => {
  if (e.target === allUsersModal) {
    allUsersModal.style.display = "none";
  }
});

// --- ✨ NEW: Event Listeners for new features ---

// Listen for rate limit warnings from server
socket.on("rate limit", (msg) => {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => {
    errorMessage.textContent = "";
    errorMessage.style.opacity = "0";
  }, 3000);
});

// Listen for read receipt updates from server
socket.on("message was read", ({ room, messageId }) => {
  if (room === currentRoom) {
    const messageEl = document.querySelector(
      `.msg[data-message-id="${messageId}"]`
    );
    if (messageEl) {
      const receiptEl = messageEl.querySelector(".read-receipt");
      if (receiptEl) {
        receiptEl.textContent = "✓✓"; // Update to double check
        receiptEl.classList.add("read"); // Add class for styling
      }
    }
  }
});

// Handle setting the background image
setBackgroundBtn.addEventListener("click", () => {
  const url = backgroundInput.value.trim();
  if (url) {
    // Basic URL validation
    if (url.startsWith("http://") || url.startsWith("https://")) {
      socket.emit("set background", { room: currentRoom, backgroundUrl: url });
      backgroundInput.value = "";
    } else {
      alert("Please enter a valid URL (starting with http:// or https://)");
    }
  }
});

// Listen for background updates from the server
socket.on("background updated", ({ room, backgroundUrl }) => {
  if (room === currentRoom) {
    messages.style.backgroundImage = `url(${backgroundUrl})`;
  }
});
// ---

// --- MOBILE KEYBOARD & INITIALIZATION ---
function adjustHeightForKeyboard() {
  if (window.innerWidth <= 768) {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
    setTimeout(() => {
      messages.scrollTop = messages.scrollHeight;
    }, 150);
  }
}

window.addEventListener("resize", adjustHeightForKeyboard);

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);
  adjustHeightForKeyboard();
  input.focus();
});
