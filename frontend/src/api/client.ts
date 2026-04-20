import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ss_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ss_token');
    }
    return Promise.reject(error);
  }
);
