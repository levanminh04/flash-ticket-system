// File: src/lib/axiosClient.ts
import axios from 'axios';
import keycloak from './keycloak';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động đính kèm Bearer Token vào mọi Request
axiosClient.interceptors.request.use(
  async (config) => {
    // Nếu token sắp hết hạn, tự động refresh
    if (keycloak.isTokenExpired(30)) {
      await keycloak.updateToken(30);
    }
    if (keycloak.token) {
      config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosClient;