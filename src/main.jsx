import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client'; // Poprawne zaimportowanie createRoot
import './index.css'; // jeśli masz własne style
import 'bootstrap/dist/css/bootstrap.min.css' // ← tu dodaj import Bootstrapa
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

// Znajdź element root
const rootElement = document.getElementById('root');

// Utwórz root i wyrenderuj aplikację
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);