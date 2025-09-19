import React, { useState } from 'react';
import apiClient, { AUTH_TOKEN } from './apiClient';
import { Form, Dropdown, ButtonGroup, Button } from 'react-bootstrap';

const RowForm = ({ tableId, columns, editingRow, onClose, onSuccess }) => {
    const [formData, setFormData] = useState(editingRow ? { ...editingRow } : {});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [linkRowData, setLinkRowData] = useState({}); // { [fieldName]: { rows: [], columns: [], loading: false } }
    const [openDropdowns, setOpenDropdowns] = useState({}); // { [fieldName]: boolean }
    const [searchTerms, setSearchTerms] = useState({}); // { [fieldName]: string }
    const [selectSearchTerms, setSelectSearchTerms] = useState({}); // { [fieldName]: string } dla multiple_select
    const [uploadingFiles, setUploadingFiles] = useState({}); // { [fieldName]: boolean }

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
            const columnsResponse = await apiClient.get(`/database/fields/table/${column.link_row_table_id}/`);
            const linkedColumns = columnsResponse.data || [];
            
            // Znajdź pole primary
            const primaryColumn = linkedColumns.find(col => col.primary);
            const primaryFieldName = primaryColumn ? primaryColumn.name : 'id';

            let allRows = [];
            let page = 1;
            const pageSize = 200; // Maksymalny rozmiar strony w API Baserow
            let hasMore = true;

            while (hasMore) {
                const response = await apiClient.get(`/database/rows/table/${column.link_row_table_id}/?user_field_names=true&page=${page}&size=${pageSize}`);
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
            console.error(`Błąd pobierania danych dla pola ${fieldName}:`, err);
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
            return selectedRows[0][primaryFieldName] || `ID: ${selectedRows[0].id}`;
        } else {
            return `Wybrano ${selectedRows.length} opcji`;
        }
    };

    // Filtrowanie wierszy na podstawie wyszukiwania
    const getFilteredRows = (fieldName, rows) => {
        const searchTerm = searchTerms[fieldName] || '';
        if (!searchTerm.trim()) return rows;
        
        const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
        return rows.filter(row => {
            const displayText = (row[primaryFieldName] || `ID: ${row.id}`).toString().toLowerCase();
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
                    'Content-Type': 'multipart/form-data'
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
            setError(`Błąd przesyłania plików: ${err.message}`);
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
                const response = await apiClient.patch(`/database/rows/table/${tableId}/${editingRow.id}/?user_field_names=true`, cleanedData);
                onSuccess('updated', response.data);
            } else {
                // Dodawanie nowego wiersza
                const response = await apiClient.post(`/database/rows/table/${tableId}/?user_field_names=true`, cleanedData);
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
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            {editingRow ? 'Edytuj wiersz' : 'Dodaj nowy wiersz'}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <form onSubmit={handleFormSubmit}>
                        <div className="modal-body">
                            {error && (
                                <div className="alert alert-danger" role="alert">
                                    Błąd: {error}
                                </div>
                            )}
                            <div className="row g-3">
                                {columns.map(column => {
                                    const fieldName = column.name;
                                    const fieldValue = formData[fieldName] || '';
                                    const fieldType = String(column.type || '').toLowerCase();
                                    
                                    return (
                                        <div key={column.id} className="col-md-6">
                                            <label className="form-label">
                                                {column.name}
                                                {column.primary && <span className="text-danger ms-1">*</span>}
                                            </label>
                                            
                                            {/* Text/Number fields */}
                                            {(fieldType.includes('text') || fieldType.includes('number') || fieldType.includes('url') || fieldType.includes('email') || fieldType.includes('phone')) && (
                                                <input
                                                    type={fieldType.includes('number') ? 'number' : 
                                                          fieldType.includes('email') ? 'email' : 
                                                          fieldType.includes('url') ? 'url' : 
                                                          fieldType.includes('phone') ? 'tel' : 'text'}
                                                    className="form-control"
                                                    value={fieldValue}
                                                    onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                    required={column.primary}
                                                />
                                            )}
                                            
                                            {/* Date fields */}
                                            {fieldType.includes('date') && (
                                                <input
                                                    type={column.date_include_time ? 'datetime-local' : 'date'}
                                                    className="form-control"
                                                    value={fieldValue ? new Date(fieldValue).toISOString().slice(0, column.date_include_time ? 16 : 10) : ''}
                                                    onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                    required={column.primary}
                                                />
                                            )}
                                            
                                            {/* Boolean fields */}
                                            {fieldType.includes('boolean') && (
                                                <select
                                                    className="form-select"
                                                    value={fieldValue}
                                                    onChange={(e) => handleFormChange(fieldName, e.target.value === 'true')}
                                                    required={column.primary}
                                                >
                                                    <option value="">Wybierz...</option>
                                                    <option value="true">Tak</option>
                                                    <option value="false">Nie</option>
                                                </select>
                                            )}
                                            
                                            {/* Single Select fields */}
                                            {fieldType === 'single_select' && (
                                                <select
                                                    className="form-select"
                                                    value={getSelectValue(fieldValue, 'single_select')}
                                                    onChange={(e) => handleSelectChange(fieldName, 'single_select', e.target.value, column)}
                                                    required={column.primary}
                                                >
                                                    <option value="">Wybierz opcję...</option>
                                                    {column.select_options && column.select_options.map(option => (
                                                        <option key={option.id} value={option.id}>
                                                            {option.value}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            
                                            {/* Multiple Select fields */}
                                            {fieldType === 'multiple_select' && (
                                                <div>
                                                    <div className="position-relative multiple-select-dropdown">
                                                        {/* Wyświetlanie wybranych opcji jako tagi */}
                                                        <div 
                                                            className="border rounded p-2 d-flex flex-wrap align-items-center gap-1" 
                                                            style={{ 
                                                                minHeight: '38px',
                                                                cursor: 'pointer',
                                                                backgroundColor: openDropdowns[fieldName] ? '#f8f9fa' : 'white'
                                                            }}
                                                            onClick={() => toggleDropdown(fieldName)}
                                                        >
                                                            {(() => {
                                                                const selectedIds = Array.isArray(fieldValue) ? fieldValue : [];
                                                                // Wyciągnij ID z obiektów lub użyj bezpośrednio ID
                                                                const ids = selectedIds.map(item => {
                                                                    if (typeof item === 'object' && item !== null && item.id) {
                                                                        return item.id;
                                                                    }
                                                                    return item;
                                                                });
                                                                const selectedOptions = (column.select_options || []).filter(option => ids.includes(option.id));
                                                                
                                                                if (selectedOptions.length === 0) {
                                                                    return (
                                                                        <span className="text-muted">
                                                                            Wybierz opcje...
                                                                        </span>
                                                                    );
                                                                }
                                                                
                                                                return selectedOptions.map(option => (
                                                                    <span
                                                                        key={option.id}
                                                                        className="badge d-flex align-items-center gap-1"
                                                                        style={{ 
                                                                            fontSize: '0.75rem',
                                                                            backgroundColor: option.color === 'light-gray' ? '#6c757d' : 
                                                                                           option.color === 'light-pink' ? '#e83e8c' : 
                                                                                           option.color === 'brown' ? '#8b4513' : 
                                                                                           option.color === 'darker-cyan' ? '#20c997' : 
                                                                                           option.color === 'light-green' ? '#28a745' : '#0d6efd'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeSelectedOption(fieldName, option.id);
                                                                        }}
                                                                    >
                                                                        {option.value}
                                                                        <span style={{ cursor: 'pointer' }}>×</span>
                                                                    </span>
                                                                ));
                                                            })()}
                                                            
                                                            <span className="ms-auto text-muted">
                                                                {openDropdowns[fieldName] ? '▲' : '▼'}
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Dropdown z wyszukiwarką */}
                                                        {openDropdowns[fieldName] && (
                                                            <div 
                                                                className="border rounded mt-1 position-absolute w-100 bg-white" 
                                                                style={{ 
                                                                    zIndex: 1000,
                                                                    maxHeight: '250px',
                                                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                                                }}
                                                            >
                                                                {/* Pole wyszukiwania */}
                                                                <div className="p-2 border-bottom">
                                                                    <input
                                                                        type="text"
                                                                        className="form-control form-control-sm"
                                                                        placeholder="Szukaj..."
                                                                        value={selectSearchTerms[fieldName] || ''}
                                                                        onChange={(e) => handleSelectSearchChange(fieldName, e.target.value)}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                
                                                                {/* Lista opcji */}
                                                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                    {(() => {
                                                                        const allOptions = column.select_options || [];
                                                                        const filteredOptions = getFilteredSelectOptions(fieldName, allOptions);
                                                                        
                                                                        if (filteredOptions.length === 0) {
                                                                            return (
                                                                                <div className="p-2 text-muted text-center">
                                                                                    {selectSearchTerms[fieldName] ? 'Brak wyników wyszukiwania' : 'Brak dostępnych opcji'}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        
                                                                        return filteredOptions.map(option => {
                                                                            // Sprawdź czy opcja jest wybrana, uwzględniając obiekty z API
                                                                            const selectedIds = Array.isArray(fieldValue) ? fieldValue : [];
                                                                            const ids = selectedIds.map(item => {
                                                                                if (typeof item === 'object' && item !== null && item.id) {
                                                                                    return item.id;
                                                                                }
                                                                                return item;
                                                                            });
                                                                            const isSelected = ids.includes(option.id);
                                                                            
                                                                            return (
                                                                                <div
                                                                                    key={option.id}
                                                                                    className={`p-2 d-flex align-items-center ${isSelected ? 'bg-light' : ''}`}
                                                                                    style={{ cursor: 'pointer' }}
                                                                                    onClick={() => toggleOptionSelection(fieldName, option.id)}
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        className="form-check-input me-2"
                                                                                        checked={isSelected}
                                                                                        onChange={() => {}} // Obsługiwane przez onClick na div
                                                                                        readOnly
                                                                                    />
                                                                                    <span 
                                                                                        className="text-truncate"
                                                                                        style={{ 
                                                                                            color: option.color === 'light-gray' ? '#6c757d' : 
                                                                                                   option.color === 'light-pink' ? '#e83e8c' : 
                                                                                                   option.color === 'brown' ? '#8b4513' : 
                                                                                                   option.color === 'darker-cyan' ? '#20c997' : 
                                                                                                   option.color === 'light-green' ? '#28a745' : 'inherit'
                                                                                        }}
                                                                                    >
                                                                                        {option.value}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {column.primary && (
                                                        <input 
                                                            type="hidden" 
                                                            value={Array.isArray(fieldValue) && fieldValue.length > 0 ? 'selected' : ''} 
                                                            required 
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Link Row fields */}
                                            {fieldType === 'link_row' && (
                                                <div>
                                                    {linkRowData[fieldName]?.loading ? (
                                                        <div className="text-center text-muted p-3">
                                                            <div className="spinner-border spinner-border-sm me-2" role="status">
                                                                <span className="visually-hidden">Ładowanie...</span>
                                                            </div>
                                                            Ładowanie danych...
                                                        </div>
                                                    ) : (
                                                        <div className="position-relative link-row-dropdown">
                                                            {/* Wyświetlanie wybranych pozycji */}
                                                            <div 
                                                                className="border rounded p-2 d-flex flex-wrap align-items-center gap-1" 
                                                                style={{ 
                                                                    minHeight: '38px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: openDropdowns[fieldName] ? '#f8f9fa' : 'white'
                                                                }}
                                                                onClick={() => toggleDropdown(fieldName)}
                                                            >
                                                                {(() => {
                                                                    const selectedIds = Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [fieldValue] : []);
                                                                    // Wyciągnij ID z obiektów lub użyj bezpośrednio ID
                                                                    const ids = selectedIds.map(item => {
                                                                        if (typeof item === 'object' && item !== null && item.id) {
                                                                            return item.id;
                                                                        }
                                                                        return item;
                                                                    });
                                                                    const selectedRows = (linkRowData[fieldName]?.rows || []).filter(row => ids.includes(row.id));
                                                                    const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
                                                                    const allowsMultiple = column.link_row_multiple_relationships !== false;
                                                                    
                                                                    if (selectedRows.length === 0) {
                                                                        return (
                                                                            <span className="text-muted">
                                                                                {allowsMultiple ? 'Wybierz opcje...' : 'Wybierz opcję...'}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    
                                                                    return selectedRows.map(row => (
                                                                        <span
                                                                            key={row.id}
                                                                            className="badge bg-primary d-flex align-items-center gap-1"
                                                                            style={{ fontSize: '0.75rem' }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                removeSelectedRow(fieldName, row.id);
                                                                            }}
                                                                        >
                                                                            {row[primaryFieldName] || `ID: ${row.id}`}
                                                                            {allowsMultiple && <span style={{ cursor: 'pointer' }}>×</span>}
                                                                        </span>
                                                                    ));
                                                                })()}
                                                                
                                                                <span className="ms-auto text-muted">
                                                                    {openDropdowns[fieldName] ? '▲' : '▼'}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Dropdown z wyszukiwarką */}
                                                            {openDropdowns[fieldName] && (
                                                                <div 
                                                                    className="border rounded mt-1 position-absolute w-100 bg-white" 
                                                                    style={{ 
                                                                        zIndex: 1000,
                                                                        maxHeight: '250px',
                                                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                                                    }}
                                                                >
                                                                    {/* Pole wyszukiwania */}
                                                                    <div className="p-2 border-bottom">
                                                <input
                                                    type="text"
                                                                            className="form-control form-control-sm"
                                                                            placeholder="Szukaj..."
                                                                            value={searchTerms[fieldName] || ''}
                                                                            onChange={(e) => handleSearchChange(fieldName, e.target.value)}
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    
                                                                    {/* Lista opcji */}
                                                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                        {(() => {
                                                                            const allRows = linkRowData[fieldName]?.rows || [];
                                                                            const filteredRows = getFilteredRows(fieldName, allRows);
                                                                            const primaryFieldName = linkRowData[fieldName]?.primaryFieldName || 'id';
                                                                            
                                                                            if (filteredRows.length === 0) {
                                                                                return (
                                                                                    <div className="p-2 text-muted text-center">
                                                                                        {searchTerms[fieldName] ? 'Brak wyników wyszukiwania' : 'Brak dostępnych wierszy'}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            
                                                                        return filteredRows.map(row => {
                                                                            const currentValue = Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [fieldValue] : []);
                                                                            // Wyciągnij ID z obiektów lub użyj bezpośrednio ID
                                                                            const ids = currentValue.map(item => {
                                                                                if (typeof item === 'object' && item !== null && item.id) {
                                                                                    return item.id;
                                                                                }
                                                                                return item;
                                                                            });
                                                                            const isSelected = ids.includes(row.id);
                                                                            const displayText = row[primaryFieldName] || `ID: ${row.id}`;
                                                                            const allowsMultiple = column.link_row_multiple_relationships !== false;
                                                                            
                                                                            return (
                                                                                <div
                                                                                    key={row.id}
                                                                                    className={`p-2 d-flex align-items-center ${isSelected ? 'bg-light' : ''}`}
                                                                                    style={{ cursor: 'pointer' }}
                                                                                    onClick={() => {
                                                                                        if (allowsMultiple) {
                                                                                            toggleRowSelection(fieldName, row.id);
                                                                                        } else {
                                                                                            // Pojedyncza relacja - zastąp aktualny wybór
                                                                                            handleFormChange(fieldName, row.id);
                                                                                            setOpenDropdowns(prev => ({ ...prev, [fieldName]: false }));
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {allowsMultiple ? (
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            className="form-check-input me-2"
                                                                                            checked={isSelected}
                                                                                            onChange={() => {}} // Obsługiwane przez onClick na div
                                                                                            readOnly
                                                                                        />
                                                                                    ) : (
                                                                                        <input
                                                                                            type="radio"
                                                                                            className="form-check-input me-2"
                                                                                            checked={isSelected}
                                                                                            onChange={() => {}} // Obsługiwane przez onClick na div
                                                                                            readOnly
                                                                                        />
                                                                                    )}
                                                                                    <span className="text-truncate">{displayText}</span>
                                                                                </div>
                                                                            );
                                                                        });
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {column.primary && (
                                                        <input 
                                                            type="hidden" 
                                                            value={Array.isArray(fieldValue) && fieldValue.length > 0 ? 'selected' : ''} 
                                                            required 
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* File fields */}
                                            {fieldType.includes('file') && (
                                                <div>
                                                    {/* Wyświetlanie wybranych plików */}
                                                    {fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0 && (
                                                        <div className="mb-3">
                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                <label className="form-label mb-0">Wybrane pliki ({fieldValue.length}):</label>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => handleFormChange(fieldName, [])}
                                                                >
                                                                    Usuń wszystkie
                                                                </button>
                                                            </div>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {fieldValue.map((file, index) => (
                                                                    <div key={index} className="d-flex align-items-center gap-2 border rounded p-2">
                                                                        {file.thumbnails?.small?.url ? (
                                                                            <img
                                                                                src={file.thumbnails.small.url}
                                                                                alt={file.name}
                                                                                style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
                                                                            />
                                                                        ) : (
                                                                            <div 
                                                                                className="d-flex align-items-center justify-content-center bg-light"
                                                                                style={{ width: 32, height: 32, borderRadius: 4 }}
                                                                            >
                                                                                📄
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-grow-1">
                                                                            <div className="fw-bold" style={{ fontSize: '0.875rem' }}>
                                                                                {file.visible_name || file.name}
                                                                            </div>
                                                                            {file.url && (
                                                                                <a 
                                                                                    href={file.url} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-decoration-none"
                                                                                    style={{ fontSize: '0.75rem' }}
                                                                                >
                                                                                    Pobierz
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-danger"
                                                                            onClick={() => {
                                                                                const newFiles = fieldValue.filter((_, i) => i !== index);
                                                                                handleFormChange(fieldName, newFiles);
                                                                            }}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Pole wyboru plików */}
                                                <input
                                                    type="file"
                                                    className="form-control"
                                                        multiple
                                                        onChange={(e) => handleFileChange(fieldName, e.target.files)}
                                                    required={column.primary}
                                                        disabled={uploadingFiles[fieldName]}
                                                    />
                                                    
                                                    {/* Wskaźnik ładowania */}
                                                    {uploadingFiles[fieldName] && (
                                                        <div className="mt-2 d-flex align-items-center">
                                                            <div className="spinner-border spinner-border-sm me-2" role="status">
                                                                <span className="visually-hidden">Przesyłanie...</span>
                                                            </div>
                                                            <span>Przesyłanie plików...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Long text fields */}
                                            {fieldType.includes('long_text') && (
                                                <textarea
                                                    className="form-control"
                                                    rows={3}
                                                    value={fieldValue}
                                                    onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                    required={column.primary}
                                                />
                                            )}
                                            
                                            {/* Read-only fields */}
                                            {column.read_only && (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formatCellValue(fieldValue)}
                                                    disabled
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                                Anuluj
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
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
