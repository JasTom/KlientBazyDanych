import apiClient, { BACKEND_BASE_URL } from './apiClient';

// Tabele w Baserow
const USERS_TABLE_ID = 678912;        // tabela użytkowników (Email, Grupy - Użytkownicy)
const PERMISSIONS_TABLE_ID = 678914;  // tabela uprawnień (Grupy, Id tabeli, Uprawnienie)
const PAGE_SIZE = 200; // maks 200 wg ograniczeń API

// Fallback: jeśli brak zalogowanego użytkownika, użyj stałego maila (tymczasowo)
const DEFAULT_EMAIL = 'tjastrzebski@zdrochem.pl';

async function resolveEmail(providedEmail) {
  if (providedEmail && String(providedEmail).trim()) return providedEmail;
  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      credentials: 'include',
    });
    const data = await resp.json();
    if (data?.authenticated && data?.email) {
      return String(data.email).trim();
    }
  } catch (_) {
    // ignore
  }
  return DEFAULT_EMAIL;
}

async function fetchUserGroupsByEmail(email) {
  // Pobierz wiersz użytkownika po Email i wyciągnij kolumnę "Grupy - Użytkownicy" (link_row)
  const usp = new URLSearchParams();
  usp.append('user_field_names', 'true');
  usp.append('page', '1');
  usp.append('size', String(PAGE_SIZE));
  usp.append('filters', JSON.stringify({
    filter_type: 'AND',
    filters: [
      { type: 'equal', field: 'Email', value: email }
    ],
    groups: []
  }));

  const url = `/database/rows/table/${USERS_TABLE_ID}/?${usp.toString()}`;
  const resp = await apiClient.get(url);
  const results = Array.isArray(resp?.data?.results) ? resp.data.results : [];
  if (results.length === 0) return [];

  const userRow = results[0];
  const groups = Array.isArray(userRow?.['Grupy - Użytkownicy']) ? userRow['Grupy - Użytkownicy'] : [];
  // Zwróć wartości pierwotnego pola grupy (value) lub id jeśli brak value
  return groups
    .map(g => (g && (g.value || g.id)))
    .filter(Boolean)
    .map(String);
}

// Zwraca mapę: { [tableId: number]: Set<string /* 'Podgląd' | 'Edycja' | 'Dodawanie' | 'Usuwanie' */> }
export async function fetchUserPermissionsByTable(email) {
  const permissionsByTable = new Map();
  const effectiveEmail = await resolveEmail(email);
  const groups = await fetchUserGroupsByEmail(effectiveEmail);

  if (!groups || groups.length === 0) {
    return permissionsByTable; // brak grup => brak uprawnień
  }

  // Dla każdej grupy pobierz wpisy uprawnień (filtr po kolumnie "Grupy")
  for (const groupValue of groups) {
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const usp = new URLSearchParams();
      usp.append('user_field_names', 'true');
      usp.append('page', String(page));
      usp.append('size', String(PAGE_SIZE));
      usp.append('filters', JSON.stringify({
        filter_type: 'AND',
        filters: [
          { type: 'link_row_contains', field: 'Grupy', value: groupValue }
        ],
        groups: []
      }));

      const url = `/database/rows/table/${PERMISSIONS_TABLE_ID}/?${usp.toString()}`;
      const resp = await apiClient.get(url);
      const data = resp.data;
      const results = Array.isArray(data?.results) ? data.results : [];

      for (const item of results) {
        // Kolumna "Id tabeli" to link_row do tabel Baserow
        const tableIds = Array.isArray(item?.['Id tabeli']) ? item['Id tabeli'] : [];
        const permissionObj = item?.['Uprawnienie'] || null; // single_select
        const permission = (permissionObj?.value || '').trim();
        if (!permission) continue;

        for (const t of tableIds) {
          const tableId = Number.isFinite(Number(t?.value)) ? Number(t.value) : Number(t?.id);
          if (!Number.isFinite(tableId)) continue;

          if (!permissionsByTable.has(tableId)) {
            permissionsByTable.set(tableId, new Set());
          }
          permissionsByTable.get(tableId).add(permission);
        }
      }

      const nextUrl = data?.next;
      if (nextUrl) {
        page += 1;
      } else {
        hasNext = false;
      }
    }
  }

  return permissionsByTable; // Map<number, Set<string>>
}

// Pomocniczo: sprawdź czy zestaw uprawnień daje co najmniej Podgląd
export function hasAnyViewPermission(permsSet) {
  if (!permsSet) return false;
  // Każde z poniższych implikuje możliwość wyświetlania listy tabel
  return (
    permsSet.has('Podgląd') ||
    permsSet.has('Edycja') ||
    permsSet.has('Dodawanie') ||
    permsSet.has('Usuwanie')
  );
}


