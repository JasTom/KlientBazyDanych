import Header from "./Header.jsx"
import Footer from "./Footer.jsx";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./RequireAuth.jsx";

import TableList from "./TableList.jsx";
import TableBaserow from "./TableBaserow.jsx";
import TableTile from "./TableTile.jsx";
import TableBaserowWrapper from "./TableBaserowWrapper.jsx";

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<TableList />} />
            <Route path="/tabela-baserow/:id/:name" element={<TableBaserowWrapper />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );

}

export default App
