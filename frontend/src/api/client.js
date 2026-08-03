import axios from 'axios';

const API_BASE_URL = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Local request handler for transparent offline mode in Electron
const handleLocalRequest = async (config) => {
  const { url, method, data } = config;
  const electron = window.electronAPI;
  if (!electron) throw new Error("Electron API not available");

  // Parse payload data
  let payload = {};
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {}
  } else if (data) {
    payload = data;
  }

  // Scoped handling for customers
  if (url.includes('/customers')) {
    if (method === 'get') {
      const list = await electron.dbQuery('select', 'customers');
      return { data: list, meta: {}, errors: null };
    }
    if (method === 'post') {
      const inserted = await electron.dbQuery('insert', 'customers', payload);
      await electron.addToSyncQueue('customer', inserted.id, payload);
      return { data: inserted, meta: {}, errors: null };
    }
    if (method === 'put') {
      const idMatch = url.match(/\/customers\/(\d+)/);
      const id = idMatch ? parseInt(idMatch[1]) : payload.id;
      const updated = await electron.dbQuery('update', 'customers', { id, ...payload });
      await electron.addToSyncQueue('customer', id, payload);
      return { data: updated, meta: {}, errors: null };
    }
    if (method === 'delete') {
      const idMatch = url.match(/\/customers\/(\d+)/);
      const id = idMatch ? parseInt(idMatch[1]) : null;
      if (id) {
        await electron.dbQuery('delete', 'customers', { id });
        await electron.addToSyncQueue('customer', id, { is_deleted: true });
      }
      return { data: { success: true }, meta: {}, errors: null };
    }
  }

  // Scoped handling for products
  if (url.includes('/products')) {
    if (method === 'get') {
      const list = await electron.dbQuery('select', 'products');
      return { data: list, meta: {}, errors: null };
    }
    if (method === 'post') {
      const inserted = await electron.dbQuery('insert', 'products', payload);
      await electron.addToSyncQueue('product', inserted.id, payload);
      return { data: inserted, meta: {}, errors: null };
    }
  }

  // Scoped handling for invoices / bills
  if (url.includes('/invoices') || url.includes('/billing')) {
    if (method === 'get') {
      const list = await electron.dbQuery('select', 'invoices');
      return { data: list, meta: {}, errors: null };
    }
    if (method === 'post') {
      const inserted = await electron.dbQuery('insert', 'invoices', payload);
      await electron.addToSyncQueue('invoice', inserted.id, payload);
      return { data: inserted, meta: {}, errors: null };
    }
  }

  // Generic fallback if not handled locally
  return { data: null, meta: {}, errors: ["Operation offline, features restricted."] };
};

// Request interceptor - check if offline and intercept adapter
apiClient.interceptors.request.use(
  async (config) => {
    const isOffline = !navigator.onLine;
    if (isOffline && window.electronAPI) {
      config.adapter = async (cfg) => {
        try {
          const localResponse = await handleLocalRequest(cfg);
          return {
            data: localResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: cfg
          };
        } catch (err) {
          return Promise.reject(err);
        }
      };
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle backend unavailability by falling back to local DB
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry locally if network error (no response) in Electron
    if (!error.response && window.electronAPI && !originalRequest._isRetryLocal) {
      originalRequest._isRetryLocal = true;
      try {
        const localResponse = await handleLocalRequest(originalRequest);
        return {
          data: localResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: originalRequest
        };
      } catch (localErr) {
        console.error("Local fallback failed:", localErr);
      }
    }

    if ((error.response?.status === 401 || error.response?.status === 422) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });

          const newToken = response.data.data.access_token;
          localStorage.setItem('access_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;