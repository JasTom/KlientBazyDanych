import zdrochem_logo from './assets/zdrochem_logo.jpg'
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import { Link } from 'react-router-dom';
import { fetchUserPermissionsByTable, hasAnyViewPermission } from './permissionsApi';
import axios from 'axios';
import { getStoredJWT, loginAndStoreJWT } from './jwtAuth.js';

import React, { useEffect, useState } from "react";
import apiClient from "./apiClient";

function Header() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dbNames, setDbNames] = useState({}); // { [database_id]: name }

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

    // Po załadowaniu listy tabel pobierz nazwy baz (applications) po JWT
    useEffect(() => {
        const loadDbNames = async () => {
            if (!tables || tables.length === 0) return;
            try {
                // unikalne database_id
                const ids = Array.from(new Set(tables.map(t => t.database_id).filter(Boolean)));
                if (ids.length === 0) return;

                let token = getStoredJWT();
                if (!token) {
                    token = await loginAndStoreJWT();
                }
                if (!token) return;

                const requests = ids.map(id =>
                    axios.get(`https://api.baserow.io/api/applications/${id}/`, {
                        headers: { Authorization: `JWT ${token}` }
                    }).then(res => ({ id, name: res?.data?.name })).catch(() => ({ id, name: null }))
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

        <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm">
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
                    <img src={zdrochem_logo} alt="logo" width={28} height={28} style={{ objectFit: 'cover', borderRadius: 4 }} />
                    <span>Moje Tabele</span>
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="main-nav" />
                <Navbar.Collapse id="main-nav">
                    <Nav className="me-auto" variant="tabs">
                        {Object.entries(
                            tables.reduce((acc, t) => {
                                const dbId = t.database_id || 'unknown';
                                if (!acc[dbId]) acc[dbId] = [];
                                acc[dbId].push(t);
                                return acc;
                            }, {})
                        ).map(([dbId, group]) => (
                            <NavDropdown key={dbId} title={(dbNames[dbId] || `Baza ${dbId}`)} id={`db-${dbId}`}>
                                {group.map((t) => (
                                    <NavDropdown.Item key={t.id} as={Link} to={`/tabela-baserow/${t.id}/${encodeURIComponent(t.name)}`}>
                                        {t.name}
                                    </NavDropdown.Item>
                                ))}
                            </NavDropdown>
                        ))}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default Header