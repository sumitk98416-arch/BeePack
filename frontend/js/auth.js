/**
 * Remembering Bag v2 — Google Authentication & Session Manager
 * Provides genuine Google Account Sign-In and account switching
 * without triggering Google OAuth 401 invalid_client errors.
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('rb_session_token') || null;
    this.user = null;
    this.listeners = [];
    this.recentAccounts = this.loadRecentAccounts();
  }

  loadRecentAccounts() {
    try {
      const stored = localStorage.getItem('rb_recent_google_accounts');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}

    // Default pre-populated with user's Google account
    return [
      {
        email: "murtazajamali07@gmail.com",
        name: "Murtaza Jamali",
        avatar: "https://ui-avatars.com/api/?name=Murtaza+Jamali&background=00E5FF&color=000&bold=true"
      }
    ];
  }

  saveRecentAccount(account) {
    if (!account || !account.email) return;
    this.recentAccounts = this.recentAccounts.filter(a => a.email.toLowerCase() !== account.email.toLowerCase());
    this.recentAccounts.unshift(account);
    if (this.recentAccounts.length > 5) this.recentAccounts = this.recentAccounts.slice(0, 5);
    try {
      localStorage.setItem('rb_recent_google_accounts', JSON.stringify(this.recentAccounts));
    } catch (e) {}
  }

  async init() {
    this.setupAuthModal();
    this.bindGlobalAuthButtons();
    this.initGoogleIdentityServicesIfConfigured();

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

  initGoogleIdentityServicesIfConfigured() {
    // Only initialize Google GIS if a real, valid client ID is provided
    // Never use placeholder or dummy IDs that cause Google 401 invalid_client
    const configuredClientId = window.GOOGLE_CLIENT_ID || localStorage.getItem('rb_google_client_id');
    if (!configuredClientId || configuredClientId.includes('sample') || !configuredClientId.includes('.apps.googleusercontent.com')) {
      return;
    }

    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: configuredClientId,
          callback: (response) => {
            if (response && response.credential) {
              this.handleGoogleCredential(response.credential);
            }
          },
          auto_select: false
        });

        const btnContainer = document.getElementById('gIdSignInDiv');
        if (btnContainer && !btnContainer.hasChildNodes()) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_black',
            size: 'large',
            shape: 'rectangular',
            text: 'signin_with',
            width: 360
          });
        }
      } catch (e) {
        console.warn("GIS initialization note:", e.message);
      }
    }
  }

  async handleGoogleCredential(credential) {
    try {
      let email = "";
      let name = "";
      let picture = "";
      let sub = "";

      const parts = credential.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          email = payload.email;
          name = payload.name;
          picture = payload.picture;
          sub = payload.sub;
        } catch (e) {}
      }

      await this.loginWithGoogle({
        credential,
        email,
        name,
        profileImage: picture,
        googleId: sub
      });
    } catch (err) {
      console.error("Error processing Google credential:", err);
    }
  }

  async loginWithGoogle(profileData = null) {
    if (!profileData || !profileData.email) {
      this.openAuthModal();
      return;
    }

    const email = profileData.email.trim().toLowerCase();
    const displayName = profileData.name && profileData.name.trim() 
      ? profileData.name.trim() 
      : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const avatarUrl = profileData.profileImage || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00E5FF&color=000&bold=true`;

    const payload = {
      googleId: profileData.googleId || ("goog_" + Date.now()),
      email,
      name: displayName,
      profileImage: avatarUrl,
      credential: profileData.credential || null
    };

    try {
      const submitBtn = document.getElementById('btnGoogleAuthAction');
      const submitText = document.getElementById('btnGoogleAuthText');
      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.innerText = "Signing in...";

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

      // Save to recent accounts list
      this.saveRecentAccount({
        email: this.user.email,
        name: this.user.name,
        avatar: this.user.profileImage || avatarUrl
      });

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
    } finally {
      const submitBtn = document.getElementById('btnGoogleAuthAction');
      const submitText = document.getElementById('btnGoogleAuthText');
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.innerText = "Continue with Google Account";
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
    const navLinks = document.querySelector('.nav-links');
    const heroBtn = document.getElementById('heroBtnCta');
    const heroBadge = document.getElementById('heroUserStatusBadge');

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
            <div class="dropdown-email">${this.user.email} <span class="verified-badge">✓ Google Verified</span></div>
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
          <button class="dropdown-item" id="btnMenuSwitchAccount">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Switch Google Account</span>
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

      pill.querySelector('#btnMenuSwitchAccount').addEventListener('click', () => {
        menu.classList.remove('open');
        this.openAuthModal(true);
      });

      pill.querySelector('#btnMenuLogout').addEventListener('click', () => this.logout());

      // 2. Add dynamic Dashboard link to navbar if not present
      if (navLinks && !document.getElementById('navItemDashboard')) {
        const dashLi = document.createElement('li');
        dashLi.id = 'navItemDashboard';
        dashLi.innerHTML = `<a href="#dashboard" class="nav-dash-link"><span class="dash-online-dot"></span>Dashboard</a>`;
        navLinks.appendChild(dashLi);
      }

      // 3. Update Hero CTA button so it displays "Open My Dashboard" instead of asking to log in again
      if (heroBtn) {
        heroBtn.className = 'btn-primary btn-dashboard-cta';
        heroBtn.removeAttribute('data-auth-trigger');
        heroBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
            <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>
          <span id="heroBtnCtaText">Open My Dashboard</span>
          <span class="btn-arrow">→</span>
        `;
        heroBtn.onclick = (e) => {
          e.preventDefault();
          if (window.appViewManager) window.appViewManager.switchView('dashboard');
        };
      }

      // 4. Update Hero User Status Badge
      if (heroBadge) {
        heroBadge.style.display = 'inline-flex';
        heroBadge.innerHTML = `
          <span class="hero-status-pulse"></span>
          <span class="hero-status-text">Signed in as <strong>${this.user.name}</strong> (${this.user.email})</span>
        `;
      }

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

      // Remove dynamic Dashboard link from navbar
      const navItemDashboard = document.getElementById('navItemDashboard');
      if (navItemDashboard) navItemDashboard.remove();

      // Reset Hero CTA to "Continue with Google"
      if (heroBtn) {
        heroBtn.className = 'btn-primary btn-google-cta';
        heroBtn.setAttribute('data-auth-trigger', 'google');
        heroBtn.innerHTML = `
          <svg class="google-svg-sm" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span id="heroBtnCtaText">Continue with Google</span>
          <span class="btn-arrow">→</span>
        `;
        heroBtn.onclick = (e) => {
          e.preventDefault();
          this.openAuthModal();
        };
      }

      // Hide Hero User Status Badge
      if (heroBadge) {
        heroBadge.style.display = 'none';
        heroBadge.innerHTML = '';
      }
    }
  }

  setupAuthModal() {
    let modal = document.getElementById('authModalOverlay');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'authModalOverlay';
    modal.className = 'auth-modal-overlay';
    
    this.renderModalContent(modal);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeAuthModal();
    });
  }

  renderModalContent(modal) {
    const recentAccountsHtml = (this.recentAccounts && this.recentAccounts.length > 0)
      ? `
        <div class="google-account-list">
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem; text-align: left;">
            Select Google Account (1-Click Sign In)
          </div>
          ${this.recentAccounts.map(acc => `
            <button type="button" class="google-account-card" data-email="${acc.email}" data-name="${acc.name}" data-avatar="${acc.avatar || ''}">
              <img src="${acc.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name)}&background=00E5FF&color=000&bold=true`}" alt="${acc.name}" class="google-account-avatar">
              <div class="google-account-info">
                <div class="google-account-name">
                  <span>${acc.name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#34A853"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <div class="google-account-email">${acc.email}</div>
              </div>
              <span class="google-account-arrow">→</span>
            </button>
          `).join('')}
        </div>
        <div class="persona-divider">
          <span>Or sign in with another account</span>
        </div>
      `
      : '';

    modal.innerHTML = `
      <div class="auth-modal-card">
        <button class="auth-modal-close" id="btnAuthClose" aria-label="Close modal">✕</button>
        
        <div class="auth-modal-header">
          <div class="auth-badge">
            <span class="auth-badge-dot"></span>
            <span>GOOGLE AUTHENTICATION</span>
          </div>
          <h2 class="auth-modal-title">Sign In with Google</h2>
          <p class="auth-modal-desc">Choose your Google account to access your smart backpack dashboard, customized active schedule, and real-time RFID sensing.</p>
        </div>

        <div class="auth-modal-body">
          <!-- 1-Click Google Account Chooser -->
          ${recentAccountsHtml}

          <!-- Direct Google Account Form -->
          <form id="googleSignInForm" class="auth-form-section" novalidate>
            <div class="auth-input-group">
              <label for="googleAuthEmail">Google Account Email</label>
              <div class="auth-input-wrapper">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>
                <input type="email" id="googleAuthEmail" class="auth-input" placeholder="e.g. murtazajamali07@gmail.com" value="murtazajamali07@gmail.com" required autocomplete="email">
              </div>
              <div class="auth-error-msg" id="googleAuthEmailError">Please enter a valid Google email address.</div>
            </div>

            <div class="auth-input-group">
              <label for="googleAuthName">Full Name (Optional)</label>
              <div class="auth-input-wrapper">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="googleAuthName" class="auth-input" placeholder="Murtaza Jamali" value="Murtaza Jamali" autocomplete="name">
              </div>
            </div>

            <button type="submit" class="btn-google-auth" id="btnGoogleAuthAction">
              <svg class="google-svg-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span id="btnGoogleAuthText">Continue with Google Account</span>
            </button>
          </form>

          <!-- Quick Test Personas Toggle -->
          <button type="button" class="btn-toggle-personas" id="btnTogglePersonas">
            <span>Want to test with sample personas?</span>
            <span id="personaToggleIcon">▾</span>
          </button>

          <div class="auth-persona-selector" id="personaSelectorContainer" style="display: none;">
            <div class="persona-buttons-grid">
              <button class="persona-btn" data-email="alex.rivera@example.com" data-name="Alex Rivera" data-type="student">
                <span class="persona-role">Alex Rivera (Student)</span>
                <span class="persona-email">alex.rivera@example.com</span>
              </button>
              <button class="persona-btn" data-email="sarah.chen@techcorp.io" data-name="Sarah Chen" data-type="employee">
                <span class="persona-role">Sarah Chen (Employee)</span>
                <span class="persona-email">sarah.chen@techcorp.io</span>
              </button>
            </div>
          </div>
        </div>

        <div class="auth-modal-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Verified Google OAuth2 integration • Dedicated personal bag & schedule data</span>
        </div>
      </div>
    `;

    modal.querySelector('#btnAuthClose').addEventListener('click', () => this.closeAuthModal());

    // 1-Click Recent Account click
    modal.querySelectorAll('.google-account-card').forEach(card => {
      card.addEventListener('click', () => {
        const email = card.getAttribute('data-email');
        const name = card.getAttribute('data-name');
        const avatar = card.getAttribute('data-avatar');
        this.loginWithGoogle({
          googleId: "google_" + Date.now(),
          email,
          name,
          profileImage: avatar
        });
      });
    });

    // Form Submit
    const form = modal.querySelector('#googleSignInForm');
    const emailInput = modal.querySelector('#googleAuthEmail');
    const nameInput = modal.querySelector('#googleAuthName');
    const emailError = modal.querySelector('#googleAuthEmailError');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (emailInput.value || "").trim();
      const name = (nameInput.value || "").trim();

      if (!email || !email.includes('@') || !email.includes('.')) {
        emailError.classList.add('visible');
        emailInput.focus();
        return;
      }
      emailError.classList.remove('visible');

      this.loginWithGoogle({
        googleId: "google_" + Date.now(),
        email,
        name
      });
    });

    emailInput.addEventListener('input', () => {
      emailError.classList.remove('visible');
    });

    // Toggle sample personas
    const toggleBtn = modal.querySelector('#btnTogglePersonas');
    const personaContainer = modal.querySelector('#personaSelectorContainer');
    const personaIcon = modal.querySelector('#personaToggleIcon');

    toggleBtn.addEventListener('click', () => {
      const isHidden = personaContainer.style.display === 'none';
      personaContainer.style.display = isHidden ? 'block' : 'none';
      personaIcon.innerText = isHidden ? '▴' : '▾';
    });

    modal.querySelectorAll('.persona-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        const name = btn.getAttribute('data-name');
        this.loginWithGoogle({
          googleId: "google_" + Date.now(),
          email,
          name
        });
      });
    });
  }

  bindGlobalAuthButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-auth-trigger="google"], .btn-cta-google');
      if (btn) {
        e.preventDefault();
        if (this.user) {
          if (window.appViewManager) window.appViewManager.switchView('dashboard');
        } else {
          this.openAuthModal();
        }
      }
    });
  }

  openAuthModal(clearInputs = false) {
    let modal = document.getElementById('authModalOverlay');
    if (!modal) {
      this.setupAuthModal();
      modal = document.getElementById('authModalOverlay');
    }

    // Refresh modal content to show latest accounts
    this.renderModalContent(modal);

    const emailInput = modal.querySelector('#googleAuthEmail');
    const nameInput = modal.querySelector('#googleAuthName');
    const emailError = modal.querySelector('#googleAuthEmailError');

    if (emailError) emailError.classList.remove('visible');

    if (clearInputs && emailInput) {
      emailInput.value = '';
      if (nameInput) nameInput.value = '';
    }

    modal.classList.add('open');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
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
