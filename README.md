# Campus Dining

CS361 Sprint 1 — a campus dining web app where students can browse locations and menus, create an account, place orders, track order status, and receive email notifications.

The frontend talks to four local microservices for accounts, cryptographic order signing, order status, and notifications.

## Features

- Welcome, register, and login screens
- Browse campus dining locations and menus
- Shopping cart and checkout
- Order signing with Ed25519 key pairs
- Live order status tracking (`received` → `preparing` → `ready`)
- Email notifications for account and order events

## Project structure

```
CS361/
├── index.html          # Frontend UI
├── styles.css          # Styles
├── script.js           # Frontend logic + API calls
├── account/            # Go account service (JWT auth)
├── key-gen/            # FastAPI Ed25519 key/sign/verify service
├── update status/      # FastAPI order status service
└── notification/       # Flask email notification service
```

## Architecture

| Service | Tech | Port | Role |
|---------|------|------|------|
| Frontend | HTML / CSS / JS | static | Campus Dining UI |
| Key Generation | FastAPI (Python) | `8000` | Generate keys, sign/verify orders |
| Order Status | FastAPI (Python) | `8001` | Create orders and return status progress |
| Account | Go + PostgreSQL | `8003` | Register, login, JWT |
| Notification | Flask (Python) | `8080` | Send welcome / order emails |

## Prerequisites

- Python 3.10+
- Go 1.20+
- PostgreSQL (or Docker)
- A modern browser

## Setup

### 1. Frontend

Open `index.html` in a browser, or serve the project folder with any static server:

```bash
# from the project root
python3 -m http.server 5500
```

Then visit `http://127.0.0.1:5500`.

### 2. Key Generation service (`key-gen/`) — port 8000

```bash
cd key-gen
pip install fastapi uvicorn pydantic
uvicorn main:app --reload --port 8000
```

Endpoints:

- `POST /generateKeyPair`
- `POST /signData`
- `POST /verifySignature`

### 3. Order Status service (`update status/`) — port 8001

```bash
cd "update status"
pip install fastapi uvicorn pydantic
uvicorn app.main:app --reload --port 8001
```

Endpoints:

- `POST /order/create`
- `GET /order/status/{order_id}`
- `GET /order/progress/{order_id}`

Status timeline (demo):

- `received` — first ~20 seconds
- `preparing` — ~20–60 seconds
- `ready` — after ~60 seconds

### 4. Account service (`account/`) — port 8003

Requires PostgreSQL. Example with Docker (matches `account/config.json`, which uses port `5434`):

```bash
docker run \
  --name campus-dining-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=account \
  -p 5434:5432 \
  -d postgres:16
```

Then start the service:

```bash
cd account
go run .
```

Config lives in `account/config.json` (host, port, DB credentials, JWT secret, service port).

Endpoints:

- `POST /user` — register
- `POST /user/login` — login (returns JWT)
- `GET /user?id=...` or `GET /user?username=...`

More detail: see [`account/README.md`](account/README.md).

### 5. Notification service (`notification/`) — port 8080

```bash
cd notification
pip install -r requirements.txt
python api.py
```

Endpoints:

- `POST /send` — send order notification email
- `GET /send-email/<user_email>` — send welcome email
- `POST /preferences` / `GET /preferences/<user_id>` — notification preferences

> **Security note:** Do not commit real email passwords. Prefer environment variables for Gmail credentials, and rotate any password that was previously committed.

## Running everything

Start services in separate terminals:

```bash
# Terminal 1 — key generation
cd key-gen && uvicorn main:app --reload --port 8000

# Terminal 2 — order status
cd "update status" && uvicorn app.main:app --reload --port 8001

# Terminal 3 — account (Postgres must already be running)
cd account && go run .

# Terminal 4 — notifications
cd notification && python api.py

# Terminal 5 — frontend
python3 -m http.server 5500
```

Then open `http://127.0.0.1:5500`.

## Typical user flow

1. Register or log in (Account service)
2. Browse a dining location and add items to the cart
3. Place an order (signed via Key Generation service)
4. Track status updates (Order Status service)
5. Receive email updates (Notification service)

## Course

Oregon State University — **CS361** Software Engineering I — Sprint 1
