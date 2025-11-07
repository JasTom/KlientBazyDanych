import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient, { BACKEND_BASE_URL } from "./apiClient";
import TableTile from "./TableTile";
import { fetchUserPermissionsByTable, hasAnyViewPermission } from "./permissionsApi";
import axios from 'axios';

function TableList() {

    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // grid | list
    const [dbNames, setDbNames] = useState({}); // { [database_id]: string }
    const [tokenByTable, setTokenByTable] = useState(new Map()); // Map<tableId, tokenIndex>

    useEffect(() => {
        const fetchTables = async () => {
            try {
                // Równolegle: listy tabel i uprawnienia użytkownika
                const [tablesResp, permsMap] = await Promise.all([
                    apiClient.get("/database/tables/all-tables/"),
                    fetchUserPermissionsByTable()
                ]);

                const allTables = (tablesResp.data || []).map((t) => ({ ...t }));
                // Filtr: pokazuj tylko te tabele, dla których użytkownik ma co najmniej Podgląd
                const allowed = allTables.filter(t => {
                    const set = permsMap.get(Number(t.id)) || permsMap.get(Number(t.table_id));
                    return hasAnyViewPermission(set);
                });
                // Zbuduj mapę tableId -> token index
                const map = new Map();
                allowed.forEach(t => {
                    const tid = Number(t.id || t.table_id);
                    if (Number.isFinite(tid)) {
                        const idx = Number.isFinite(Number(t._token_index)) ? Number(t._token_index) : 0;
                        map.set(tid, idx);
                    }
                });
                setTokenByTable(map);
                // Persistuj mapowanie do localStorage, aby inne widoki mogły używać właściwego tokenu
                try {
                    // wyczyść stare wpisy
                    Object.keys(localStorage).forEach((k) => { if (k.startsWith('tok_')) localStorage.removeItem(k); });
                } catch (_) {}
                try {
                    map.forEach((idx, tid) => {
                        localStorage.setItem(`tok_${tid}`, String(idx));
                    });
                } catch (_) {}
                setTables(allowed);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTables();
    }, []);

    // Po załadowaniu listy tabel pobierz nazwy baz przez backend JWT
    useEffect(() => {
        const loadDbNames = async () => {
            if (!tables || tables.length === 0) return;
            try {
                const uniqueIds = Array.from(new Set(tables.map(t => t.database_id).filter(Boolean)));
                if (uniqueIds.length === 0) return;

                const requests = uniqueIds.map(id =>
                    axios.get(`${BACKEND_BASE_URL}/jwt/applications/${id}`)
                        .then(res => ({ id, name: res?.data?.name })).catch(() => ({ id, name: null }))
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

    // Prosta paleta i emoji per baza (deterministycznie po ID) — Tailwind
    const palette = [
        { bg: "bg-blue-600 text-white", emoji: "📘" },
        { bg: "bg-green-600 text-white", emoji: "📗" },
        { bg: "bg-yellow-500 text-black", emoji: "📒" },
        { bg: "bg-cyan-500 text-white", emoji: "📙" },
        { bg: "bg-gray-600 text-white", emoji: "📕" },
        { bg: "bg-red-600 text-white", emoji: "📓" }
    ];
    const getDbMeta = (dbId) => {
        const idx = Math.abs(String(dbId).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % palette.length;
        return palette[idx];
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-3" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h1 className="m-0 text-xl font-semibold">Lista tabel</h1>
                <div className="flex w-full gap-2 md:w-auto">
                    <input
                        type="text"
                        className="w-full max-w-[360px] rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="Szukaj tabeli..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="inline-flex overflow-hidden rounded border border-blue-600">
                        <button
                            type="button"
                            className={`${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-blue-600"} px-3 py-2 text-sm`}
                            onClick={() => setViewMode("grid")}
                            title="Widok siatki"
                        >
                            ▦
                        </button>
                        <button
                            type="button"
                            className={`${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-blue-600"} border-l border-blue-600 px-3 py-2 text-sm`}
                            onClick={() => setViewMode("list")}
                            title="Widok listy"
                        >
                            ≣
                        </button>
                    </div>
                </div>
            </div>

            {grouped.length === 0 && (
                <div className="text-gray-500">Brak wyników.</div>
            )}

            {grouped.map(([databaseId, tablesForDb]) => (
                <section key={databaseId} className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getDbMeta(databaseId).bg}`}>
                                {getDbMeta(databaseId).emoji}
                            </span>
                            <h2 className="m-0 text-sm font-semibold">Baza: {dbNames[databaseId] || `ID ${databaseId}`}</h2>
                        </div>
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{tablesForDb.length}</span>
                    </div>
                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {tablesForDb.map(table => (
                                <div key={table.id}>
                                    <TableTile name={table.name} id={table.id} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="divide-y overflow-hidden rounded border">
                            {tablesForDb.map(table => (
                                <button
                                    key={table.id}
                                    type="button"
                                    className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                                    onClick={() => navigate(`/tabela-baserow/${table.id}/${table.name}`)}
                                    title={table.name}
                                >
                                    <span className="max-w-[80%] truncate">{table.name}</span>
                                    <span className="inline-flex items-center rounded bg-gray-600 px-2 py-0.5 text-xs text-white">ID {table.id}</span>
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