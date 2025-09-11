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
        <Card className="TableTile" key={props.id}>
            <Card.Body>
                <Card.Title>
                    {props.name}
                </Card.Title>
                <Card.Footer>
                    <Button variant="primary" onClick={() => handleClick(props.id, props.name)}>Przejdź</Button>
                </Card.Footer>
            </Card.Body>
        </Card>
    );
}
export default TableTile