import React, { useState, useEffect } from 'react';
import apiClient from './apiClient';

const TableBaserow = ({ tableId, tableName }) => {
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
        <div className="container my-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h1 className="h4 mb-0">Edytowalna tabela (ID: {tableName})</h1>
                <button className="btn btn-primary" onClick={saveChanges}>Zapisz zmiany</button>
            </div>
            <div className="table-responsive">
                <table className="table table-striped table-bordered table-hover table-sm align-middle">
                    <thead className="table-dark">
                        <tr>
                            {columns.map(column => (
                                <th key={column.id} scope="col">{column.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id}>
                                {columns.map(column => (
                                    <td key={column.id}>
                                        {column.read_only ? (
                                            <span>{String(row[column.name]?.value || row[column.name] || "")}</span>
                                        ) : (
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={String(row[column.name]?.value || row[column.name] || "")}
                                                onChange={(e) => handleCellChange(row.id, column.name, e.target.value)}
                                            />
                                        )}
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
