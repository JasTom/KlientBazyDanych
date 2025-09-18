import apiClient from './apiClient';

// Tabela uprawnień w Baserow
const PERMISSIONS_TABLE_ID = 678914;
const PAGE_SIZE = 200; // maks 200 wg ograniczeń API

// Do czasu wdrożenia logowania, używamy stałego emaila
const DEFAULT_EMAIL = 'tjastrzebski@zdrochem.pl';

// Zwraca mapę: { [tableId: number]: Set<string /* 'Podgląd' | 'Edycja' | 'Dodawanie' | 'Usuwanie' */> }
export async function fetchUserPermissionsByTable(email = DEFAULT_EMAIL) {
  const permissionsByTable = new Map();

  // Zbuduj filtr: link_row_contains na polu "Użytkownicy" z wartością email
  const filtersPayload = {
    filter_type: 'AND',
    filters: [
      { type: 'link_row_contains', field: 'Użytkownicy', value: email }
    ],
    groups: []
  };

  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const usp = new URLSearchParams();
    usp.append('user_field_names', 'true');
    usp.append('page', String(page));
    usp.append('size', String(PAGE_SIZE));
    usp.append('filters', JSON.stringify(filtersPayload));

    const url = `/database/rows/table/${PERMISSIONS_TABLE_ID}/?${usp.toString()}`;

    const resp = await apiClient.get(url);
    const data = resp.data;
    const results = Array.isArray(data?.results) ? data.results : [];

    for (const item of results) {
      // "Id tabeli" jest link_row (tablica). Wartość numeru tabeli może być w item.value
      const tableIds = Array.isArray(item?.['Id tabeli']) ? item['Id tabeli'] : [];
      const permissionObj = item?.['Uprawnienie'] || null; // single_select
      const permission = (permissionObj?.value || '').trim();

      if (!permission) continue;

      for (const t of tableIds) {
        // Preferuj pole value (powinno zawierać ID tabeli), w przeciwnym razie użyj id
        const tableId = Number.isFinite(Number(t?.value)) ? Number(t.value) : Number(t?.id);
        if (!Number.isFinite(tableId)) continue;

        if (!permissionsByTable.has(tableId)) {
          permissionsByTable.set(tableId, new Set());
        }
        permissionsByTable.get(tableId).add(permission);
      }
    }

    // Paginacja
    const nextUrl = data?.next;
    if (nextUrl) {
      page += 1;
    } else {
      hasNext = false;
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


