import axios from 'axios';

// Klient frontendu kieruje do backendu FastAPI (konfigurowalnie przez VITE_BACKEND_URL)
export const BACKEND_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL)
  ? import.meta.env.VITE_BACKEND_URL
  : '/frontend-baserow/api';

const apiClient = axios.create({
  baseURL: `${BACKEND_BASE_URL}/token`,
});

export default apiClient;


