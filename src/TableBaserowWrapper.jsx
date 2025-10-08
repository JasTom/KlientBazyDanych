import { useParams } from "react-router-dom";
import { useEffect } from 'react';
import TableBaserow from "./TableBaserow";

function TableBaserowWrapper() {
    const { id, name } = useParams();
    // Brak dodatkowego contextu — tok indeks ustawiamy w TableList/Header do localStorage
    useEffect(() => {
        // nic — pozostawiamy, aby nie nadpisywać mapowania
    }, [id]);
    return <TableBaserow tableId={id} tableName={name} />;
}
export default TableBaserowWrapper