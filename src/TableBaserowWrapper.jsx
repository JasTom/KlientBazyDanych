import { useParams } from "react-router-dom";
import TableBaserow from "./TableBaserow";

function TableBaserowWrapper() {
    const { id, name } = useParams();
    return <TableBaserow tableId={id} tableName={name} />;
}
export default TableBaserowWrapper