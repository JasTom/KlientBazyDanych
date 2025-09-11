import React, { useState, useEffect } from 'react';
import apiClient from './apiClient';

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
    const [columnWidths, setColumnWidths] = useState({}); // { [columnName]: number }
    const [isResizing, setIsResizing] = useState(false);
    const [resizingCol, setResizingCol] = useState(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [scrollContentWidth, setScrollContentWidth] = useState(0);
    const tableScrollRef = React.useRef(null);
    const topScrollRef = React.useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            const payload = { filter_type: typeLogic || 'AND', filters: list.map(f => ({ field: f.field, type: f.type, value: f.value })) };
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
    };
    const syncFromTable = (e) => {
        const tbl = e.currentTarget;
        const topEl = topScrollRef.current;
        if (topEl && topEl.scrollLeft !== tbl.scrollLeft) topEl.scrollLeft = tbl.scrollLeft;
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
            return <span className={`badge ${val ? 'text-bg-success' : 'text-bg-secondary'}`}>{val ? 'Tak' : 'Nie'}</span>;
        }
        // Daty/czasy
        if (type.includes('date') || type.includes('created') || type.includes('modified')) {
            try {
                const date = new Date(String(raw));
                if (!isNaN(date.getTime())) return <span>{date.toLocaleString()}</span>;
            } catch (_) { /* ignore */ }
        }
        // Single select
        if (type.includes('single_select')) {
            const label = formatCellValue(raw);
            return <span className="badge text-bg-info">{label}</span>;
        }
        // Multiple select
        if (type.includes('multiple_select')) {
            return (
                <span>
                    {asArray(raw).map((opt, idx) => (
                        <span key={idx} className="badge text-bg-info me-1">{formatCellValue(opt)}</span>
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
                <div className="d-flex flex-wrap gap-2">
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
                const response = await apiClient.get(`/database/fields/table/${tableId}/`);
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
                if (filtersJson) {
                    params.filters = filtersJson;
                    if (filterType) params.filter_type = filterType;
                }

                const response = await apiClient.get(`/database/rows/table/${tableId}/`, { params });
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

    if (loading) return <div>Ładowanie...</div>;
    if (error) return <div>Błąd: {error}</div>;
    // Funkcja do aktualizacji komórki
    const handleCellChange = (rowId, columnName, value) => {
        setRows(prevRows =>
            prevRows.map(row =>
                row.id === rowId ? { ...row, [columnName]: value } : row
            )
        );
    };

    // Funkcja do zapisywania zmian (przykład)
    const saveChanges = async () => {
        try {
            // Tutaj dodaj logikę do zapisywania zmian do API
            console.log("Zapisywanie zmian:", rows);
        } catch (err) {
            setError(err.message);
        }
    };
    return (
        <div className="container-fluid my-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h1 className="h4 mb-0">Edytowalna tabela (ID: {tableName})</h1>
                <div className="d-flex align-items-center gap-2" style={{ maxWidth: '60%' }}>
                    <input
                        className="form-control form-control-sm"
                        style={{ minWidth: 180 }}
                        value={search}
                        onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                        placeholder="Szukaj..."
                    />
                    {(() => {
                        const hasSortOrFilter = Boolean(orderField) || filtersList.length > 0 || Boolean(search.trim());
                        return (
                            <button
                                className="btn btn-outline-secondary position-relative"
                                onClick={() => setControlsOpen(v => !v)}
                                aria-expanded={controlsOpen}
                                aria-controls="filtersCollapse"
                            >
                                {controlsOpen ? 'Ukryj wyszukiwanie' : 'Pokaż wyszukiwanie'}
                                {hasSortOrFilter && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            backgroundColor: '#dc3545'
                                        }}
                                        aria-label="Aktywne sortowanie lub filtr"
                                        title="Aktywne sortowanie lub filtr"
                                    />
                                )}
                            </button>
                        );
                    })()}
                </div>
            </div>
            <div className="card mb-3" id="filtersCollapse">
                <div className={`card-body ${controlsOpen ? '' : 'd-none'}`}>
                    <div className="row g-2 align-items-end">
                        <div className="col-sm-6 col-md-4 col-lg-3">
                            <label className="form-label">Sortuj po</label>
                            <select className="form-select" value={orderField} onChange={(e) => { setPage(1); setOrderField(e.target.value); }}>
                                <option value="">(brak)</option>
                                {columns.map(col => (
                                    <option key={col.id} value={col.name}>{col.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-sm-6 col-md-2 col-lg-2">
                            <label className="form-label d-block">Kierunek</label>
                            <div className="btn-group w-100" role="group">
                                <button type="button" className={`btn btn-outline-secondary ${orderDir === 'asc' ? 'active' : ''}`} onClick={() => { setPage(1); setOrderDir('asc'); }}>A-Z</button>
                                <button type="button" className={`btn btn-outline-secondary ${orderDir === 'desc' ? 'active' : ''}`} onClick={() => { setPage(1); setOrderDir('desc'); }}>Z-A</button>
                            </div>
                        </div>
                        
                        <div className="col-sm-6 col-md-3 col-lg-2">
                            <label className="form-label">Rozmiar strony</label>
                            <select className="form-select" value={size} onChange={(e) => { setPage(1); setSize(Number(e.target.value)); }}>
                                {[10,20,50,100,200].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12">
                            <div className="row g-2 align-items-end">
                                <div className="col-sm-6 col-md-3">
                                    <label className="form-label">Pole</label>
                                    <select className="form-select" value={filterField} onChange={(e) => { setFilterField(e.target.value); setFilterOp(''); }}>
                                        <option value="">(wybierz pole)</option>
                                        {columns.map(col => (
                                            <option key={col.id} value={col.name}>{col.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-sm-6 col-md-3">
                                    <label className="form-label">Operator</label>
                                    <select className="form-select" value={filterOp} onChange={(e) => setFilterOp(e.target.value)} disabled={!filterField}>
                                        <option value="">(wybierz operator)</option>
                                        {(() => {
                                            const col = columns.find(c => c.name === filterField);
                                            const ops = getOpsForType(col?.type);
                                            return ops.map(op => <option key={op} value={op}>{op}</option>);
                                        })()}
                                    </select>
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <label className="form-label">Wartość</label>
                                    <input className="form-control" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} disabled={!filterOp} placeholder="wartość (zgodnie z API)" />
                                </div>
                                <div className="col-sm-6 col-md-2 d-grid">
                                    <button className="btn btn-outline-primary" disabled={!filterField || !filterOp} onClick={() => {
                                        const next = [...filtersList, { field: filterField, type: filterOp, value: filterValue }];
                                        setFiltersList(next);
                                        rebuildFiltersJson(next, filterType);
                                        setPage(1);
                                        setFilterValue('');
                                    }}>Dodaj filtr</button>
                                </div>
                            </div>
                            {filtersList.length > 0 && (
                                <div className="mt-2 d-flex align-items-center flex-wrap gap-2">
                                    <label className="form-label me-2 mb-0">Typ łączenia</label>
                                    <select className="form-select form-select-sm w-auto" value={filterType} onChange={(e) => { setFilterType(e.target.value); rebuildFiltersJson(filtersList, e.target.value); setPage(1); }}>
                                        <option value="AND">AND</option>
                                        <option value="OR">OR</option>
                                    </select>
                                    {filtersList.map((f, idx) => (
                                        <span key={idx} className="badge text-bg-secondary">
                                            {f.field} {f.type} {String(f.value)}
                                            <button type="button" className="btn btn-sm btn-link text-white ms-2 p-0" onClick={() => {
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
                        <div className="col-sm-6 col-md-3 col-lg-2 d-flex gap-2">
                            <button className="btn btn-outline-secondary w-100" onClick={() => { setSearch(''); setOrderField(''); setOrderDir('asc'); setFilterType('AND'); setFiltersJson(''); setFiltersList([]); setFilterField(''); setFilterOp(''); setFilterValue(''); setPage(1); }}>Wyczyść</button>
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
            <div ref={tableScrollRef} onScroll={syncFromTable} className="table-responsive" style={{ overflowX: 'scroll', scrollbarGutter: 'stable both-edges' }}>
                <table className="table table-striped table-bordered table-hover table-sm align-middle" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead className="table-dark text-center">
                    <tr>
                        {columns.map(column => (
                                <th
                                    key={column.id}
                                    scope="col"
                                    className="align-middle"
                                    style={{ position: 'relative', width: columnWidths[column.name] ? `${columnWidths[column.name]}px` : undefined, minWidth: 60 }}
                                >
                                    <span className="me-2" title={column.type || ''}>{getTypeIcon(column)}</span>
                                    {column.name}
                                    <span
                                        onMouseDown={(e) => handleResizeMouseDown(column.name, e)}
                                        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 8, cursor: 'col-resize', userSelect: 'none', zIndex: 2, background: 'transparent' }}
                                        title="Przeciągnij, aby zmienić szerokość"
                                    />
                                </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.id}>
                            {columns.map(column => (
                                    <td key={column.id} style={{ width: columnWidths[column.name] ? `${columnWidths[column.name]}px` : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {formatCellDisplay(column, row[column.name])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
            <div className="d-flex justify-content-between align-items-center mt-2">
                <div>
                    <span className="me-2">Razem: {count}</span>
                    <span>Strona {page} z {Math.max(1, Math.ceil(count / Math.max(1, size)))}</span>
                </div>
                <div className="btn-group">
                    <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Poprzednia</button>
                    <button className="btn btn-outline-secondary" disabled={page >= Math.ceil(count / Math.max(1, size))} onClick={() => setPage(p => p + 1)}>Następna</button>
                </div>
            </div>
        </div>
    );
};

export default TableBaserow;
