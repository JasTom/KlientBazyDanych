import React, { useState, useEffect } from 'react';
import apiClient from './apiClient';

const TableBaserow = ({ tableId, tableName }) => {
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
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
                const response = await apiClient.get(`/database/rows/table/${tableId}/`, { params: { user_field_names: true } });
                setRows(response.data.results);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchColumns();
        fetchRows();
    }, [tableId]);

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
                <button className="btn btn-primary" onClick={saveChanges}>Zapisz zmiany</button>
            </div>
            <div className="table-responsive">
                <table className="table table-striped table-bordered table-hover table-sm align-middle">
                    <thead className="table-dark text-center">
                        <tr>
                            {columns.map(column => (
                                <th key={column.id} scope="col" className="align-middle">
                                    <span className="me-2" title={column.type || ''}>{getTypeIcon(column)}</span>
                                    {column.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id}>
                                {columns.map(column => (
                                    <td key={column.id}>
                                        {(() => {
                                            const raw = row[column.name];
                                            const complex = isComplexValue(raw);
                                            if (column.read_only || complex) {
                                                return formatCellDisplay(column, raw);
                                            }
                                            return (
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    value={formatCellValue(raw)}
                                                    onChange={(e) => handleCellChange(row.id, column.name, e.target.value)}
                                                />
                                            );
                                        })()}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TableBaserow;
