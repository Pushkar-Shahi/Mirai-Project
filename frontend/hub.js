import {portalForRole} from './shared/config/portals.js';
import {api, API} from './shared/core/api.js';
import {theme, setTheme} from './shared/core/theme.js';

// Auto-clean stale or remote Render API on local dev servers
if (typeof window !== 'undefined') {
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname) || location.port === '5500';
  if (isLocal && localStorage.getItem('api')?.includes('onrender.com')) {
    localStorage.removeItem('api');
  }
}

function init() {
  const form = document.getElementById('login-form');
  const idInput = document.getElementById('identifier');
  const pwInput = document.getElementById('password');
  const pwToggleBtn = document.getElementById('pw-toggle-btn');
  const statusMsg = document.getElementById('status-msg');
  const submitBtn = document.getElementById('submit-btn');
  const themeBtn = document.getElementById('theme-toggle');
  const apiInput = document.getElementById('api-input');

  // Password visibility toggle
  if (pwToggleBtn && pwInput) {
    pwToggleBtn.onclick = (e) => {
      e.preventDefault();
      const isPass = pwInput.type === 'password';
      pwInput.type = isPass ? 'text' : 'password';
      pwToggleBtn.textContent = isPass ? 'Hide' : 'Show';
    };
  }

  // Theme toggle
  if (themeBtn) {
    const updateThemeIcon = () => {
      const isDark = theme() === 'dark';
      themeBtn.textContent = isDark ? '☀' : '☾';
      themeBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      themeBtn.setAttribute('aria-label', themeBtn.title);
      themeBtn.setAttribute('aria-pressed', String(isDark));
    };
    updateThemeIcon();
    themeBtn.onclick = (e) => {
      e.preventDefault();
      setTheme(theme() === 'dark' ? 'light' : 'dark');
      updateThemeIcon();
    };
  }

  // API address setting
  if (apiInput) {
    apiInput.value = API();
    apiInput.onchange = (e) => {
      try {
        const val = e.target.value.trim();
        if (val) localStorage.setItem('api', val);
        else localStorage.removeItem('api');
        location.reload();
      } catch {}
    };
  }

  // Demo buttons
  const demoButtons = document.querySelectorAll('.demo-buttons-grid button');
  demoButtons.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const email = btn.getAttribute('data-email');
      if (email && idInput && pwInput) {
        idInput.value = email;
        pwInput.value = 'password123';
        if (statusMsg) {
          statusMsg.style.display = 'none';
          statusMsg.className = 'login-status-msg';
        }
        if (submitBtn) {
          submitBtn.focus();
        }
      }
    };
  });

  // Direct login execution
  async function executeLogin(identifier, password) {
    if (!identifier || !password) {
      if (statusMsg) {
        statusMsg.className = 'login-status-msg error';
        statusMsg.textContent = 'Please enter both identifier and password.';
        statusMsg.style.display = 'block';
      }
      return;
    }

    if (statusMsg) {
      statusMsg.className = 'login-status-msg';
      statusMsg.style.display = 'none';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Opening dashboard...';
    }

    try {
      const r = await api('POST', '/auth/login', {
        identifier: identifier.trim(),
        password: password
      });

      const home = portalForRole(r.user.role);
      if (!home) {
        throw new Error(`Role "${r.user.role}" does not have an assigned portal.`);
      }

      // Store token in sessionStorage for this portal
      try {
        sessionStorage.setItem(`mirai:${home.id}:token`, r.access_token);
      } catch {}

      if (statusMsg) {
        statusMsg.className = 'login-status-msg success';
        statusMsg.textContent = `Welcome, ${r.user.name || r.user.role}! Opening your dashboard...`;
        statusMsg.style.display = 'block';
      }

      // Directly open role dashboard carrying the handoff token
      const dest = new URL(`apps/${home.id}/`, location.href);
      dest.hash = 'handoff=' + encodeURIComponent(r.access_token);
      location.replace(dest.href);
    } catch (err) {
      if (statusMsg) {
        statusMsg.className = 'login-status-msg error';
        statusMsg.textContent = err.message || 'Login failed. Please check credentials.';
        statusMsg.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue to workspace';
      }
    }
  }

  // Form submit
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      executeLogin(idInput.value.trim(), pwInput.value);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
