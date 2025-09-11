import React, { useEffect, useState } from "react";
import axios from "axios";
import TableTile from "./TableTile";

function TableList() {

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const response = await axios({
                    method: "GET",
                    url: "https://api.baserow.io/api/database/tables/all-tables/",
                    // url: "http://baza.ace.local:10220/api/database/tables/all-tables/",
                    headers: {
                        Authorization: "Token Ldhe8HXyypxOR4zoGMrvTKj0EZ3dr7iC" // klucz baserow.io
                        // Authorization: "Token 9gEyWijcJY2kdmAtVt8iOI6Jhy36QQ4h" // Klucz procedury 
                        // Authorization: "Token oU6JGixHrXy5pW6kyDNrL12FQWWop6DF" // Klucz menadżer
                    }
                });
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