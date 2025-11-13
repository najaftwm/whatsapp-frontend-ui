// Lightweight auth client that talks to PHP backend (backendphp/api/login.php)
// Stores auth state in localStorage (isAuthenticated) to match existing App.jsx expectations.

const AUTH_FLAG_KEY = 'isAuthenticated';
const USER_DATA_KEY = 'authUser';

// Adjust this if your backend runs at a different origin/path
const BASE_URL = 'https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api';

export const authClient = {
  isAuthenticated() {
    try {
      return localStorage.getItem(AUTH_FLAG_KEY) === 'true';
    } catch {
      return false;
    }
  },

  getUser() {
    try {
      const raw = localStorage.getItem(USER_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Fetch current user info from backend (to get user type from session)
  async getCurrentUser() {
    try {
      const resp = await fetch(`${BASE_URL}/getCurrentUser.php`, {
        method: 'GET',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json', 
          "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" 
        },
      });

      const data = await resp.json().catch(() => ({}));
      
      if (resp.ok && data?.ok === true && data?.user) {
        // Update stored user data
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
        return data.user;
      }
      
      // Fallback to stored user if API fails
      return this.getUser();
    } catch {
      // Fallback to stored user if API fails
      return this.getUser();
    }
  },

  async login(email, password) {
    const resp = await fetch(`${BASE_URL}/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" },
      credentials: 'include', // allow PHP session cookie
      body: JSON.stringify({ email, password })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || data?.ok !== true) {
      const message = data?.error || 'Login failed';
      throw new Error(message);
    }

    try {
      localStorage.setItem(AUTH_FLAG_KEY, 'true');
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
      // Fire storage event compatibility for same-tab state consumers if needed
      window.dispatchEvent(new StorageEvent('storage', { key: AUTH_FLAG_KEY, newValue: 'true' }));
    } catch {
      // ignore storage errors
    }

    return data.user;
  },

  logout() {
    try {
      localStorage.removeItem(AUTH_FLAG_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: AUTH_FLAG_KEY, newValue: 'false' }));
    } catch {
      // ignore
    }
  }
};


