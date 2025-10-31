import zdrochem_logo from './assets/zdrochem_logo.jpg'
import { Link } from 'react-router-dom';
import { fetchUserPermissionsByTable, hasAnyViewPermission } from './permissionsApi';
import axios from 'axios';

import React, { useEffect, useMemo, useState } from "react";
import apiClient, { BACKEND_BASE_URL } from "./apiClient";

function Header() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dbNames, setDbNames] = useState({});
    const [tablesFilter, setTablesFilter] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const [tablesResp, permsMap] = await Promise.all([
                    apiClient.get("/database/tables/all-tables/"),
                    fetchUserPermissionsByTable()
                ]);
                const all = (tablesResp.data || []).map(t => ({ ...t }));
                const allowed = all.filter(t => {
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

    useEffect(() => {
        const loadDbNames = async () => {
            if (!tables || tables.length === 0) return;
            try {
                const ids = Array.from(new Set(tables.map(t => t.database_id).filter(Boolean)));
                if (ids.length === 0) return;
                const requests = ids.map(id =>
                    axios.get(`${BACKEND_BASE_URL}/jwt/applications/${id}`)
                        .then(res => ({ id, name: res?.data?.name }))
                        .catch(() => ({ id, name: null }))
                );
                const results = await Promise.all(requests);
                const nameMap = {};
                results.forEach(({ id, name }) => { if (id) nameMap[id] = name || null; });
                setDbNames(prev => ({ ...prev, ...nameMap }));
            } catch (_) {}
        };
        loadDbNames();
    }, [tables]);

    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const resp = await fetch(`${BACKEND_BASE_URL}/auth/me`, { credentials: "include" });
                const data = await resp.json();
                setCurrentUser(data?.authenticated ? data : null);
            } catch (_e) {
                setCurrentUser(null);
            }
        };
        loadCurrentUser();
    }, []);

    const groupedTables = useMemo(() => {
        return tables.reduce((acc, t) => {
            const dbId = t.database_id || 'unknown';
            if (!acc[dbId]) acc[dbId] = [];
            acc[dbId].push(t);
            return acc;
        }, {});
    }, [tables]);

    return (
        <nav className="w-full bg-gray-900 text-white shadow-sm">
            <div className="max-w-screen-2xl mx-auto px-4">
                <div className="flex items-center justify-between h-14">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={zdrochem_logo} alt="logo" className="h-8 w-auto rounded-sm object-contain" />
                        <span className="font-semibold">🏠 Moje Tabele</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-sm"
                                onClick={() => setDropdownOpen(v => !v)}
                            >
                                Lista tabel
                                <svg className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-80 max-h-[60vh] overflow-y-auto rounded-md border border-gray-700 bg-white text-gray-900 shadow-lg z-50">
                                    <div className="sticky top-0 bg-gray-50 p-2 border-b border-gray-200">
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="Szukaj bazy lub tabeli..."
                                            value={tablesFilter}
                                            onChange={(e) => setTablesFilter(e.target.value)}
                                        />
                                    </div>
                                    <div className="p-2">
                                        {Object.entries(groupedTables).map(([dbId, group], idx, arr) => {
                                            const q = tablesFilter.trim().toLowerCase();
                                            const dbName = (dbNames[dbId] || `Baza ${dbId}`).toLowerCase();
                                            const filteredGroup = q ? group.filter((t) => String(t.name || '').toLowerCase().includes(q)) : group;
                                            const showDb = q ? (dbName.includes(q) || filteredGroup.length > 0) : true;
                                            if (!showDb) return null;
                                            return (
                                                <div key={`all-${dbId}`} className="mb-2">
                                                    <div className="px-2 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                                        {dbNames[dbId] || `Baza ${dbId}`}
                                                    </div>
                                                    {(filteredGroup.length > 0 ? filteredGroup : group).map((t) => (
                                                        <Link
                                                            key={`all-${dbId}-${t.id}`}
                                                            to={`/tabela-baserow/${t.id}/${encodeURIComponent(t.name)}`}
                                                            className="block px-3 py-1.5 text-sm rounded hover:bg-gray-100"
                                                            onClick={() => setDropdownOpen(false)}
                                                        >
                                                            {t.name}
                                                        </Link>
                                                    ))}
                                                    {idx < arr.length - 1 && <div className="my-2 border-t border-gray-200" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {currentUser ? (
                            <div className="flex items-center gap-3">
                                <div className="text-sm hidden sm:block">
                                    <span className="opacity-80">Zalogowany:</span>{' '}
                                    <span title={[
                                        currentUser.username && `Użytkownik: ${currentUser.username}`,
                                        currentUser.email && `E-mail: ${currentUser.email}`,
                                        currentUser.role && `Rola: ${currentUser.role}`,
                                        currentUser.id && `ID: ${currentUser.id}`,
                                        currentUser.exp && `Wygasa: ${new Date(currentUser.exp * 1000).toLocaleString()}`,
                                    ].filter(Boolean).join('\n')} className="font-semibold cursor-help">
                                        {currentUser.username}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-sm rounded-md border border-white/30 hover:bg-white/10"
                                    onClick={async () => {
                                        try {
                                            await fetch(`${BACKEND_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
                                        } catch (_) {}
                                        if (typeof window !== 'undefined') window.location.reload();
                                    }}
                                >
                                    Wyloguj
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm opacity-80">Nieznany użytkownik</div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Header