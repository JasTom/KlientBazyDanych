import zdrochem_logo from './assets/zdrochem_logo.jpg'
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import { Link } from 'react-router-dom';
import { fetchUserPermissionsByTable, hasAnyViewPermission } from './permissionsApi';
import axios from 'axios';

import React, { useEffect, useState } from "react";
import apiClient from "./apiClient";

function Header() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dbNames, setDbNames] = useState({}); // { [database_id]: name }
    const [tablesFilter, setTablesFilter] = useState('');

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const [tablesResp, permsMap] = await Promise.all([
                    apiClient.get("/database/tables/all-tables/"),
                    fetchUserPermissionsByTable()
                ]);
                const all = tablesResp.data || [];
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

    // Po załadowaniu listy tabel pobierz nazwy baz (applications) przez backend JWT
    useEffect(() => {
        const loadDbNames = async () => {
            if (!tables || tables.length === 0) return;
            try {
                // unikalne database_id
                const ids = Array.from(new Set(tables.map(t => t.database_id).filter(Boolean)));
                if (ids.length === 0) return;

                const requests = ids.map(id =>
                    axios.get(`http://127.0.0.1:8000/jwt/applications/${id}`)
                        .then(res => ({ id, name: res?.data?.name }))
                        .catch(() => ({ id, name: null }))
                );
                const results = await Promise.all(requests);
                const nameMap = {};
                results.forEach(({ id, name }) => { if (id) nameMap[id] = name || null; });
                setDbNames(prev => ({ ...prev, ...nameMap }));
            } catch (_) {
                // pomiń błędy nazw
            }
        };
        loadDbNames();
    }, [tables]);
    if (loading) return <div>Ładowanie...</div>;
    if (error) return <div>Błąd: {error}</div>;

    return (

        <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm w-100">
            <Container fluid className="px-3">
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
                    <img
                        src={zdrochem_logo}
                        alt="logo"
                        className="d-inline-block align-top"
                        style={{ height: 32, width: 'auto', objectFit: 'contain', borderRadius: '5%' }}
                    />
                    <span>🏠 Moje Tabele</span>
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="main-nav" />
                <Navbar.Collapse id="main-nav">
                    <Nav className="me-auto" variant="tabs">
                        {/* Zbiorcza lista wszystkich baz i tabel */}
                        <NavDropdown title="Lista tabel" id="all-dbs-and-tables">
                            {/* Pole wyszukiwania */}
                            <div className="p-2 border-bottom bg-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Szukaj bazy lub tabeli..."
                                    value={tablesFilter}
                                    onChange={(e) => setTablesFilter(e.target.value)}
                                />
                            </div>

                            <div style={{ maxHeight: '60vh', overflowY: 'auto', minWidth: 280 }}>
                                {Object.entries(
                                    tables.reduce((acc, t) => {
                                        const dbId = t.database_id || 'unknown';
                                        if (!acc[dbId]) acc[dbId] = [];
                                        acc[dbId].push(t);
                                        return acc;
                                    }, {})
                                ).map(([dbId, group], idx, arr) => {
                                    const q = tablesFilter.trim().toLowerCase();
                                    const dbName = (dbNames[dbId] || `Baza ${dbId}`).toLowerCase();
                                    const filteredGroup = q
                                        ? group.filter((t) => String(t.name || '').toLowerCase().includes(q))
                                        : group;
                                    const showDb = q ? (dbName.includes(q) || filteredGroup.length > 0) : true;
                                    if (!showDb) return null;
                                    return (
                                        <div key={`all-${dbId}`}>
                                            <NavDropdown.Header>
                                                {dbNames[dbId] || `Baza ${dbId}`}
                                            </NavDropdown.Header>
                                            {(filteredGroup.length > 0 ? filteredGroup : group).map((t) => (
                                                <NavDropdown.Item key={`all-${dbId}-${t.id}`} as={Link} to={`/tabela-baserow/${t.id}/${encodeURIComponent(t.name)}`}>
                                                    {t.name}
                                                </NavDropdown.Item>
                                            ))}
                                            {idx < arr.length - 1 && <NavDropdown.Divider />}
                                        </div>
                                    );
                                })}
                            </div>
                        </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default Header