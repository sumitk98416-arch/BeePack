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
    const hash = window.location.hash.toLowerCase();
    if (hash === '#dashboard' && window.authManager && window.authManager.user) {
      this.switchView('dashboard');
    } else if (hash === '#settings' && window.authManager && window.authManager.user) {
      this.switchView('settings');
    } else if (hash === '#onboarding' && window.authManager && window.authManager.user) {
      if (window.onboardingManager) window.onboardingManager.open();
    } else if (!hash || hash === '#' || hash.startsWith('#how') || hash.startsWith('#tech') || hash.startsWith('#demo') || hash.startsWith('#comp') || hash.startsWith('#feat')) {
      if (this.currentView !== 'landing') {
        this.switchView('landing');
      }
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle DOM views
    if (this.landingView) this.landingView.style.display = viewName === 'landing' ? 'block' : 'none';
    if (this.dashboardView) this.dashboardView.style.display = viewName === 'dashboard' ? 'block' : 'none';
    if (this.settingsView) this.settingsView.style.display = viewName === 'settings' ? 'block' : 'none';

    // Update navbar active link styling
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'dashboard') {
      window.location.hash = 'dashboard';
      if (window.dashboardManager) window.dashboardManager.loadDashboardData();
    } else if (viewName === 'settings') {
      window.location.hash = 'settings';
      if (window.settingsManager) window.settingsManager.loadSettingsData();
    } else if (viewName === 'landing') {
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
