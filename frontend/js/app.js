/**
 * Remembering Bag — Main Application Controller
 * Manages navigation, responsive mobile drawer, scroll reveals, and smooth interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Navbar scroll detection
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 2. Mobile Drawer
  const hamburger = document.getElementById('navHamburger');
  const drawer = document.getElementById('mobileNavDrawer');
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      drawer.classList.toggle('open');
    });

    drawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
      });
    });
  }

  // 3. Staggered Scroll Reveal Animations
  const revealElements = document.querySelectorAll('.fade-in-up');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // 4. Global Delegated Anchor Navigation (Supports both static and dynamic links)
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Logo / Back to Landing
    if (href === '#' || anchor.classList.contains('nav-logo')) {
      e.preventDefault();
      if (window.appViewManager) {
        window.appViewManager.switchView('landing');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Dashboard navigation
    if (href === '#dashboard') {
      e.preventDefault();
      if (window.authManager && window.authManager.user) {
        if (window.appViewManager) window.appViewManager.switchView('dashboard');
      } else {
        if (window.authManager) window.authManager.openAuthModal();
      }
      return;
    }

    // Settings navigation
    if (href === '#settings') {
      e.preventDefault();
      if (window.authManager && window.authManager.user) {
        if (window.appViewManager) window.appViewManager.switchView('settings');
      } else {
        if (window.authManager) window.authManager.openAuthModal();
      }
      return;
    }

    // Section targets on landing page (e.g. #how-it-works, #technology, #compartments, #features, #demo)
    if (href.startsWith('#how') || href.startsWith('#tech') || href.startsWith('#comp') || href.startsWith('#feat') || href.startsWith('#demo')) {
      e.preventDefault();
      
      // Close mobile drawer if open
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
      }

      if (window.appViewManager) {
        if (window.appViewManager.currentView !== 'landing') {
          window.appViewManager.switchView('landing', href);
        } else {
          window.appViewManager.scrollToTarget(href);
        }
      }
      return;
    }
  });
});
