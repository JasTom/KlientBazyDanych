import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from 'react-bootstrap'

function TableTile(props) {
    const navigate = useNavigate();

    const handleClick = (id, name) => {
        console.log(` click me`)
        navigate(`/tabela-baserow/${id}/${name}`)
    }

    return (
        <Card 
            className="shadow-sm h-100 border-0" 
            role="button"
            onClick={() => handleClick(props.id, props.name)}
            style={{ transition: 'transform .08s ease, box-shadow .08s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.classList.add('shadow'); }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.classList.remove('shadow'); }}
        >
            <Card.Body className="d-flex flex-column">

                <Card.Title className="fs-6 text-truncate" title={props.name}>
                    {props.name}
                </Card.Title>
                <div className="mt-auto d-flex justify-content-end">
                    <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleClick(props.id, props.name); }}
                    >
                        Przejdź
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}
export default TableTile