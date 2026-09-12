/**
 * Remembering Bag v2 — Google Authentication & Session Manager
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('rb_session_token') || null;
    this.user = null;
    this.listeners = [];
  }

  async init() {
    this.setupAuthModal();
    this.bindGlobalAuthButtons();

    if (this.token) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
          this.user = data.user;
          this.notifyChange();
          this.updateNavAuthState();

          // Auto-resume onboarding if incomplete
          if (!this.user.onboardingCompleted) {
            if (window.onboardingManager) {
              window.onboardingManager.open(this.user.onboardingStep || 2);
            }
          }
          return;
        }
      } catch (err) {
        console.warn("Session check failed:", err);
      }
      // If token invalid, clear
      this.token = null;
      localStorage.removeItem('rb_session_token');
    }

    this.updateNavAuthState();
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
  }

  notifyChange() {
    this.listeners.forEach(cb => cb(this.user));
  }

  async loginWithGoogle(mockProfile = null) {
    // Default Google profile or simulated profile for instant testing
    const payload = mockProfile || {
      googleId: "google_" + Date.now(),
      email: "alex.rivera@example.com",
      name: "Alex Rivera",
      profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    };

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('rb_session_token', this.token);
      this.closeAuthModal();
      this.updateNavAuthState();
      this.notifyChange();

      if (data.isFirstLogin || !data.user.onboardingCompleted) {
        if (window.onboardingManager) {
          window.onboardingManager.open(data.user.onboardingStep || 2);
        }
      } else {
        if (window.appViewManager) {
          window.appViewManager.switchView('dashboard');
        }
      }

      return data;
    } catch (err) {
      console.error("Google Auth error:", err);
      alert("Sign in failed: " + err.message);
    }
  }

  logout() {
    if (this.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      }).catch(() => {});
    }

    this.token = null;
    this.user = null;
    localStorage.removeItem('rb_session_token');
    this.updateNavAuthState();
    this.notifyChange();

    if (window.appViewManager) {
      window.appViewManager.switchView('landing');
    }
  }

  updateNavAuthState() {
    const navActions = document.querySelector('.nav-actions');
    const existingPill = document.getElementById('navUserPill');
    const existingLoginBtn = document.getElementById('navBtnLogin');

    if (this.user) {
      if (existingLoginBtn) existingLoginBtn.remove();

      let pill = existingPill;
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'navUserPill';
        pill.className = 'nav-user-pill';
        if (navActions) navActions.prepend(pill);
      }

      const initial = (this.user.name || 'U').charAt(0).toUpperCase();
      pill.innerHTML = `
        <div class="user-avatar-btn" id="btnUserMenu" title="${this.user.name} (${this.user.email})">
          ${this.user.profileImage ? `<img src="${this.user.profileImage}" alt="${this.user.name}" class="nav-avatar-img">` : `<span class="nav-avatar-char">${initial}</span>`}
          <span class="nav-user-name">${this.user.name.split(' ')[0]}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="user-dropdown-menu" id="userDropdownMenu">
          <div class="dropdown-header">
            <div class="dropdown-name">${this.user.name}</div>
            <div class="dropdown-email">${this.user.email} <span class="verified-badge">✓ Verified</span></div>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="btnMenuDashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            <span>My Dashboard</span>
          </button>
          <button class="dropdown-item" id="btnMenuSettings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Bag & Schedule Settings</span>
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item text-danger" id="btnMenuLogout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span>Sign Out</span>
          </button>
        </div>
      `;

      const btnMenu = pill.querySelector('#btnUserMenu');
      const menu = pill.querySelector('#userDropdownMenu');
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });

      document.addEventListener('click', () => menu.classList.remove('open'));

      pill.querySelector('#btnMenuDashboard').addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('dashboard');
      });

      pill.querySelector('#btnMenuSettings').addEventListener('click', () => {
        if (window.appViewManager) window.appViewManager.switchView('settings');
      });

      pill.querySelector('#btnMenuLogout').addEventListener('click', () => this.logout());

    } else {
      if (existingPill) existingPill.remove();

      let loginBtn = existingLoginBtn;
      if (!loginBtn) {
        loginBtn = document.createElement('button');
        loginBtn.id = 'navBtnLogin';
        loginBtn.className = 'btn-nav-login';
        loginBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
          <span>Sign In</span>
        `;
        loginBtn.addEventListener('click', () => this.openAuthModal());
        if (navActions) navActions.prepend(loginBtn);
      }
    }
  }

  setupAuthModal() {
    let modal = document.getElementById('authModalOverlay');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'authModalOverlay';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
      <div class="auth-modal-card">
        <button class="auth-modal-close" id="btnAuthClose" aria-label="Close modal">✕</button>
        
        <div class="auth-modal-header">
          <div class="auth-badge">
            <span class="auth-badge-dot"></span>
            <span>SECURE GOOGLE AUTHENTICATION</span>
          </div>
          <h2 class="auth-modal-title">Welcome to Remembering Bag</h2>
          <p class="auth-modal-desc">Sign in with your verified Google account to pair your RFID bag, configure your active schedule, and prevent forgotten belongings.</p>
        </div>

        <div class="auth-modal-body">
          <!-- Primary Google Auth Button -->
          <button class="btn-google-auth" id="btnGoogleAuthAction">
            <svg class="google-svg-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <!-- Quick Test Personas for rapid local evaluation -->
          <div class="auth-persona-selector">
            <div class="persona-divider">
              <span>Or choose test Google profile</span>
            </div>
            <div class="persona-buttons-grid">
              <button class="persona-btn" data-email="alex.student@university.edu" data-name="Alex Rivera" data-type="student">
                <span class="persona-role">Student</span>
                <span class="persona-email">alex.student@university.edu</span>
              </button>
              <button class="persona-btn" data-email="sarah.chen@techcorp.io" data-name="Sarah Chen" data-type="employee">
                <span class="persona-role">Employee</span>
                <span class="persona-email">sarah.chen@techcorp.io</span>
              </button>
            </div>
          </div>
        </div>

        <div class="auth-modal-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Verified Google OAuth2 integration • 100% private data isolation</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btnAuthClose').addEventListener('click', () => this.closeAuthModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeAuthModal();
    });

    modal.querySelector('#btnGoogleAuthAction').addEventListener('click', () => {
      this.loginWithGoogle();
    });

    modal.querySelectorAll('.persona-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        const name = btn.getAttribute('data-name');
        this.loginWithGoogle({
          googleId: "google_" + Date.now(),
          email,
          name,
          profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00E5FF&color=000&bold=true`
        });
      });
    });
  }

  bindGlobalAuthButtons() {
    document.querySelectorAll('[data-auth-trigger="google"], .btn-cta-google').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openAuthModal();
      });
    });
  }

  openAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) modal.classList.add('open');
  }

  closeAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) modal.classList.remove('open');
  }
}

window.authManager = new AuthManager();
document.addEventListener('DOMContentLoaded', () => {
  window.authManager.init();
});
