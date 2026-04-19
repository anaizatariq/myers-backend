const AUTH_MODULE = (() => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api';
  const TOKEN_KEY = 'accessToken';
  const USER_KEY = 'userData';

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify({
        username: data.username,
        role: data.role,
        department: data.department,
        token_type: data.token_type,
      }));

      return {
        success: true,
        user: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    showLoginContainer();
  };

  const getToken = () => {
    return localStorage.getItem(TOKEN_KEY);
  };

  const getUser = () => {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  };

  const isAuthenticated = () => {
    return !!getToken();
  };

  return {
    login,
    logout,
    getToken,
    getUser,
    isAuthenticated,
  };
})();

// ============================================
// UI MANAGEMENT
// ============================================

const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const errorMessage = document.getElementById('errorMessage');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');

function showLoginContainer() {
  loginContainer.classList.remove('d-none');
  dashboardContainer.classList.add('d-none');
  loginForm.reset();
  loginError.classList.add('d-none');
  
  // ✅ FIX #1: Reset button to ORIGINAL STATE (not animated)
  const submitBtn = loginForm.querySelector('.btn-login');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
  }
}

function showDashboard() {
  loginContainer.classList.add('d-none');
  dashboardContainer.classList.remove('d-none');
  
  const user = AUTH_MODULE.getUser();
  if (user) {
    userName.textContent = `${user.username.charAt(0).toUpperCase() + user.username.slice(1)} - ${user.department}`;
  }

  if (window.EVENTS_MODULE) {
    EVENTS_MODULE.loadEvents();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showLoginError('Please enter username and password');
    return;
  }

  const submitBtn = loginForm.querySelector('.btn-login');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

  const result = await AUTH_MODULE.login(username, password);

  if (result.success) {
    loginError.classList.add('d-none');
    showDashboard();
  } else {
    showLoginError(result.error);
    // ✅ FIX #1: Reset button IMMEDIATELY on error
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

function showLoginError(message) {
  errorMessage.textContent = message;
  loginError.classList.remove('d-none');
  loginError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

logoutBtn.addEventListener('click', () => {
  const confirmLogout = confirm('Are you sure you want to logout?');
  if (confirmLogout) {
    AUTH_MODULE.logout();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (AUTH_MODULE.isAuthenticated()) {
    showDashboard();
  } else {
    showLoginContainer();
  }
});

// ============================================
// ✅ FIX #2: PASSWORD VISIBILITY TOGGLE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePassword');

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle input type
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      
      // Toggle icon
      const icon = togglePasswordBtn.querySelector('i');
      if (isPassword) {
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
        togglePasswordBtn.title = 'Hide Password';
      } else {
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
        togglePasswordBtn.title = 'Show Password';
      }
    });
  }
});

window.AUTH_MODULE = AUTH_MODULE;