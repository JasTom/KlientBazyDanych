# Backend FastAPI (proxy do Baserow)

## Wymagania
- Python 3.10+
- pip

## Instalacja
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Konfiguracja
Ustaw zmienne środowiskowe (np. w PowerShell):
```powershell
$env:BASEROW_BASE_URL = "https://api.baserow.io/api"
$env:BASEROW_AUTH_TOKEN = "Token <twoj_token_api>"
$env:BASEROW_JWT_EMAIL = "user@example.com"
$env:BASEROW_JWT_PASSWORD = "<haslo>"
```

## Uruchomienie
```bash
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

## Endpointy
- GET /health – sprawdzenie zdrowia
- ANY /token/{full_path} – proxy z nagłówkiem Authorization: Token ...
- GET /jwt/applications/{id} – pobranie aplikacji po JWT (logowanie backendowe, cache 5 min)

## Integracja z frontendem
- Frontend kieruje żądania Token na `http://127.0.0.1:8000/token/...`
- Frontend pobiera nazwy baz przez `http://127.0.0.1:8000/jwt/applications/{id}`
