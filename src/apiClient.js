import axios from 'axios';

// Wspólny klient API z ustawionym nagłówkiem Authorization
const BASEROW_BASE_URL = 'https://api.baserow.io/api';
const AUTH_TOKEN = 'Token Ldhe8HXyypxOR4zoGMrvTKj0EZ3dr7iC';

const apiClient = axios.create({
  baseURL: BASEROW_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const updatedConfig = { ...config };
  updatedConfig.headers = updatedConfig.headers || {};
  updatedConfig.headers.Authorization = AUTH_TOKEN;
  return updatedConfig;
});

export default apiClient;


