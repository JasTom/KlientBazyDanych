import Header from "./Header.jsx"
import Footer from "./Footer.jsx";
import { Routes, Route } from "react-router-dom";

import TableList from "./TableList.jsx";
import TableBaserow from "./TableBaserow.jsx";
import TableTile from "./TableTile.jsx";
import TableBaserowWrapper from "./TableBaserowWrapper.jsx";

function App() {
  return (
    <div className="min-vh-100 d-flex flex-column">
    <Routes>
      <Route path="/" element={
        <>
          <Header />
          <TableList />
          <Footer />
        </>
      }>
      </Route>
      <Route path="/tabela-baserow/:id/:name" element={
        <>
          <Header />
          <TableBaserowWrapper />
          <Footer />
        </>
      } />
    </Routes>
    </div>
  );

}

export default App
