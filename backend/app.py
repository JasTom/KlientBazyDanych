import os
import asyncio
import time
from typing import Dict

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from dotenv import load_dotenv

app = FastAPI(title="Baserow Proxy", version="0.1.0")

# CORS: gdy allow_credentials=True, nie można używać "*" jako origin.
# Skonfiguruj dozwolone originy przez ENV (np. FRONTEND_ORIGINS=http://127.0.0.1:5173,http://localhost:5173)
frontend_origins = os.getenv("FRONTEND_ORIGINS", "http://127.0.0.1:5173").split(",")
frontend_origins = [o.strip() for o in frontend_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Wczytaj .env jeśli istnieje
load_dotenv()

# Konfiguracja z ENV (nie logujemy sekretów)
BASEROW_BASE_URL = os.getenv("BASEROW_BASE_URL", "https://api.baserow.io/api")
# Obsługa wielu tokenów: BASEROW_AUTH_TOKENS (lista rozdzielona przecinkami) lub BASEROW_AUTH_TOKEN (pojedynczy)
_raw_tokens = os.getenv("BASEROW_AUTH_TOKENS") or os.getenv("BASEROW_AUTH_TOKEN", "").strip()
if _raw_tokens:
    BASEROW_AUTH_TOKENS = [t.strip() for t in _raw_tokens.split(",") if t.strip()]
else:
    BASEROW_AUTH_TOKENS = []
BASEROW_AUTH_TOKENS = BASEROW_AUTH_TOKENS or ["Token Ldhe8HXyypxOR4zoGMrvTKj0EZ3dr7iC"]
BASEROW_JWT_EMAIL = os.getenv("BASEROW_JWT_EMAIL", "tomaszjastrzebski1996@gmail.com").strip()
BASEROW_JWT_PASSWORD = os.getenv("BASEROW_JWT_PASSWORD", "Q9JpX!AsSve2ifT").strip()
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "jwt").strip()
LOGIN_URL = os.getenv("LOGIN_URL", "http://127.0.0.1:1000/login").strip()
USER_VALIDATE_URL = os.getenv("USER_VALIDATE_URL", "http://127.0.0.1:1000/api/ext/validate").strip()
USER_VALIDATE_AUTH = os.getenv("USER_VALIDATE_AUTH", "Bearer yOuydvv90vibllGO-lCmQy-sK00eW0TSHGMoD_4P0Cs").strip()


def _normalize_token(token_value: str) -> str:
    if token_value and not token_value.lower().startswith("token ") and not token_value.lower().startswith("jwt "):
        return f"Token {token_value}"
    return token_value


def _get_token_header_value(index: int | None = None) -> str:
    try:
        if index is None:
            token_value = BASEROW_AUTH_TOKENS[0]
        else:
            token_value = BASEROW_AUTH_TOKENS[int(index)]
    except (IndexError, ValueError):
        token_value = BASEROW_AUTH_TOKENS[0]
    return _normalize_token(token_value)


def _filter_response_headers(headers: Dict[str, str]) -> Dict[str, str]:
    # Usuń nagłówki hop-by-hop i te, które Starlette ustawi sama
    excluded = {
        "content-encoding",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "upgrade",
    }
    return {k: v for k, v in headers.items() if k.lower() not in excluded}


async def _proxy_request_with_token(request: Request, full_path: str) -> Response:
    method = request.method.upper()
    url = f"{BASEROW_BASE_URL.rstrip('/')}/{full_path}"
    query_string = request.url.query
    if query_string:
        url = f"{url}?{query_string}"

    # Odczytaj żądany indeks tokenu z nagłówka (opcjonalnie)
    requested_index_header = request.headers.get("X-Baserow-Token-Index", "").strip()
    token_index: int | None = None
    if requested_index_header != "":
        try:
            token_index = int(requested_index_header)
        except ValueError:
            token_index = None

    # Skopiuj tylko bezpieczne nagłówki z pominięciem Authorization itp.
    safe_request_headers = {"content-type", "accept"}
    forward_headers_base: Dict[str, str] = {}
    for k, v in request.headers.items():
        lk = k.lower()
        if lk in {"authorization", "host", "content-length", "connection", "accept-encoding", "origin", "referer", "x-baserow-token-index"}:
            continue
        if lk in safe_request_headers:
            forward_headers_base[k] = v

    # Agregacja dla all-tables jeśli nie wskazano konkretnego tokenu
    if method == "GET" and full_path.rstrip("/") == "database/tables/all-tables" and token_index is None:
        async with httpx.AsyncClient(follow_redirects=True, timeout=None) as client:
            tasks = []
            urls = []
            for idx, _ in enumerate(BASEROW_AUTH_TOKENS):
                h = dict(forward_headers_base)
                h["Authorization"] = _get_token_header_value(idx)
                tasks.append(client.get(url, headers=h))
                urls.append(url)
            try:
                responses = await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Upstream error during aggregation: {str(e)}")

        aggregated: list = []
        for idx, resp in enumerate(responses):
            if isinstance(resp, Exception):
                # Pomijaj błędne odpowiedzi pojedynczych workspaces
                continue
            # Proste logi diagnostyczne (dev)
            try:
                print(f"[proxy] GET {urls[idx]} (token_index={idx}) -> {resp.status_code}")
            except Exception:
                pass
            if resp.status_code >= 400:
                continue
            try:
                data = resp.json()
            except Exception:
                continue
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        item = dict(item)
                        item.setdefault("_token_index", idx)
                        aggregated.append(item)
            elif isinstance(data, dict) and isinstance(data.get("results"), list):
                for item in data["results"]:
                    if isinstance(item, dict):
                        row = dict(item)
                        row.setdefault("_token_index", idx)
                        aggregated.append(row)

        from starlette.responses import JSONResponse
        return JSONResponse(aggregated)

    # Zwykłe proxowanie z wybranym lub domyślnym tokenem
    token_header = _get_token_header_value(token_index)
    if not token_header:
        raise HTTPException(status_code=500, detail="Brak BASEROW_AUTH_TOKEN(S) w konfiguracji")

    forward_headers = dict(forward_headers_base)
    forward_headers["Authorization"] = token_header

    body = await request.body()

    async with httpx.AsyncClient(follow_redirects=True, timeout=None) as client:
        try:
            resp = await client.request(method, url, content=body, headers=forward_headers)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Upstream error: {str(e)}")

    # Proste logi diagnostyczne (dev)
    print(f"[proxy] {method} {url} -> {resp.status_code}")
    if resp.status_code >= 400:
        try:
            print(f"[proxy] upstream body: {resp.text[:500]}")
        except Exception:
            pass

    headers = _filter_response_headers(dict(resp.headers))
    return StreamingResponse(resp.aiter_bytes(), status_code=resp.status_code, headers=headers)


@app.api_route("/token/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def token_proxy(full_path: str, request: Request):
    return await _proxy_request_with_token(request, full_path)


@app.get("/auth/status")
async def auth_status(request: Request):
    # Sprawdzanie obecności ciasteczka po stronie serwera (działa też dla HttpOnly)
    jwt_cookie = request.cookies.get(AUTH_COOKIE_NAME, "").strip()
    return {
        "authenticated": bool(jwt_cookie),
        "login_url": LOGIN_URL,
        "cookie_name": AUTH_COOKIE_NAME,
    }


_jwt_cache = {"token": None, "ts": 0.0}


async def _get_jwt_token() -> str:
    # Prosty cache w pamięci (5 minut)
    token_ttl_seconds = 300
    now = time.time()
    if _jwt_cache["token"] and (now - _jwt_cache["ts"]) < token_ttl_seconds:
        return _jwt_cache["token"]

    if not BASEROW_JWT_EMAIL or not BASEROW_JWT_PASSWORD:
        raise HTTPException(status_code=500, detail="Brak BASEROW_JWT_EMAIL/PASSWORD w konfiguracji")

    auth_url = f"{BASEROW_BASE_URL.rstrip('/')}/user/token-auth/"
    payload = {"email": BASEROW_JWT_EMAIL, "username": BASEROW_JWT_EMAIL, "password": BASEROW_JWT_PASSWORD}
    async with httpx.AsyncClient() as client:
        r = await client.post(auth_url, json=payload, headers={"Content-Type": "application/json"})
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Błąd logowania JWT: {r.text}")
    data = r.json()
    token = data.get("token") or data.get("access") or data.get("jwt")
    if not token:
        raise HTTPException(status_code=502, detail="Brak tokenu w odpowiedzi JWT")
    _jwt_cache["token"] = token
    _jwt_cache["ts"] = now
    return token


@app.get("/jwt/applications/{app_id}")
async def get_application_by_id(app_id: int):
    token = await _get_jwt_token()
    url = f"{BASEROW_BASE_URL.rstrip('/')}/applications/{app_id}/"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers={"Authorization": f"JWT {token}"})
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


@app.get("/auth/me")
async def auth_me(request: Request):
    jwt_cookie = request.cookies.get(AUTH_COOKIE_NAME, "").strip()
    if not jwt_cookie:
        return {"authenticated": False}

    headers = {
        "Authorization": USER_VALIDATE_AUTH,
        "Content-Type": "application/json",
    }
    payload = {"token": jwt_cookie}

    async with httpx.AsyncClient() as client:
        r = await client.post(USER_VALIDATE_URL, json=payload, headers=headers)

    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)

    data = r.json()
    # Oczekiwany format:
    # {"valid": true, "id": "...", "username": "...", "email": "...", "exp": 123, "allowed": true, "role": "EMPLOYEE"}
    return {
        "authenticated": bool(data.get("valid")),
        "id": data.get("id"),
        "username": data.get("username"),
        "email": data.get("email"),
        "exp": data.get("exp"),
        "allowed": data.get("allowed"),
        "role": data.get("role"),
    }


@app.post("/auth/logout")
async def auth_logout(response: Response):
    # Usuń ciasteczko uwierzytelniające
    try:
        response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    except Exception:
        pass
    return {"ok": True}


