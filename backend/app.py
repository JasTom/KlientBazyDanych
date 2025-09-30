import os
import time
from typing import Dict

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from dotenv import load_dotenv

app = FastAPI(title="Baserow Proxy", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
BASEROW_AUTH_TOKEN = os.getenv("BASEROW_AUTH_TOKEN", "Token Ldhe8HXyypxOR4zoGMrvTKj0EZ3dr7iC").strip()
BASEROW_JWT_EMAIL = os.getenv("BASEROW_JWT_EMAIL", "tomaszjastrzebski1996@gmail.com").strip()
BASEROW_JWT_PASSWORD = os.getenv("BASEROW_JWT_PASSWORD", "Q9JpX!AsSve2ifT").strip()


def _get_token_header_value() -> str:
    token_value = BASEROW_AUTH_TOKEN
    if token_value and not token_value.lower().startswith("token "):
        token_value = f"Token {token_value}"
    return token_value


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
    token_header = _get_token_header_value()
    if not token_header:
        raise HTTPException(status_code=500, detail="Brak BASEROW_AUTH_TOKEN w konfiguracji")

    url = f"{BASEROW_BASE_URL.rstrip('/')}/{full_path}"
    method = request.method.upper()
    query_string = request.url.query
    if query_string:
        url = f"{url}?{query_string}"

    # Skopiuj tylko bezpieczne nagłówki; pomiń Authorization (ustawimy własny), Host, Content-Length itp.
    safe_request_headers = {"content-type", "accept"}
    forward_headers: Dict[str, str] = {}
    for k, v in request.headers.items():
        lk = k.lower()
        if lk in {"authorization", "host", "content-length", "connection", "accept-encoding", "origin", "referer"}:
            continue
        if lk in safe_request_headers:
            forward_headers[k] = v
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


