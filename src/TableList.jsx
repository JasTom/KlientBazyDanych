import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "./apiClient";
import TableTile from "./TableTile";
import { fetchUserPermissionsByTable, hasAnyViewPermission } from "./permissionsApi";
import axios from 'axios';
import { getStoredJWT, loginAndStoreJWT } from './jwtAuth.js';

function TableList() {

    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // grid | list
    const [dbNames, setDbNames] = useState({}); // { [database_id]: string }

    useEffect(() => {
        const fetchTables = async () => {
            try {
                // Równolegle: listy tabel i uprawnienia użytkownika
                const [tablesResp, permsMap] = await Promise.all([
                    apiClient.get("/database/tables/all-tables/"),
                    fetchUserPermissionsByTable()
                ]);

                const allTables = tablesResp.data || [];
                // Filtr: pokazuj tylko te tabele, dla których użytkownik ma co najmniej Podgląd
                const allowed = allTables.filter(t => {
                    const set = permsMap.get(Number(t.id)) || permsMap.get(Number(t.table_id));
                    return hasAnyViewPermission(set);
                });
                setTables(allowed);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTables();
    }, []);

    // Po załadowaniu listy tabel pobierz nazwy baz z API JWT
    useEffect(() => {
        const loadDbNames = async () => {
            if (!tables || tables.length === 0) return;
            try {
                const uniqueIds = Array.from(new Set(tables.map(t => t.database_id).filter(Boolean)));
                if (uniqueIds.length === 0) return;

                let token = getStoredJWT();
                if (!token) {
                    token = await loginAndStoreJWT();
                }
                if (!token) return;

                const requests = uniqueIds.map(id =>
                    axios.get(`https://api.baserow.io/api/applications/${id}/`, {
                        headers: { Authorization: `JWT ${token}` }
                    }).then(res => ({ id, name: res?.data?.name })).catch(() => ({ id, name: null }))
                );
                const results = await Promise.all(requests);
                const map = {};
                results.forEach(({ id, name }) => { if (id) map[id] = name || null; });
                setDbNames(prev => ({ ...prev, ...map }));
            } catch (_) {
                // pomiń błędy
            }
        };
        loadDbNames();
    }, [tables]);
    if (loading) return <div>Ładowanie...</div>;
    if (error) return <div>Błąd: {error}</div>;



    // Filtrowanie tabel po nazwie
    const filteredTables = tables.filter(t => (t?.name || "").toLowerCase().includes(query.toLowerCase()));

    // Grupowanie po bazie
    const grouped = Object.entries(
        filteredTables.reduce((acc, table) => {
            const key = table.database_id || "unknown";
            if (!acc[key]) acc[key] = [];
            acc[key].push(table);
            return acc;
        }, {})
    );

    // Prosta paleta i emoji per baza (deterministycznie po ID)
    const palette = [
        { bg: "text-bg-primary", emoji: "📘" },
        { bg: "text-bg-success", emoji: "📗" },
        { bg: "text-bg-warning", emoji: "📒" },
        { bg: "text-bg-info", emoji: "📙" },
        { bg: "text-bg-secondary", emoji: "📕" },
        { bg: "text-bg-danger", emoji: "📓" }
    ];
    const getDbMeta = (dbId) => {
        const idx = Math.abs(String(dbId).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % palette.length;
        return palette[idx];
    };

    return (
        <div className="container py-3">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
                <h1 className="h4 m-0">Lista tabel</h1>
                <div className="d-flex w-100 w-md-auto gap-2">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Szukaj tabeli..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ maxWidth: 360 }}
                    />
                    <div className="btn-group" role="group" aria-label="Widok">
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => setViewMode("grid")}
                            title="Widok siatki"
                        >
                            ▦
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => setViewMode("list")}
                            title="Widok listy"
                        >
                            ≣
                        </button>
                    </div>
                </div>
            </div>

            {grouped.length === 0 && (
                <div className="text-muted">Brak wyników.</div>
            )}

            {grouped.map(([databaseId, tablesForDb]) => (
                <section key={databaseId} className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                            <span className={`badge ${getDbMeta(databaseId).bg}`} style={{ fontSize: ".9rem" }}>
                                {getDbMeta(databaseId).emoji}
                            </span>
                            <h2 className="h6 m-0">Baza: {dbNames[databaseId] || `ID ${databaseId}`}</h2>
                        </div>
                        <span className="badge text-bg-light">{tablesForDb.length}</span>
                    </div>
                    {viewMode === "grid" ? (
                        <div className="row g-3">
                            {tablesForDb.map(table => (
                                <div key={table.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                    <TableTile name={table.name} id={table.id} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="list-group">
                            {tablesForDb.map(table => (
                                <button
                                    key={table.id}
                                    type="button"
                                    className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                                    onClick={() => navigate(`/tabela-baserow/${table.id}/${table.name}`)}
                                    title={table.name}
                                >
                                    <span className="text-truncate" style={{ maxWidth: "80%" }}>{table.name}</span>
                                    <span className="badge text-bg-secondary">ID {table.id}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
export default TableList