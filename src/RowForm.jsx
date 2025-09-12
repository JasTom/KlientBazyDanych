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
                const response = await apiClient.patch(`/database/rows/table/${tableId}/${editingRow.id}/`, formData);
                onSuccess('updated', response.data);
            } else {
                // Dodawanie nowego wiersza
                const response = await apiClient.post(`/database/rows/table/${tableId}/`, formData);
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
                                            
                                            {/* Select fields */}
                                            {(fieldType.includes('single_select') || fieldType.includes('multiple_select')) && (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={fieldValue}
                                                    onChange={(e) => handleFormChange(fieldName, e.target.value)}
                                                    placeholder="Wprowadź wartość..."
                                                    required={column.primary}
                                                />
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
