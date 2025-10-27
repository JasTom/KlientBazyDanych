import axios from 'axios';

// Klient frontendu kieruje do backendu FastAPI (konfigurowalnie przez VITE_BACKEND_URL)
// WYMUSZAMY ścieżkę względną (bez hosta), aby działać za reverse proxy jak SOP.
function resolveBackendBasePath() {
  const envVal = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_BACKEND_URL : undefined;

  // Domyślnie ścieżka względna pod mountem
  const defaultPath = '/frontend-baserow/api';

  if (!envVal) return defaultPath;

  try {
    // Jeśli podano ścieżkę względną, użyj jej wprost
    if (envVal.startsWith('/')) return envVal;

    // Jeśli to pełny URL, wyciągnij samą część ścieżki (pathname)
    const url = new URL(envVal);
    return url.pathname || defaultPath;
  } catch (_e) {
    // W przypadku niepoprawnej wartości wracamy do bezpiecznego domyślnego
    return defaultPath;
  }
}

export const BACKEND_BASE_URL = resolveBackendBasePath();

const apiClient = axios.create({
  baseURL: `${BACKEND_BASE_URL}/token`,
});

export default apiClient;


