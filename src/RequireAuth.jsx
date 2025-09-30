import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

export default function RequireAuth() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Weryfikacja wyłącznie po stronie backendu (działa także dla HttpOnly)
    fetch("http://127.0.0.1:8000/auth/status", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated) {
          setAllowed(true);
        } else {
          const loginUrl = data?.login_url || "http://127.0.0.1:1000/login";
          if (typeof window !== "undefined") {
            window.location.href = loginUrl;
          }
        }
      })
      .catch(() => {
        const fallback = "http://127.0.0.1:1000/login";
        if (typeof window !== "undefined") {
          window.location.href = fallback;
        }
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!allowed) return null;
  return <Outlet />;
}


