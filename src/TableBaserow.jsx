import React, { useState, useEffect } from 'react';
import apiClient from './apiClient';
import RowForm from './RowForm';
import { fetchUserPermissionsByTable, hasAnyViewPermission } from './permissionsApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TableBaserow = ({ tableId, tableName }) => {
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(100);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [orderBy, setOrderBy] = useState('');
    const [orderField, setOrderField] = useState('');
    const [orderDir, setOrderDir] = useState('asc'); // 'asc' | 'desc'
    const [filterType, setFilterType] = useState('AND');
    const [filtersJson, setFiltersJson] = useState('');
    const [filterField, setFilterField] = useState('');
    const [filterOp, setFilterOp] = useState('');
    const [filterValue, setFilterValue] = useState('');
    const [filtersList, setFiltersList] = useState([]); // {field, type, value}
    const [controlsOpen, setControlsOpen] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [columnWidths, setColumnWidths] = useState({}); // { [columnName]: number }
    const [isResizing, setIsResizing] = useState(false);
    const [resizingCol, setResizingCol] = useState(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [scrollContentWidth, setScrollContentWidth] = useState(0);
    const tableScrollRef = React.useRef(null);
    const topScrollRef = React.useRef(null);
    const headerScrollRef = React.useRef(null);
    const headerTableRef = React.useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [permLoading, setPermLoading] = useState(true);
    const [canView, setCanView] = useState(true);
    const [canCreate, setCanCreate] = useState(true);
    const [canUpdate, setCanUpdate] = useState(true);
    const [canDelete, setCanDelete] = useState(true);

    // Domyślna miniatura (SVG) gdy brak miniaturek w odpowiedzi API
    const defaultThumb = 'data:image/svg+xml;utf8,\
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">\
  <rect width="32" height="32" fill="%23e9ecef"/>\
  <path d="M6 22l5-6 3 4 4-5 8 10H6z" fill="%23adb5bd"/>\
  <circle cx="11" cy="11" r="3" fill="%239aa0a6"/>\
</svg>';

    const asArray = (value) => Array.isArray(value) ? value : [value];

    const isComplexValue = (value) => value !== null && typeof value === 'object';

    const formatCellValue = (rawValue) => {
        if (rawValue === null || rawValue === undefined) return "";
        if (Array.isArray(rawValue)) {
            return rawValue.map(item => {
                if (item && typeof item === 'object') {
                    if (Object.prototype.hasOwnProperty.call(item, 'value')) return String(item.value);
                    if (Object.prototype.hasOwnProperty.call(item, 'name')) return String(item.name);
                    return String(item.id ?? '');
                }
                return String(item);
            }).join(', ');
        }
        if (typeof rawValue === 'object') {
            if (Object.prototype.hasOwnProperty.call(rawValue, 'value')) return String(rawValue.value);
            if (Object.prototype.hasOwnProperty.call(rawValue, 'name')) return String(rawValue.name);
            return JSON.stringify(rawValue);
        }
        return String(rawValue);
    };

    const getTypeIcon = (column) => {
        const type = String(column.type || '').toLowerCase();
        if (type.includes('boolean')) return '✓';
        if (type.includes('date')) return '🗓️';
        if (type.includes('email')) return '✉️';
        if (type.includes('url')) return '🔗';
        if (type.includes('phone')) return '📞';
        if (type.includes('file')) return '🖼️';
        if (type.includes('single_select')) return '🔘';
        if (type.includes('multiple_select')) return '🔳';
        if (type.includes('number')) return '#';
        if (type.includes('text') || type.includes('long_text')) return '📝';
        if (type.includes('link_row')) return '↔️';
        if (type.includes('lookup') || type.includes('search')) return '🔍';
        if (type.includes('collaborator') || type.includes('created_by') || type.includes('last_modified_by')) return '👤';
        return '▫️';
    };

    const getOpsForType = (columnType) => {
        const t = String(columnType || '').toLowerCase();
        const common = ['equal','not_equal','contains','contains_not','contains_word','doesnt_contain_word','empty','not_empty'];
        if (t.includes('boolean')) return ['boolean'];
        if (t.includes('date')) return ['date_is','date_is_not','date_is_before','date_is_on_or_before','date_is_after','date_is_on_or_after','date_is_within','date_equals_day_of_month','empty','not_empty'];
        if (t.includes('number')) return ['equal','not_equal','higher_than','higher_than_or_equal','lower_than','lower_than_or_equal','is_even_and_whole','empty','not_empty'];
        if (t.includes('single_select')) return ['single_select_equal','single_select_not_equal','single_select_is_any_of','single_select_is_none_of','empty','not_empty'];
        if (t.includes('multiple_select')) return ['multiple_select_has','empty','not_empty'];
        if (t.includes('link_row')) return ['link_row_has','link_row_has_not','link_row_contains','link_row_not_contains','empty','not_empty'];
        if (t.includes('collaborator')) return ['user_is','user_is_not','multiple_collaborators_has','multiple_collaborators_has_not','empty','not_empty'];
        if (t.includes('file')) return ['filename_contains','has_file_type','files_lower_than','empty','not_empty'];
        return common;
    };

    const rebuildFiltersJson = (list, typeLogic) => {
        if (!list.length) { setFiltersJson(''); return; }
        try {
            const payload = {
                filter_type: typeLogic || 'AND',
                filters: list.map(f => ({ type: f.type, field: f.field, value: f.value })),
                groups: []
            };
            setFiltersJson(JSON.stringify(payload));
        } catch (_) {
            setFiltersJson('');
        }
    };

    // Ustaw domyślne szerokości, aby mieściły nazwę kolumny (tylko dla jeszcze nieustawionych)
    useEffect(() => {
        if (!columns || columns.length === 0) return;
        setColumnWidths(prev => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // Przybliżona czcionka nagłówka bootstrapa
            ctx.font = '600 0.875rem system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
            const next = { ...prev };
            columns.forEach(col => {
                const name = String(col.name || '');
                if (name && next[name] == null) {
                    const metrics = ctx.measureText(name);
                    const textWidth = metrics.width;
                    const padding = 24; // lewy/prawy padding komórki
                    const iconSpace = 18; // ikonka typu + odstęp
                    const target = Math.max(60, Math.ceil(textWidth + padding + iconSpace));
                    next[name] = target;
                }
            });
            return next;
        });
    }, [columns]);

    // Obsługa zmiany szerokości kolumn
    const handleResizeMouseDown = (colName, e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentWidth = columnWidths[colName] ?? e.currentTarget.parentElement.getBoundingClientRect().width;
        setIsResizing(true);
        setResizingCol(colName);
        setResizeStartX(e.clientX);
        setResizeStartWidth(currentWidth);
    };

    // Persist/restore szerokości kolumn per tabela
    useEffect(() => {
        const key = `tbw_${tableId}`;
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') setColumnWidths(parsed);
            }
        } catch (_) { /* ignore */ }
    }, [tableId]);

    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e) => {
            const delta = e.clientX - resizeStartX;
            const newWidth = Math.max(60, Math.round(resizeStartWidth + delta));
            setColumnWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
        };
        const onUp = () => {
            setIsResizing(false);
            setResizingCol(null);
            try {
                const key = `tbw_${tableId}`;
                localStorage.setItem(key, JSON.stringify(columnWidths));
            } catch (_) { /* ignore */ }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isResizing, resizeStartX, resizeStartWidth, resizingCol, columnWidths, tableId]);

    // Synchronizacja szerokości paska przewijania i scrollLeft pomiędzy górnym paskiem a kontenerem tabeli
    useEffect(() => {
        const updateWidth = () => {
            const el = tableScrollRef.current;
            if (el) setScrollContentWidth(el.scrollWidth);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [rows, columns, columnWidths]);

    const syncFromTop = (e) => {
        const topEl = e.currentTarget;
        const tbl = tableScrollRef.current;
        if (tbl && tbl.scrollLeft !== topEl.scrollLeft) tbl.scrollLeft = topEl.scrollLeft;
        const hdrTbl = headerTableRef.current;
        if (hdrTbl) {
            hdrTbl.style.transform = `translateX(-${topEl.scrollLeft}px)`;
        }
    };
    const syncFromTable = (e) => {
        const tbl = e.currentTarget;
        const topEl = topScrollRef.current;
        if (topEl && topEl.scrollLeft !== tbl.scrollLeft) topEl.scrollLeft = tbl.scrollLeft;
        const hdrTbl = headerTableRef.current;
        if (hdrTbl) {
            hdrTbl.style.transform = `translateX(-${tbl.scrollLeft}px)`;
        }
    };

    const formatCellDisplay = (column, raw) => {
        const type = String(column.type || '').toLowerCase();
        if (raw === null || raw === undefined) return <span />;

        // URL
        if (type.includes('url')) {
            const url = String(raw);
            return <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
        }
        // Email
        if (type.includes('email')) {
            const email = String(raw);
            return <a href={`mailto:${email}`}>{email}</a>;
        }
        // Telefon
        if (type.includes('phone')) {
            const phone = String(raw);
            return <a href={`tel:${phone}`}>{phone}</a>;
        }
        // Boolean
        if (typeof raw === 'boolean' || type.includes('boolean')) {
            const val = typeof raw === 'boolean' ? raw : String(raw).toLowerCase() === 'true';
            return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${val ? 'bg-green-600 text-white' : 'bg-gray-500 text-white'}`}>{val ? 'Tak' : 'Nie'}</span>;
        }
        // Daty/czasy
        if (type.includes('date') || type.includes('created') || type.includes('modified')) {
            try {
                const date = new Date(String(raw));
                if (!isNaN(date.getTime())) {
                    const includeTime = column.date_include_time;
                    const dateFormat = column.date_format || 'ISO';
                    
                    if (includeTime) {
                        // Z czasem - formatuj zgodnie z date_time_format
                        const timeFormat = column.date_time_format === '12' ? 'en-US' : 'pl-PL';
                        return <span>{date.toLocaleString(timeFormat)}</span>;
                    } else {
                        // Tylko data - formatuj zgodnie z date_format
                        if (dateFormat === 'US') {
                            return <span>{date.toLocaleDateString('en-US')}</span>;
                        } else if (dateFormat === 'EU') {
                            return <span>{date.toLocaleDateString('pl-PL')}</span>;
                        } else {
                            // ISO lub domyślny
                            return <span>{date.toLocaleDateString('pl-PL')}</span>;
                        }
                    }
                }
            } catch (_) { /* ignore */ }
        }
        // Single select
        if (type.includes('single_select')) {
            const label = formatCellValue(raw);
            return <span className="inline-flex items-center rounded bg-cyan-600 px-2 py-0.5 text-xs text-white">{label}</span>;
        }
        // Multiple select
        if (type.includes('multiple_select')) {
            return (
                <span>
                    {asArray(raw).map((opt, idx) => (
                        <span key={idx} className="mr-1 inline-flex items-center rounded bg-cyan-600 px-2 py-0.5 text-xs text-white">{formatCellValue(opt)}</span>
                    ))}
                </span>
            );
        }
        // Link do tabeli / Lookup / Wyszukiwania
        if (type.includes('link_row') || type.includes('lookup') || type.includes('search')) {
            return <span>{formatCellValue(raw)}</span>;
        }
        // Współpracownicy
        if (type.includes('collaborator')) {
            return <span>{asArray(raw).map(user => user?.name || user?.value || user?.id).join(', ')}</span>;
        }
        // Pliki
        if (type.includes('file')) {
            const files = asArray(raw);
            return (
                <div className="flex flex-wrap gap-2">
                    {files.map((f, idx) => {
                        const thumb = f?.thumbnails?.small?.url || f?.thumbnails?.tiny?.url || null;
                        const src = thumb || defaultThumb;
                        return (
                            <a key={idx} href={f?.url} target="_blank" rel="noopener noreferrer" title={f?.name || ''}>
                                <img
                                    src={src}
                                    alt={f?.name || 'file'}
                                    width={32}
                                    height={32}
                                    style={{ objectFit: 'cover', borderRadius: 4 }}
                                    onError={(e) => { e.currentTarget.src = defaultThumb; }}
                                />
                            </a>
                        );
                    })}
                </div>
            );
        }
        // Pozostałe typy
        return <span>{formatCellValue(raw)}</span>;
    };

    // Pobierz kolumny
    useEffect(() => {
        const fetchColumns = async () => {
            try {
                const response = await apiClient.get(`/database/fields/table/${tableId}/`, {
                    headers: { 'X-Baserow-Token-Index': localStorage.getItem(`tok_${tableId}`) ?? '' }
                });
                setColumns(response.data);
            } catch (err) {
                setError(err.message);
            }
        };

        // Pobierz dane
        const fetchRows = async () => {
            try {
                const clampedSize = Math.min(200, Math.max(1, Number(size) || 100));
                const params = {
                    user_field_names: true,
                    page,
                    size: clampedSize,
                };
                if (debouncedSearch) params.search = debouncedSearch;
                const builtOrder = orderField ? `${orderDir === 'desc' ? '-' : ''}${orderField}` : '';
                if (builtOrder) params.order_by = builtOrder;
                // Zbuduj URL z poprawnym enkodowaniem filtra
                const usp = new URLSearchParams();
                Object.entries(params).forEach(([k, v]) => {
                    if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
                });
                let url = `/database/rows/table/${tableId}/?${usp.toString()}`;
                if (filtersJson) {
                    url += `&filters=${encodeURIComponent(filtersJson)}`;
                }

                const response = await apiClient.get(url, {
                    headers: { 'X-Baserow-Token-Index': localStorage.getItem(`tok_${tableId}`) ?? '' }
                });
                setRows(response.data.results);
                setCount(response.data.count ?? 0);
            } catch (err) {
                const apiMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
                setError(apiMsg);
            } finally {
                setLoading(false);
            }
        };

        fetchColumns();
        fetchRows();
    }, [tableId, page, size, debouncedSearch, orderField, orderDir, filterType, filtersJson]);

    // Debounce dla pola "Szukaj"
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    // Uprawnienia dla bieżącej tabeli
    useEffect(() => {
        let mounted = true;
        const loadPerms = async () => {
            try {
                setPermLoading(true);
                const map = await fetchUserPermissionsByTable();
                const tidNum = Number(tableId);
                const set = map.get(tidNum);

                const view = hasAnyViewPermission(set);
                const create = Boolean(set?.has('Dodawanie'));
                const update = Boolean(set?.has('Edycja'));
                const del = Boolean(set?.has('Usuwanie'));

                if (!mounted) return;
                setCanView(view);
                setCanCreate(create);
                setCanUpdate(update);
                setCanDelete(del);
            } catch (_) {
                if (!mounted) return;
                setCanView(false);
                setCanCreate(false);
                setCanUpdate(false);
                setCanDelete(false);
            } finally {
                if (mounted) setPermLoading(false);
            }
        };
        loadPerms();
        return () => { mounted = false; };
    }, [tableId]);

    // Zamknij formularz (modal) po naciśnięciu Escape
    useEffect(() => {
        if (!showForm) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                closeForm();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showForm]);

    if (loading || permLoading) return <div>Ładowanie...</div>;
    if (error) return <div>Błąd: {error}</div>;
    if (!canView) return <div className="m-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800">Brak uprawnień do podglądu tej tabeli.</div>;
    // Funkcje formularza
    const openAddForm = () => {
        setEditingRow(null);
        setShowForm(true);
    };

    const openEditForm = (row) => {
        setEditingRow(row);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingRow(null);
    };

    const handleFormSuccess = (action, data) => {
        if (action === 'created') {
            setRows(prevRows => [data, ...prevRows]);
            setCount(prev => prev + 1);
        } else if (action === 'updated') {
            setRows(prevRows => prevRows.map(row => row.id === data.id ? data : row));
        }
    };

    const deleteRow = async (rowId) => {
        if (!window.confirm('Czy na pewno chcesz usunąć ten wiersz?')) return;
        try {
            await apiClient.delete(`/database/rows/table/${tableId}/${rowId}/`, {
                headers: { 'X-Baserow-Token-Index': localStorage.getItem(`tok_${tableId}`) ?? '' }
            });
            setRows(prevRows => prevRows.filter(row => row.id !== rowId));
            setCount(prev => prev - 1);
        } catch (err) {
            const apiMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
            setError(apiMsg);
        }
    };

    const hasSortOrFilter = Boolean(orderField) || filtersList.length > 0 || Boolean(search.trim());
    return (
        <div className="my-4 mx-auto max-w-[95vw] px-4">
            <div className="mb-3 flex items-center justify-between">
                <h1 className="m-0 text-xl font-semibold">{tableName}</h1>
                <div className="flex max-w-[60%] items-center gap-2">
                    <Input
                        className="min-w-[180px]"
                        value={search}
                        onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                        placeholder="Szukaj..."
                    />
                    {canCreate && (
                        <Button className="bg-green-600 hover:bg-green-700" onClick={openAddForm}>
                            + Dodaj wiersz
                        </Button>
                    )}
                    <Button variant="outline"
                        onClick={() => setControlsOpen(v => !v)}
                        aria-expanded={controlsOpen}
                        aria-controls="filtersCollapse"
                    >
                        {controlsOpen ? 'Ukryj wyszukiwanie' : 'Pokaż wyszukiwanie'}
                        {hasSortOrFilter && (
                            <span
                                style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#dc3545' }}
                                aria-label="Aktywne sortowanie lub filtr"
                                title="Aktywne sortowanie lub filtr"
                            />
                        )}
                    </Button>
                </div>
            </div>
            <div className="mb-3 rounded border" id="filtersCollapse">
                <div className={`${controlsOpen ? '' : 'hidden'} p-3`}>
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
                            <label className="mb-1 block text-sm font-medium">Sortuj po</label>
                            <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={orderField} onChange={(e) => { setPage(1); setOrderField(e.target.value); }}>
                                <option value="">(brak)</option>
                                {columns.map(col => (
                                    <option key={col.id} value={col.name}>{col.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-12 sm:col-span-6 md:col-span-2 lg:col-span-2">
                            <label className="mb-1 block text-sm font-medium">Kierunek</label>
                            <div className="inline-flex w-full overflow-hidden rounded border border-gray-300">
                                <button type="button" className={`px-3 py-2 text-sm ${orderDir === 'asc' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => { setPage(1); setOrderDir('asc'); }}>A-Z</button>
                                <button type="button" className={`border-l border-gray-300 px-3 py-2 text-sm ${orderDir === 'desc' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => { setPage(1); setOrderDir('desc'); }}>Z-A</button>
                            </div>
                        </div>
                        
                        <div className="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-2">
                            <label className="mb-1 block text-sm font-medium">Rozmiar strony</label>
                            <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={size} onChange={(e) => { setPage(1); setSize(Number(e.target.value)); }}>
                                {[10,20,50,100,200].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-12">
                            <div className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-12 sm:col-span-6 md:col-span-3">
                                    <label className="mb-1 block text-sm font-medium">Pole</label>
                                    <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={filterField} onChange={(e) => { setFilterField(e.target.value); setFilterOp(''); }}>
                                        <option value="">(wybierz pole)</option>
                                        {columns.map(col => (
                                            <option key={col.id} value={col.name}>{col.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-12 sm:col-span-6 md:col-span-3">
                                    <label className="mb-1 block text-sm font-medium">Operator</label>
                                    <select className="w-full rounded border border-gray-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={filterOp} onChange={(e) => setFilterOp(e.target.value)} disabled={!filterField}>
                                        <option value="">(wybierz operator)</option>
                                        {getOpsForType(columns.find(c => c.name === filterField)?.type).map(op => <option key={op} value={op}>{op}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-12 sm:col-span-6 md:col-span-4">
                                    <label className="mb-1 block text-sm font-medium">Wartość</label>
                                    <Input className="w-full" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} disabled={!filterOp} placeholder="wartość (zgodnie z API)" />
                                </div>
                                <div className="col-span-12 sm:col-span-6 md:col-span-2">
                                    <Button variant="outline" className="w-full" disabled={!filterField || !filterOp} onClick={() => {
                                        const next = [...filtersList, { field: filterField, type: filterOp, value: filterValue }];
                                        setFiltersList(next);
                                        rebuildFiltersJson(next, filterType);
                                        setPage(1);
                                        setFilterValue('');
                                    }}>Dodaj filtr</Button>
                                </div>
                            </div>
                            {filtersList.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <label className="mb-0 mr-2 text-sm font-medium">Typ łączenia</label>
                                    <select className="w-auto rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={filterType} onChange={(e) => { setFilterType(e.target.value); rebuildFiltersJson(filtersList, e.target.value); setPage(1); }}>
                                        <option value="AND">AND</option>
                                        <option value="OR">OR</option>
                                    </select>
                                    {filtersList.map((f, idx) => (
                                        <span key={idx} className="inline-flex items-center rounded bg-gray-600 px-2 py-0.5 text-xs text-white">
                                            {f.field} {f.type} {String(f.value)}
                                            <button type="button" className="ml-2 text-white" onClick={() => {
                                                const next = filtersList.filter((_, i) => i !== idx);
                                                setFiltersList(next);
                                                rebuildFiltersJson(next, filterType);
                                                setPage(1);
                                            }}>×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-2">
                            <Button variant="outline" className="w-full" onClick={() => { setSearch(''); setOrderField(''); setOrderDir('asc'); setFilterType('AND'); setFiltersJson(''); setFiltersList([]); setFilterField(''); setFilterOp(''); setFilterValue(''); setPage(1); }}>Wyczyść</Button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Górny, zawsze widoczny pasek przewijania zsynchronizowany z tabelą */}
            <div
                ref={topScrollRef}
                onScroll={syncFromTop}
                style={{ overflowX: 'scroll', scrollbarGutter: 'stable both-edges', height: 16 }}
                className="mb-1"
            >
                <div style={{ width: scrollContentWidth || '100%', height: 1 }} />
            </div>
            {/* Sticky header synced horizontally */}
            <div ref={headerScrollRef} style={{ overflowX: 'hidden', overflowY: 'hidden', marginBottom: 0, padding: 0, scrollbarGutter: 'stable both-edges' }}>
                <table ref={headerTableRef} className="mb-0 w-full text-sm" style={{ tableLayout: 'fixed', width: scrollContentWidth ? `${scrollContentWidth}px` : '100%' }}>
                    <thead className="bg-gray-800 text-center text-white">
                        <tr>
                            {columns.map(column => (
                                <th
                                    key={column.id}
                                    scope="col"
                                    className="align-middle"
                                    style={{ position: 'relative', width: columnWidths[column.name] ? `${columnWidths[column.name]}px` : undefined, minWidth: 60, top: 0 }}
                                >
                                    <span className="mr-2" title={column.type || ''}>{getTypeIcon(column)}</span>
                                    {column.name}
                                    <span
                                        onMouseDown={(e) => handleResizeMouseDown(column.name, e)}
                                        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 8, cursor: 'col-resize', userSelect: 'none', zIndex: 2, background: 'transparent' }}
                                        title="Przeciągnij, aby zmienić szerokość"
                                    />
                                </th>
                            ))}
                            <th scope="col" className="align-middle" style={{ width: 120, textAlign: 'center' }}>
                                Akcje
                            </th>
                        </tr>
                    </thead>
                </table>
            </div>

            <div ref={tableScrollRef} onScroll={syncFromTable} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', scrollbarGutter: 'stable both-edges', marginTop: 0, padding: 0 }}>
                <table className="mb-0 w-full text-sm" style={{ tableLayout: 'fixed', width: scrollContentWidth ? `${scrollContentWidth}px` : '100%' }}>
                    <tbody>
                        {rows.map(row => (
                            <tr
                                key={row.id}
                                onDoubleClick={() => { if (canUpdate) openEditForm(row); }}
                                style={{ cursor: canUpdate ? 'pointer' : 'default' }}
                            >
                                {columns.map(column => (
                                    <td key={column.id} style={{ width: columnWidths[column.name] ? `${columnWidths[column.name]}px` : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {formatCellDisplay(column, row[column.name])}
                                    </td>
                                ))}
                                <td style={{ width: 120, textAlign: 'center' }}>
                                    <div className="inline-flex gap-2">
                                        {canUpdate && (
                                            <Button variant="outline" onClick={() => openEditForm(row)} title="Edytuj">✏️</Button>
                                        )}
                                        {canDelete && (
                                            <Button variant="outline" onClick={() => deleteRow(row.id)} title="Usuń">🗑️</Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
            </table>
            </div>
            <div className="mt-2 flex items-center justify-between">
                <div>
                    <span className="mr-2">Razem: {count}</span>
                    <span>Strona {page} z {Math.max(1, Math.ceil(count / Math.max(1, size)))}</span>
                </div>
                <div className="inline-flex gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Poprzednia</Button>
                    <Button variant="outline" disabled={page >= Math.ceil(count / Math.max(1, size))} onClick={() => setPage(p => p + 1)}>Następna</Button>
                </div>
            </div>

            {/* Formularz dodawania/edycji wierszy */}
            {showForm && (
                <RowForm
                    tableId={tableId}
                    columns={columns}
                    editingRow={editingRow}
                    onClose={closeForm}
                    onSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
};

export default TableBaserow;
