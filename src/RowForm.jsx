import React, { useState } from 'react';
import apiClient from './apiClient';

const RowForm = ({ tableId, columns, editingRow, onClose, onSuccess }) => {
    const [formData, setFormData] = useState(editingRow ? { ...editingRow } : {});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            if (editingRow) {
                // Edycja istniejącego wiersza
                const response = await apiClient.patch(`/database/rows/table/${tableId}/${editingRow.id}/?user_field_names=true`, formData);
                onSuccess('updated', response.data);
            } else {
                // Dodawanie nowego wiersza
                const response = await apiClient.post(`/database/rows/table/${tableId}/?user_field_names=true`, formData);
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
                                                <div className="border rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    {column.select_options && column.select_options.map(option => {
                                                        const isSelected = Array.isArray(fieldValue) && 
                                                            fieldValue.some(item => 
                                                                (typeof item === 'object' && item.id === option.id) || 
                                                                item === option.id
                                                            );
                                                        return (
                                                            <div key={option.id} className="form-check">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    id={`${fieldName}_${option.id}`}
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        const currentValues = Array.isArray(fieldValue) ? fieldValue : [];
                                                                        let newValues;
                                                                        
                                                                        if (e.target.checked) {
                                                                            // Dodaj ID opcji
                                                                            newValues = [...currentValues, option.id];
                                                                        } else {
                                                                            // Usuń ID opcji
                                                                            newValues = currentValues.filter(item => 
                                                                                (typeof item === 'object' && item.id !== option.id) || 
                                                                                item !== option.id
                                                                            );
                                                                        }
                                                                        handleFormChange(fieldName, newValues);
                                                                    }}
                                                                />
                                                                <label 
                                                                    className="form-check-label" 
                                                                    htmlFor={`${fieldName}_${option.id}`}
                                                                    style={{ 
                                                                        color: option.color === 'light-gray' ? '#6c757d' : 
                                                                               option.color === 'light-pink' ? '#e83e8c' : 
                                                                               option.color === 'brown' ? '#8b4513' : 
                                                                               option.color === 'darker-cyan' ? '#20c997' : 
                                                                               option.color === 'light-green' ? '#28a745' : 'inherit'
                                                                    }}
                                                                >
                                                                    {option.value}
                                                                </label>
                                                            </div>
                                                        );
                                                    })}
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
                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    onChange={(e) => handleFormChange(fieldName, e.target.files[0])}
                                                    required={column.primary}
                                                />
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
