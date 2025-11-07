import React from 'react';
import { useNavigate } from 'react-router-dom';

function TableTile(props) {
    const navigate = useNavigate();

    const handleClick = (id, name) => {
        navigate(`/tabela-baserow/${id}/${name}`)
    }

    return (
        <div
            className="h-full cursor-pointer rounded border border-gray-200 bg-white shadow-sm transition-transform duration-100 ease-out hover:-translate-y-0.5 hover:shadow"
            role="button"
            onClick={() => handleClick(props.id, props.name)}
        >
            <div className="flex h-full flex-col p-4">
                <div className="truncate text-sm font-semibold" title={props.name}>
                    {props.name}
                </div>
                <div className="mt-auto flex justify-end">
                    <button
                        type="button"
                        className="inline-flex items-center rounded border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                        onClick={(e) => { e.stopPropagation(); handleClick(props.id, props.name); }}
                    >
                        Przejdź
                    </button>
                </div>
            </div>
        </div>
    );
}
export default TableTile