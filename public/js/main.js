// Secure-Chat-Hub Main JavaScript

class SecureChatHub {
    constructor() {
        this.apiBase = window.location.origin;
        this.init();
    }

    async init() {
        console.log('🔐 Initializing Secure-Chat-Hub...');
        
        try {
            // Check server health
            const health = await this.checkHealth();
            console.log('✅ Server is healthy:', health);
            
            // Render main UI
            this.renderMainUI();
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showError('Failed to connect to server');
        }
    }

    async checkHealth() {
        const response = await fetch(`${this.apiBase}/api/health`);
        if (!response.ok) {
            throw new Error('Health check failed');
        }
        return await response.json();
    }

    renderMainUI() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="chat-container">
                <header class="chat-header">
                    <h1>🔐 Secure-Chat-Hub</h1>
                    <p>Secure, private, encrypted messaging</p>
                </header>
                
                <main class="chat-main">
                    <div class="welcome-section">
                        <div class="card">
                            <h2>Welcome to Secure-Chat-Hub</h2>
                            <p>A modern, secure real-time chat application with end-to-end encryption.</p>
                            
                            <div class="features">
                                <h3>✨ Features</h3>
                                <ul>
                                    <li>🔒 End-to-end encryption</li>
                                    <li>⚡ Real-time messaging</li>
                                    <li>👥 Multiple chat rooms</li>
                                    <li>📱 Mobile responsive</li>
                                    <li>🔐 Secure authentication</li>
                                </ul>
                            </div>
                            
                            <div class="auth-buttons">
                                <button class="btn btn-primary" onclick="app.handleLogin()">Login</button>
                                <button class="btn btn-secondary" onclick="app.handleSignup()">Sign Up</button>
                            </div>
                        </div>
                    </div>
                </main>
                
                <footer class="chat-footer">
                    <p>&copy; 2026 Secure-Chat-Hub. All rights reserved.</p>
                </footer>
            </div>
        `;
    }

    handleLogin() {
        console.log('🔓 Login initiated');
        this.showNotification('Login feature coming soon!', 'warning');
    }

    handleSignup() {
        console.log('📝 Sign up initiated');
        this.showNotification('Sign up feature coming soon!', 'warning');
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // TODO: Implement notification UI
    }

    showError(message) {
        console.error('❌', message);
        this.showNotification(message, 'error');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SecureChatHub();
});
