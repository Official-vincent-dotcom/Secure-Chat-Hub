// Secure-Chat-Hub Main Application

class SecureChatHub {
  constructor() {
    this.apiBase = window.location.origin;
    this.token = localStorage.getItem('token');
    this.currentUser = null;
    this.currentRoom = null;
    this.socket = null;
    this.encryptionKey = null;
    this.init();
  }

  async init() {
    console.log('🔐 Initializing Secure-Chat-Hub...');
    
    try {
      if (this.token) {
        // User is logged in
        const user = JSON.parse(localStorage.getItem('user'));
        this.currentUser = user;
        this.initSocket();
        this.renderChatUI();
      } else {
        // User not logged in
        this.renderAuthUI();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.renderAuthUI();
    }
  }

  initSocket() {
    this.socket = io(this.apiBase, {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    this.socket.on('newMessage', (message) => {
      this.displayMessage(message);
    });

    this.socket.on('userTyping', (data) => {
      this.showTypingIndicator(data.username);
    });

    this.socket.on('userStopTyping', () => {
      this.hideTypingIndicator();
    });

    this.socket.on('error', (error) => {
      this.showNotification(error, 'error');
    });
  }

  renderAuthUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-container">
        <header class="auth-header">
          <h1>🔐 Secure-Chat-Hub</h1>
          <p>Secure, private, encrypted messaging</p>
        </header>
        
        <div class="auth-card">
          <ul class="auth-tabs">
            <li class="tab active" data-tab="login">Login</li>
            <li class="tab" data-tab="signup">Sign Up</li>
          </ul>

          <div id="login" class="tab-content active">
            <form id="loginForm" class="auth-form">
              <div class="form-group">
                <label for="loginEmail">Email</label>
                <input type="email" id="loginEmail" placeholder="your@email.com" required>
              </div>
              <div class="form-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" placeholder="Your password" required>
              </div>
              <button type="submit" class="btn btn-primary">Login</button>
            </form>
          </div>

          <div id="signup" class="tab-content">
            <form id="signupForm" class="auth-form">
              <div class="form-group">
                <label for="signupUsername">Username</label>
                <input type="text" id="signupUsername" placeholder="username" required>
              </div>
              <div class="form-group">
                <label for="signupEmail">Email</label>
                <input type="email" id="signupEmail" placeholder="your@email.com" required>
              </div>
              <div class="form-group">
                <label for="signupPassword">Password</label>
                <input type="password" id="signupPassword" placeholder="At least 6 characters" required>
              </div>
              <div class="form-group">
                <label for="signupConfirmPassword">Confirm Password</label>
                <input type="password" id="signupConfirmPassword" placeholder="Confirm password" required>
              </div>
              <button type="submit" class="btn btn-primary">Sign Up</button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('signupForm').addEventListener('submit', (e) => this.handleSignup(e));
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const response = await fetch(`${this.apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.token = data.token;
        this.currentUser = data.user;
        this.initSocket();
        this.renderChatUI();
      } else {
        this.showNotification(data.error || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showNotification('Network error', 'error');
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    try {
      const response = await fetch(`${this.apiBase}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirmPassword })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.token = data.token;
        this.currentUser = data.user;
        this.initSocket();
        this.renderChatUI();
      } else {
        this.showNotification(data.error || 'Signup failed', 'error');
      }
    } catch (error) {
      console.error('Signup error:', error);
      this.showNotification('Network error', 'error');
    }
  }

  renderChatUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="chat-wrapper">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Rooms</h2>
            <button class="btn-icon" onclick="app.showCreateRoomModal()">➕</button>
          </div>
          <div id="roomsList" class="rooms-list"></div>
        </aside>

        <main class="chat-main">
          <div id="chatArea" class="chat-area">
            <div class="welcome-message">
              <h2>Welcome to Secure-Chat-Hub</h2>
              <p>Select or create a room to start chatting</p>
            </div>
          </div>
        </main>

        <aside class="user-panel">
          <div class="user-info">
            <h3>${this.currentUser.username}</h3>
            <p>${this.currentUser.email}</p>
            <button class="btn btn-secondary" onclick="app.logout()">Logout</button>
          </div>
        </aside>
      </div>

      <div id="createRoomModal" class="modal hidden">
        <div class="modal-content">
          <h3>Create New Room</h3>
          <form id="createRoomForm">
            <div class="form-group">
              <label for="roomName">Room Name</label>
              <input type="text" id="roomName" required>
            </div>
            <div class="form-group">
              <label for="roomDescription">Description</label>
              <input type="text" id="roomDescription">
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="isPrivate">
                Private Room
              </label>
            </div>
            <button type="submit" class="btn btn-primary">Create</button>
          </form>
          <button class="btn-close" onclick="app.closeModal()">✕</button>
        </div>
      </div>
    `;

    this.loadRooms();
    document.getElementById('createRoomForm').addEventListener('submit', (e) => this.handleCreateRoom(e));
  }

  async loadRooms() {
    try {
      const response = await fetch(`${this.apiBase}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      const roomsList = document.getElementById('roomsList');
      roomsList.innerHTML = '';

      if (data.rooms.length === 0) {
        roomsList.innerHTML = '<p class="empty-state">No rooms yet. Create one!</p>';
        return;
      }

      data.rooms.forEach(room => {
        const roomEl = document.createElement('div');
        roomEl.className = 'room-item';
        roomEl.innerHTML = `
          <div class="room-info">
            <h4>${room.name}</h4>
            <p>${room.members.length} members</p>
          </div>
        `;
        roomEl.addEventListener('click', () => this.selectRoom(room));
        roomsList.appendChild(roomEl);
      });
    } catch (error) {
      console.error('Load rooms error:', error);
    }
  }

  async selectRoom(room) {
    this.currentRoom = room;
    this.socket.emit('joinRoom', room._id);
    this.renderChatArea(room);
    this.loadMessages(room._id);
  }

  renderChatArea(room) {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
      <div class="chat-header">
        <h2>${room.name}</h2>
        <p>${room.description || 'No description'}</p>
      </div>

      <div id="messagesContainer" class="messages-container"></div>

      <div class="message-input-area">
        <input type="text" id="messageInput" placeholder="Type a message..." />
        <button id="sendBtn" class="btn-icon">📤</button>
      </div>
    `;

    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => this.sendMessage());

    messageInput.addEventListener('input', () => {
      this.socket.emit('typing', {
        roomId: room._id,
        username: this.currentUser.username
      });
    });
  }

  async loadMessages(roomId) {
    try {
      const response = await fetch(`${this.apiBase}/api/messages/${roomId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      const container = document.getElementById('messagesContainer');
      container.innerHTML = '';

      data.messages.forEach(message => {
        this.displayMessage(message);
      });

      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Load messages error:', error);
    }
  }

  displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    const isOwnMessage = message.sender._id === this.currentUser.id;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    messageEl.innerHTML = `
      <div class="message-content">
        <div class="message-header">
          <strong>${message.sender.username}</strong>
          <span class="timestamp">${new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <div class="message-text">${this.escapeHtml(message.content)}</div>
      </div>
    `;

    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
  }

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content || !this.currentRoom) return;

    try {
      this.socket.emit('sendMessage', {
        roomId: this.currentRoom._id,
        content,
        encryptionKey: this.encryptionKey
      });

      input.value = '';
      this.socket.emit('stopTyping', this.currentRoom._id);
    } catch (error) {
      console.error('Send message error:', error);
      this.showNotification('Failed to send message', 'error');
    }
  }

  async handleCreateRoom(e) {
    e.preventDefault();
    const name = document.getElementById('roomName').value;
    const description = document.getElementById('roomDescription').value;
    const isPrivate = document.getElementById('isPrivate').checked;

    try {
      const response = await fetch(`${this.apiBase}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ name, description, isPrivate })
      });

      const data = await response.json();

      if (response.ok) {
        this.closeModal();
        this.loadRooms();
        this.showNotification('Room created successfully', 'success');
      } else {
        this.showNotification(data.error || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('Create room error:', error);
      this.showNotification('Network error', 'error');
    }
  }

  showCreateRoomModal() {
    document.getElementById('createRoomModal').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('createRoomModal').classList.add('hidden');
  }

  showTypingIndicator(username) {
    const indicator = document.querySelector('.typing-indicator');
    if (!indicator) {
      const container = document.getElementById('messagesContainer');
      const div = document.createElement('div');
      div.className = 'typing-indicator';
      div.innerHTML = `<p>${username} is typing...</p>`;
      container.appendChild(div);
    }
  }

  hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
  }

  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: Implement notification UI
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (this.socket) this.socket.disconnect();
    this.token = null;
    this.currentUser = null;
    this.renderAuthUI();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SecureChatHub();
});