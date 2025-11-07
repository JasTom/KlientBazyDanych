import React, { useState } from 'react';
import apiClient from './apiClient';

const RowForm = ({ tableId, columns, editingRow, onClose, onSuccess }) => {
    const [formData, setFormData] = useState(editingRow ? { ...editingRow } : {});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [linkRowData, setLinkRowData] = useState({}); // { [fieldName]: { rows: [], columns: [], loading: false } }
    const [openDropdowns, setOpenDropdowns] = useState({}); // { [fieldName]: boolean }
    const [searchTerms, setSearchTerms] = useState({}); // { [fieldName]: string }
    const [selectSearchTerms, setSelectSearchTerms] = useState({}); // { [fieldName]: string } dla multiple_select
    const [uploadingFiles, setUploadingFiles] = useState({}); // { [fieldName]: boolean }

    // Tailwind klasy pomocnicze
    const inputClass = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const selectClass = inputClass;
    const btnPrimary = "inline-flex items-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
    const btnSecondary = "inline-flex items-center rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
    const badgeGray = "inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700";

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

    const getSelectValue = (fieldValue, fieldType) => {
        if (fieldType === 'multiple_select') {
            if (Array.isArray(fieldValue)) {
                return fieldValue.map(item => {
                    if (typeof item === 'object' && item.id) {
                        return item.id;
                    }
                    return item;
                });
            }
            return [];
        } else if (fieldType === 'single_select') {
            if (fieldValue && typeof fieldValue === 'object' && fieldValue.id) {
                return fieldValue.id;
            }
            return fieldValue || '';
        }
        return fieldValue;
    };

    const handleSelectChange = (fieldName, fieldType, selectedValue, column) => {
        if (fieldType === 'multiple_select') {
            // Dla API Baserow przesyłamy tylko tablicę ID
            const selectedIds = Array.from(selectedValue).map(optionValue => parseInt(optionValue));
            handleFormChange(fieldName, selectedIds);
        } else if (fieldType === 'single_select') {
            // Dla API Baserow przesyłamy tylko ID
            const selectedId = selectedValue ? parseInt(selectedValue) : null;
            handleFormChange(fieldName, selectedId);
        }
    };

    const handleFormChange = (fieldName, value) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
    };

    // Pobierz dane z powiązanej tabeli dla pola link_row
    const fetchLinkRowData = async (column) => {
        if (!column.link_row_table_id) return;
        
        const fieldName = column.name;
        setLinkRowData(prev => ({
            ...prev,
            [fieldName]: { ...prev[fieldName], loading: true }
        }));

        try {
            // Pobierz kolumny powiązanej tabeli
            const columnsResponse = await apiClient.get('/database/fields/table/' + column.link_row_table_id + '/', {
                headers: { 'X-Baserow-Token-Index': (localStorage.getItem('tok_' + column.link_row_table_id) ?? localStorage.getItem('tok_' + tableId) ?? '') }
            });
            const linkedColumns = columnsResponse.data || [];
            
            // Znajdź pole primary
            const primaryColumn = linkedColumns.find(col => col.primary);
            const primaryFieldName = primaryColumn ? primaryColumn.name : 'id';

            let allRows = [];
            let page = 1;
            const pageSize = 200; // Maksymalny rozmiar strony w API Baserow
            let hasMore = true;

            while (hasMore) {
                const response = await apiClient.get('/database/rows/table/' + column.link_row_table_id + '/?user_field_names=true&page=' + page + '&size=' + pageSize, {
                    headers: { 'X-Baserow-Token-Index': (localStorage.getItem('tok_' + column.link_row_table_id) ?? localStorage.getItem('tok_' + tableId) ?? '') }
                });
                const rows = response.data.results || [];
                allRows = [...allRows, ...rows];
                
                // Sprawdź czy są więcej danych
                hasMore = rows.length === pageSize;
                page++;
            }

            setLinkRowData(prev => ({
                ...prev,
                [fieldName]: { 
                    rows: allRows, 
                    columns: linkedColumns,
                    primaryFieldName: primaryFieldName,
                    loading: false 
                }
            }));
        } catch (err) {
            console.error('Błąd pobierania danych dla pola ' + fieldName + ':', err);
            setLinkRowData(prev => ({
                ...prev,
                [fieldName]: { 
                    rows: [], 
                    columns: [],
                    primaryFieldName: 'id',
                    loading: false 
                }
            }));
        }
    };

    // Pobierz dane dla wszystkich pól link_row przy inicjalizacji
    React.useEffect(() => {
        columns.forEach(column => {
            if (column.type === 'link_row' && column.link_row_table_id) {
                fetchLinkRowData(column);
            }
        });
    }, [columns]);

    // Zamykanie dropdown po kliknięciu poza nim
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.link-row-dropdown') && !event.target.closest('.multiple-select-dropdown')) {
                setOpenDropdowns({});
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getLinkRowValue = (fieldValue, fieldType) => {
        if (fieldType === 'link_row') {
            if (Array.isArray(fieldValue)) {
                return fieldValue.map(item => {
                    if (typeof item === 'object' && item.id) {
                        return item.id;
                    }
                    return item;
                });
            }
            return fieldValue || [];
        }
        return fieldValue;
    };

    const handleLinkRowChange = (fieldName, fieldType, selectedValue, column) => {
        if (fieldType === 'link_row') {
            const selectedIds = Array.from(selectedValue).map(optionValue => parseInt(optionValue));
            handleFormChange(fieldName, selectedIds);
        }
    };

    // Obsługa multiselect dla link_row
    const toggleDropdown = (fieldName) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [fieldName]: !prev[fieldName]
        }));
    };

    const toggleRowSelection = (fieldName, rowId) => {
        const currentValues = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
        
        // Sprawdź czy wiersz jest już wybrany, uwzględniając obiekty
        const isSelected = currentValues.some(item => {
            if (typeof item === 'object' && item !== null && item.id) {
                return item.id === rowId;
            }
            return item === rowId;
        });
        
        let newValues;
        if (isSelected) {
            // Usuń wiersz
            newValues = currentValues.filter(item => {
                if (typeof item === 'object' && item !== null && item.id) {
                    return item.id !== rowId;
                }
                return item !== rowId;
            });
        } else {
            // Dodaj wiersz
            newValues = [...currentValues, rowId];
        }
        
        handleFormChange(fieldName, newValues);
    };

    const getSelectedRowsText = (fieldName, rows) => {
        const selectedIds = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
        const selectedRows = rows.filter(row => selectedIds.includes(row.id));
        const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
        
        if (selectedRows.length === 0) {
            return 'Wybierz opcje...';
        } else if (selectedRows.length === 1) {
            return selectedRows[0][primaryFieldName] || ('ID: ' + selectedRows[0].id);
        } else {
            return 'Wybrano ' + selectedRows.length + ' opcji';
        }
    };

    // Filtrowanie wierszy na podstawie wyszukiwania
    const getFilteredRows = (fieldName, rows) => {
        const searchTerm = searchTerms[fieldName] || '';
        if (!searchTerm.trim()) return rows;
        
        const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
        return rows.filter(row => {
            const displayText = (row[primaryFieldName] || ('ID: ' + row.id)).toString().toLowerCase();
            return displayText.includes(searchTerm.toLowerCase());
        });
    };

    // Usuwanie wybranej pozycji
    const removeSelectedRow = (fieldName, rowId) => {
        const currentValues = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
        const newValues = currentValues.filter(item => {
            // Obsłuż zarówno obiekty jak i bezpośrednie ID
            if (typeof item === 'object' && item !== null && item.id) {
                return item.id !== rowId;
            }
            return item !== rowId;
        });
        handleFormChange(fieldName, newValues);
    };

    // Obsługa wyszukiwania
    const handleSearchChange = (fieldName, value) => {
        setSearchTerms(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    // Obsługa wyszukiwania dla multiple_select
    const handleSelectSearchChange = (fieldName, value) => {
        setSelectSearchTerms(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    // Przesyłanie pliku do API Baserow
    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await apiClient.post('/user-files/upload-file/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-Baserow-Token-Index': (localStorage.getItem('tok_' + tableId) ?? '')
                }
            });
            return response.data;
        } catch (err) {
            console.error('Błąd przesyłania pliku:', err);
            throw err;
        }
    };

    // Obsługa wyboru pliku
    const handleFileChange = async (fieldName, files) => {
        if (!files || files.length === 0) {
            return;
        }

        setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));

        try {
            const uploadPromises = Array.from(files).map(file => uploadFile(file));
            const uploadedFiles = await Promise.all(uploadPromises);
            
            // Format zgodny z API Baserow
            const newFileData = uploadedFiles.map(file => ({
                name: file.name,
                visible_name: file.visible_name,
                url: file.url,
                thumbnails: file.thumbnails
            }));
            
            // Dodaj nowe pliki do istniejących
            const currentFiles = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
            const updatedFiles = [...currentFiles, ...newFileData];
            
            handleFormChange(fieldName, updatedFiles);
        } catch (err) {
            setError('Błąd przesyłania plików: ' + err.message);
        } finally {
            setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
        }
    };

    // Filtrowanie opcji multiple_select na podstawie wyszukiwania
    const getFilteredSelectOptions = (fieldName, options) => {
        const searchTerm = selectSearchTerms[fieldName] || '';
        if (!searchTerm.trim()) return options;
        
        return options.filter(option => {
            const displayText = option.value.toString().toLowerCase();
            return displayText.includes(searchTerm.toLowerCase());
        });
    };

    // Usuwanie wybranej opcji multiple_select
    const removeSelectedOption = (fieldName, optionId) => {
        const currentValues = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
        const newValues = currentValues.filter(item => {
            // Obsłuż zarówno obiekty jak i bezpośrednie ID
            if (typeof item === 'object' && item !== null && item.id) {
                return item.id !== optionId;
            }
            return item !== optionId;
        });
        handleFormChange(fieldName, newValues);
    };

    // Toggle opcji multiple_select
    const toggleOptionSelection = (fieldName, optionId) => {
        const currentValues = Array.isArray(formData[fieldName]) ? formData[fieldName] : [];
        
        // Sprawdź czy opcja jest już wybrana, uwzględniając obiekty
        const isSelected = currentValues.some(item => {
            if (typeof item === 'object' && item !== null && item.id) {
                return item.id === optionId;
            }
            return item === optionId;
        });
        
        let newValues;
        if (isSelected) {
            // Usuń opcję
            newValues = currentValues.filter(item => {
                if (typeof item === 'object' && item !== null && item.id) {
                    return item.id !== optionId;
                }
                return item !== optionId;
            });
        } else {
            // Dodaj opcję
            newValues = [...currentValues, optionId];
        }
        
        handleFormChange(fieldName, newValues);
    };

    // Funkcja czyszcząca dane przed wysłaniem do API
    const cleanFormDataForAPI = (data) => {
        const cleaned = { ...data };
        
        Object.keys(cleaned).forEach(fieldName => {
            const value = cleaned[fieldName];
            
            // Znajdź kolumnę dla tego pola
            const column = columns.find(col => col.name === fieldName);
            
            // Pomiń pola tylko do odczytu
            if (column && (column.read_only || column.type === 'formula' || column.type === 'lookup' || column.type === 'count' || column.type === 'rollup')) {
                delete cleaned[fieldName];
                return;
            }
            
            // Dla pól plików - zachowaj pełną strukturę
            if (column && column.type === 'file' && Array.isArray(value)) {
                // Dla pól plików - wyślij pełną strukturę z name, visible_name, url, thumbnails
                cleaned[fieldName] = value.map(file => ({
                    name: file.name,
                    visible_name: file.visible_name,
                    url: file.url,
                    thumbnails: file.thumbnails
                }));
            }
            // Dla pól select (single_select, multiple_select, link_row)
            else if (Array.isArray(value)) {
                // Tablica - zostaw tylko ID
                const ids = value.map(item => {
                    if (typeof item === 'object' && item !== null && item.id) {
                        return item.id;
                    }
                    return item;
                });
                
                // Sprawdź czy pole link_row pozwala na wiele relacji
                if (column && column.type === 'link_row') {
                    if (column.link_row_multiple_relationships === false || ids.length <= 1) {
                        // Pojedyncza relacja - weź tylko pierwszy element lub pustą tablicę
                        cleaned[fieldName] = ids.length > 0 ? ids[0] : [];
                    } else {
                        // Wiele relacji - wyślij tablicę (nawet pustą)
                        cleaned[fieldName] = ids;
                    }
                } else {
                    // Dla innych typów pól (multiple_select) - zawsze tablica
                    cleaned[fieldName] = ids;
                }
            } else if (typeof value === 'object' && value !== null && value.id) {
                // Pojedynczy obiekt - zostaw tylko ID
                cleaned[fieldName] = value.id;
            } else if (column && column.type === 'link_row' && (value === null || value === undefined || value === '')) {
                // Puste pole link_row - wyślij pustą tablicę zamiast null
                cleaned[fieldName] = [];
            }
        });
        
        return cleaned;
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            // Wyczyść dane przed wysłaniem
            const cleanedData = cleanFormDataForAPI(formData);
            
            if (editingRow) {
                // Edycja istniejącego wiersza
                const response = await apiClient.patch('/database/rows/table/' + tableId + '/' + editingRow.id + '/?user_field_names=true', cleanedData, {
                    headers: { 'X-Baserow-Token-Index': (localStorage.getItem('tok_' + tableId) ?? '') }
                });
                onSuccess('updated', response.data);
            } else {
                // Dodawanie nowego wiersza
                const response = await apiClient.post('/database/rows/table/' + tableId + '/?user_field_names=true', cleanedData, {
                    headers: { 'X-Baserow-Token-Index': (localStorage.getItem('tok_' + tableId) ?? '') }
                });
                onSuccess('created', response.data);
            }
            onClose();
        } catch (err) {
            const apiMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
            setError(apiMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="flex w-full max-w-5xl max-w-[95vw] max-h-[calc(100vh-2rem)] flex-col rounded bg-white shadow-lg overflow-x-hidden">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                    <h5 className="text-lg font-semibold">
                        {editingRow ? 'Edytuj wiersz' : 'Dodaj nowy wiersz'}
                    </h5>
                    <button type="button" aria-label="Zamknij" className="rounded p-2 text-gray-500 hover:bg-gray-100" onClick={onClose}>×</button>
                    </div>
                    <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col">
                        <div className="flex-1 overflow-y-auto overflow-x-auto px-4 py-3">
                        {error && (
                            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                                Błąd: {error}
                            </div>
                        )}
                        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                            {columns.map((column) => {
                                const fieldName = column.name;
                                const fieldValue = formData[fieldName] || '';
                                const fieldType = String(column.type || '').toLowerCase();

                                const isBasicText = !column.read_only && !fieldType.includes('long_text') && !fieldType.includes('auto_number') && (
                                    fieldType === 'text' || fieldType === 'number' || fieldType.includes('url') || fieldType.includes('email') || fieldType.includes('phone')
                                );

                                const isDate = !column.read_only && fieldType.includes('date');
                                const isBoolean = !column.read_only && fieldType.includes('boolean');
                                const isSingleSelect = !column.read_only && fieldType === 'single_select';
                                const isMultipleSelect = !column.read_only && fieldType === 'multiple_select';
                                const isLinkRow = !column.read_only && fieldType === 'link_row';
                                const isFile = !column.read_only && fieldType.includes('file');
                                const isLongText = fieldType.includes('long_text') && !column.read_only;
                                const isReadonly = (column.read_only || fieldType.includes('auto_number'));

                                return (
                                    <div key={column.id} className="min-w-0">
                                        <label className="mb-1 block max-w-full break-words text-sm font-medium text-gray-700">
                                            {column.name}
                                            {column.primary && <span className="ml-1 text-red-600">*</span>}
                                        </label>

                                        {isBasicText && (
                                            <input
                                                type={fieldType.includes('number') ? 'number' : fieldType.includes('email') ? 'email' : fieldType.includes('url') ? 'url' : fieldType.includes('phone') ? 'tel' : 'text'}
                                                className={inputClass}
                                                value={fieldValue}
                                                onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                required={column.primary}
                                            />
                                        )}

                                        {isDate && (
                                            <input
                                                type={column.date_include_time ? 'datetime-local' : 'date'}
                                                className={inputClass}
                                                value={fieldValue ? new Date(fieldValue).toISOString().slice(0, column.date_include_time ? 16 : 10) : ''}
                                                onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                required={column.primary}
                                            />
                                        )}

                                        {isBoolean && (
                                            <select
                                                className={selectClass}
                                                value={fieldValue}
                                                onChange={(e) => handleFormChange(fieldName, e.target.value === 'true')}
                                                required={column.primary}
                                            >
                                                <option value="">Wybierz...</option>
                                                <option value="true">Tak</option>
                                                <option value="false">Nie</option>
                                            </select>
                                        )}

                                        {isSingleSelect && (
                                            <select
                                                className={selectClass}
                                                value={getSelectValue(fieldValue, 'single_select')}
                                                onChange={(e) => handleSelectChange(fieldName, 'single_select', e.target.value, column)}
                                                required={column.primary}
                                            >
                                                <option value="">Wybierz opcję...</option>
                                                {(column.select_options || []).map((option) => (
                                                    <option key={option.id} value={option.id}>{option.value}</option>
                                                ))}
                                            </select>
                                        )}

                                        {isMultipleSelect && (
                                            <div>
                                                <select
                                                    multiple
                                                    className={selectClass}
                                                    value={(Array.isArray(fieldValue) ? fieldValue : []).map((v) => {
                                                        if (typeof v === 'object' && v !== null && v.id) return String(v.id);
                                                        return String(v);
                                                    })}
                                                    onChange={(e) => {
                                                        const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                                                        handleSelectChange(fieldName, 'multiple_select', selected, column);
                                                    }}
                                                    required={column.primary}
                                                >
                                                    {(column.select_options || []).map((option) => (
                                                        <option key={option.id} value={option.id}>
                                                            {option.value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {isLinkRow && (
                                            <div>
                                                {linkRowData[fieldName]?.loading ? (
                                                    <div className="p-2 text-sm text-gray-500">Ładowanie danych...</div>
                                                ) : (
                                                    (() => {
                                                        const rows = linkRowData[fieldName]?.rows || [];
                                                        const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
                                                        const allowsMultiple = column.link_row_multiple_relationships !== false;

                                                        if (rows.length === 0) {
                                                            return <div className="text-sm text-gray-500">Brak dostępnych wierszy</div>;
                                                        }

                                                        if (allowsMultiple) {
                                                            const valueIds = Array.isArray(fieldValue)
                                                                ? fieldValue.map((v) => (typeof v === 'object' && v !== null && v.id ? String(v.id) : String(v)))
                                                                : [];
                                                            return (
                                                                <select
                                                                    multiple
                                                                    className={selectClass}
                                                                    value={valueIds}
                                                                    onChange={(e) => {
                                                                        const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                                                                        handleLinkRowChange(fieldName, 'link_row', selected, column);
                                                                    }}
                                                                    required={column.primary}
                                                                >
                                                                    {rows.map((r) => (
                                                                        <option key={r.id} value={r.id}>
                                                                            {r[primaryFieldName] || 'ID: ' + r.id}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        }

                                                        const singleValue = (Array.isArray(fieldValue) ? fieldValue[0] : fieldValue);
                                                        const singleId = singleValue && typeof singleValue === 'object' && singleValue.id ? String(singleValue.id) : (singleValue ? String(singleValue) : '');
                                                        return (
                                                            <select
                                                                className={selectClass}
                                                                value={singleId}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    handleFormChange(fieldName, val ? parseInt(val) : null);
                                                                }}
                                                                required={column.primary}
                                                            >
                                                                <option value="">Wybierz opcję...</option>
                                                                {rows.map((r) => (
                                                                    <option key={r.id} value={r.id}>
                                                                        {r[primaryFieldName] || 'ID: ' + r.id}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        )}

                                        {isFile && (
                                            <div>
                                                <input
                                                    type="file"
                                                    className={inputClass}
                                                    multiple
                                                    onChange={(e) => handleFileChange(fieldName, e.target.files)}
                                                    required={column.primary}
                                                    disabled={uploadingFiles[fieldName]}
                                                />
                                                {uploadingFiles[fieldName] && (
                                                    <div className="mt-2 flex items-center text-sm text-gray-600">
                                                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></span>
                                                        Przesyłanie plików...
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {isLongText && (
                                            <textarea
                                                className={inputClass}
                                                rows={3}
                                                value={fieldValue}
                                                onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                required={column.primary}
                                            />
                                        )}

                                        {isReadonly && (
                                            fieldType.includes('long_text') ? (
                                                <textarea className={inputClass} rows={3} value={formatCellValue(fieldValue)} disabled />
                                            ) : (
                                                <input type="text" className={inputClass} value={formatCellValue(fieldValue)} disabled />
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                        <button type="button" className={btnSecondary} onClick={onClose} disabled={loading}>
                            Anuluj
                        </button>
                        <button type="submit" className={btnPrimary} disabled={loading}>
                            {loading ? 'Zapisywanie...' : (editingRow ? 'Zapisz zmiany' : 'Dodaj wiersz')}
                        </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RowForm;
