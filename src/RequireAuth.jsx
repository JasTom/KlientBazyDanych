import { useEffect, useState } from "react";
import { BACKEND_BASE_URL } from "./apiClient";
import { Outlet } from "react-router-dom";

export default function RequireAuth() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Weryfikacja wyłącznie po stronie backendu (działa także dla HttpOnly)
    fetch(`${BACKEND_BASE_URL}/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        // Tymczasowe logi diagnostyczne
        try {
          console.log("[auth/status] response:", data);
          // Próba wyświetlenia ciasteczek (jeśli JWT jest HttpOnly, nie będzie widoczny w document.cookie)
          console.log("[cookies] document.cookie=", typeof document !== "undefined" ? document.cookie : undefined);
          if (data && data.cookie_name) {
            console.log("[auth] expected cookie name:", data.cookie_name);
          }
        } catch (_) {}
        if (data?.authenticated) {
          setAllowed(true);
        } else {
          // Tymczasowo zablokowane przekierowanie dla debugowania
          // Zostawiamy allowed=false, aby nie wpuszczać dalej, ale nie przekierowujemy
        }
      })
      .catch((err) => {
        // Tymczasowo bez przekierowania, tylko log błędu
        try { console.error("[auth/status] error:", err); } catch (_) {}
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!allowed) return null;
  return <Outlet />;
}


