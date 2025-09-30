import axios from 'axios';

// Klient frontendu kieruje do lokalnego backendu FastAPI
const BACKEND_BASE_URL = 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: `${BACKEND_BASE_URL}/token`,
});

export default apiClient;


