import zdrochem_logo from './assets/zdrochem_logo.jpg'
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import { Link } from 'react-router-dom';
import { fetchUserPermissionsByTable, hasAnyViewPermission } from './permissionsApi';

import React, { useEffect, useState } from "react";
import apiClient from "./apiClient";

function Header() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                            <NavDropdown key={dbId} title={`Baza ${dbId}`} id={`db-${dbId}`}>
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