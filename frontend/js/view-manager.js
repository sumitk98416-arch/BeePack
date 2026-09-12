/**
 * Remembering Bag v2 — Multi-View Single Page App Coordinator
 * Seamlessly manages transitions between Landing Page, Dashboard, and Settings views.
 */

class AppViewManager {
  constructor() {
    this.currentView = 'landing';
    this.landingView = document.getElementById('landingPageView');
    this.dashboardView = document.getElementById('userDashboardView');
    this.settingsView = document.getElementById('userSettingsView');
  }

  init() {
    this.landingView = document.getElementById('landingPageView');
    this.dashboardView = document.getElementById('userDashboardView');
    this.settingsView = document.getElementById('userSettingsView');

    // Handle hash-based navigation if present
    window.addEventListener('hashchange', () => this.handleHashRoute());
    this.handleHashRoute();
  }

  handleHashRoute() {
    const hash = (window.location.hash || '').toLowerCase();
    
    if (hash === '#dashboard') {
      if (window.authManager && window.authManager.user) {
        this.switchView('dashboard');
      } else {
        this.switchView('landing');
        if (window.authManager) window.authManager.openAuthModal();
      }
    } else if (hash === '#settings') {
      if (window.authManager && window.authManager.user) {
        this.switchView('settings');
      } else {
        this.switchView('landing');
        if (window.authManager) window.authManager.openAuthModal();
      }
    } else if (hash === '#onboarding' && window.authManager && window.authManager.user) {
      if (window.onboardingManager) window.onboardingManager.open();
    } else if (hash.startsWith('#how') || hash.startsWith('#tech') || hash.startsWith('#comp') || hash.startsWith('#feat') || hash.startsWith('#demo')) {
      if (this.currentView !== 'landing') {
        this.switchView('landing', hash);
      } else {
        this.scrollToTarget(hash);
      }
    } else if (!hash || hash === '#') {
      if (this.currentView !== 'landing') {
        this.switchView('landing');
      }
    }
  }

  scrollToTarget(targetSelector) {
    if (!targetSelector || targetSelector === '#') return;

    // Unzip the gateway if it's closed so section is fully interactive
    if (window.zipperGatewayManager && !window.zipperGatewayManager.isUnzipped) {
      window.zipperGatewayManager.unzip(true);
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const targetEl = document.querySelector(targetSelector);
          if (targetEl) {
            const offset = 80;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = targetEl.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            window.scrollTo({
              top: Math.max(0, elementPosition - offset),
              behavior: 'smooth'
            });
          }
        } catch (err) {
          console.warn('Scroll target error:', err);
        }
      }, 50);
    });
  }

  switchView(viewName, targetSelector = null) {
    this.currentView = viewName;

    // Toggle DOM views
    if (this.landingView) this.landingView.style.display = viewName === 'landing' ? 'block' : 'none';
    if (this.dashboardView) this.dashboardView.style.display = viewName === 'dashboard' ? 'block' : 'none';
    if (this.settingsView) this.settingsView.style.display = viewName === 'settings' ? 'block' : 'none';

    // Update navbar active link styling
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    if (viewName === 'dashboard') {
      window.location.hash = 'dashboard';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const navDash = document.querySelector('.nav-links a[href="#dashboard"]');
      if (navDash) navDash.classList.add('active');
      if (window.dashboardManager) window.dashboardManager.loadDashboardData();
    } else if (viewName === 'settings') {
      window.location.hash = 'settings';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.settingsManager) window.settingsManager.loadSettingsData();
    } else if (viewName === 'landing') {
      // Ensure entrance zipper gateway is open so content isn't obstructed
      if (window.zipperGatewayManager && !window.zipperGatewayManager.isUnzipped) {
        window.zipperGatewayManager.unzip(true);
      }

      if (targetSelector && targetSelector !== '#') {
        this.scrollToTarget(targetSelector);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (window.location.hash === '#dashboard' || window.location.hash === '#settings') {
        history.pushState(null, null, ' ');
      }
    }
  }
}

window.appViewManager = new AppViewManager();
document.addEventListener('DOMContentLoaded', () => {
  window.appViewManager.init();
});
