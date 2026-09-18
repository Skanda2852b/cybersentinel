import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const requestId = crypto.randomUUID();
    config.headers['X-Request-ID'] = requestId;
    return config;
  },
  (error) => Promise.reject(error)
);

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/me'];
const PUBLIC_PATHS = ['/login', '/register'];

function isAuthRequest(url?: string): boolean {
  return !!url && AUTH_PATHS.some((path) => url.includes(path));
}

function isOnPublicPage(): boolean {
  return PUBLIC_PATHS.some((path) => window.location.pathname.startsWith(path));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch {
        // Session is gone. Redirect once — never from a public page,
        // otherwise the app reloads into the same 401 forever.
        if (!isOnPublicPage()) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;