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
          // Brak sesji -> przekieruj na stronę logowania wskazaną przez backend
          try {
            const target = (data && data.login_url) ? String(data.login_url) : `${window.location.origin}/login`;
            window.location.href = target;
          } catch (_) {
            try { window.location.href = `${window.location.origin}/login`; } catch { /* no-op */ }
          }
        }
      })
      .catch((err) => {
        // W razie błędu sieci spróbuj przekierować na /login
        try { console.error("[auth/status] error:", err); } catch (_) {}
        try { window.location.href = `${window.location.origin}/login`; } catch { /* no-op */ }
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!allowed) return null;
  return <Outlet />;
}


