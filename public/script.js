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
const backgroundOptionsMobileContainer = document.getElementById(
  "backgroundOptionsMobile"
);

// Modal elements
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const nicknameInput = document.getElementById("nicknameInput");
const ageInput = document.getElementById("ageInput");

// All users modal (for mobile view)
const allUsersModal = document.getElementById("allUsersModal");
const allUsersList = document.getElementById("allUsersList");

// --- Application State ---
let latestUsers = [];
let unreadPrivate = {};
let currentRoom = "public";
let myId = null;

// --- PREDEFINED BACKGROUNDS (Client-side) ---
const predefinedBackgrounds = [
  "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?q=80&w=1374&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1575&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1470&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=1332&auto=format&fit=crop",
];

// --- TYPING INDICATOR LOGIC ---
let typingTimer;
let isTyping = false;
const TYPING_TIMER_LENGTH = 1500; // 1.5 seconds

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
      ageInput.style.borderColor = "var(--error-color)";
      return;
    }
    socket.emit("user info", { nickname, gender, age });
    userModal.style.display = "none";
    socket.emit("join room", "public"); // Automatically join public chat
  };
}

// Handle connection event
socket.on("connect", () => {
  myId = socket.id;
  showUserModal();
});

// Handle form submission to send a message
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit("chat message", { room: currentRoom, text: input.value });
    clearTimeout(typingTimer);
    isTyping = false;
    socket.emit("stop typing", { room: currentRoom });
    input.value = "";
    setTimeout(() => input.focus(), 10); // Refocus input after sending
  }
});

// Helper functions for styling user info
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
      <span style="color:${getNameColor(msg.gender)};">
        ${msg.name} ${getGenderSymbol(msg.gender)}${
    msg.age ? " · " + msg.age : ""
  }
      </span>
      ${msg.text}
      ${readReceiptHTML}
    </div>`;
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
  // Stop typing indicator when a message arrives from someone
  if (msg.room === currentRoom) {
    typingIndicator.textContent = "";
    typingIndicator.style.opacity = "0";
  }
  // Handle unread message notifications for private chats
  if (msg.room !== "public" && currentRoom !== msg.room && msg.to === myId) {
    unreadPrivate[msg.id] = true;
    updateUserList();
  }
  // Display the message if it's for the current room
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
  // Add public room button
  const publicBtn = document.createElement("div");
  publicBtn.className = "user";
  publicBtn.textContent = "🌐 Public Room";
  publicBtn.onclick = () => switchRoom("public", "🌐 Public Chat");
  userList.appendChild(publicBtn);

  // Add all other online users
  latestUsers.forEach((user) => {
    if (user.id === myId) return; // Don't show myself in the list
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
      delete unreadPrivate[user.id]; // Mark as read on click
      updateUserList(); // Refresh list to remove red dot
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
  socket.emit("join room", currentRoom);
}

// Listener for user list updates from server
socket.on("user list", (users) => {
  latestUsers = users;
  updateUserList();
});

// --- Mobile-specific Logic ---
showUsersBtn.onclick = () => {
  allUsersList.innerHTML = ""; // Clear previous list
  // Add public room button to mobile modal
  const publicBtn = document.createElement("div");
  publicBtn.className = "user";
  publicBtn.textContent = "🌐 Public Room";
  publicBtn.onclick = () => {
    switchRoom("public", "🌐 Public Chat");
    allUsersModal.style.display = "none";
  };
  allUsersList.appendChild(publicBtn);

  // Add all other users to mobile modal
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

  // Populate background options in the modal
  populateBackgroundOptions(backgroundOptionsMobileContainer);

  allUsersModal.style.display = "flex";
};

// Close modal if clicking outside the content area
allUsersModal.addEventListener("click", (e) => {
  if (e.target === allUsersModal) {
    allUsersModal.style.display = "none";
  }
});

// --- Event Listeners for New Features ---

// Display rate limit errors
socket.on("rate limit", (msg) => {
  errorMessage.textContent = msg;
  errorMessage.style.opacity = "1";
  setTimeout(() => {
    errorMessage.textContent = "";
    errorMessage.style.opacity = "0";
  }, 3000);
});

// Update read receipts
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

// --- Background Image Logic (Client-Side) ---

// Applies a background image to the chat window
function applyBackground(backgroundUrl) {
  if (backgroundUrl) {
    messages.style.backgroundImage = `url(${backgroundUrl})`;
    messages.classList.add("has-background");
    localStorage.setItem("chatBackground", backgroundUrl);
  } else {
    // This is for clearing the background
    messages.style.backgroundImage = "none";
    messages.classList.remove("has-background");
    localStorage.removeItem("chatBackground");
  }
}

// This function creates the clickable background thumbnails.
// It now accepts a container element to be more reusable.
function populateBackgroundOptions(container) {
  if (!container) return;
  container.innerHTML = ""; // Clear existing options to prevent duplicates

  // Add a "Default" button first
  const defaultOption = document.createElement("button");
  defaultOption.className = "background-option-default";
  defaultOption.textContent = "Default";
  defaultOption.title = "Reset to default background";
  defaultOption.addEventListener("click", () => {
    applyBackground(null); // Pass null to clear the background
  });
  container.appendChild(defaultOption);

  // Add the predefined image thumbnails
  predefinedBackgrounds.forEach((url) => {
    const option = document.createElement("div");
    option.className = "background-option";
    option.style.backgroundImage = `url(${url})`;
    option.title = `Set background`;

    option.addEventListener("click", () => {
      applyBackground(url); // Apply background locally
    });

    container.appendChild(option);
  });
}

// --- Mobile Keyboard & Initialization ---
// Adjusts viewport height for mobile browsers to avoid issues with on-screen keyboards.
function adjustHeightForKeyboard() {
  if (window.innerWidth <= 768) {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }
}

window.addEventListener("resize", adjustHeightForKeyboard);

// On initial page load
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("chatTheme") || "light";
  applyTheme(savedTheme);

  const savedBackground = localStorage.getItem("chatBackground");
  if (savedBackground) {
    applyBackground(savedBackground);
  }

  adjustHeightForKeyboard();
  // Populate background options for desktop sidebar
  populateBackgroundOptions(backgroundOptionsContainer);
});
