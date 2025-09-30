import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client'; // Poprawne zaimportowanie createRoot
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'; // własne style powinny być po Bootstrapie, aby nadpisać jego reguły
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