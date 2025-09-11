import React, { useEffect, useState } from "react";
import apiClient from "./apiClient";
import TableTile from "./TableTile";

function TableList() {

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const response = await apiClient.get("/database/tables/all-tables/");
                setTables(response.data);
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
        <div>
            <h1>Lista tabel w bazie danych</h1>
            {Object.entries(
                tables.reduce((acc, table) => {
                    if (!acc[table.database_id]) {
                        acc[table.database_id] = [];
                    }
                    acc[table.database_id].push(table);
                    return acc;
                }, {})
            ).map(([databaseId, tablesForDb]) => (
                <div key={databaseId} className="TableTileContainer ">
                    {tablesForDb.map(table => (
                        <TableTile name={table.name} key={table.id} id={table.id} />
                    ))}
                </div>
            ))}
        </div>
    );
}
export default TableList