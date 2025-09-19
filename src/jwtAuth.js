import axios from 'axios';

const AUTH_URL = 'https://api.baserow.io/api/user/token-auth/';

// Tymczasowe dane logowania (do podmiany w przyszłości)
const CREDENTIALS = {
  email: 'tomaszjastrzebski1996@gmail.com',
  username: 'tomaszjastrzebski1996@gmail.com',
  password: 'Q9JpX!AsSve2ifT',
};

const STORAGE_KEY = 'baserow_jwt_token';

export function getStoredJWT() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch (_) {
    return '';
  }
}

export async function loginAndStoreJWT() {
  try {
    const response = await axios.post(
      AUTH_URL,
      CREDENTIALS,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Różne backendy zwracają różne klucze
    const token = response?.data?.token || response?.data?.access || response?.data?.jwt || '';
    if (!token) {
      console.warn('Nie otrzymano tokenu JWT z odpowiedzi.', response?.data);
      return '';
    }

    try { localStorage.setItem(STORAGE_KEY, token); } catch (_) { /* ignore */ }
    console.log('Baserow JWT:', token);
    return token;
  } catch (error) {
    const msg = error?.response?.data ? JSON.stringify(error.response.data) : error?.message;
    console.error('Błąd logowania po JWT:', msg);
    return '';
  }
}


