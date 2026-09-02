# Polar Expedition Logistics — MVP (SIH26062)

Zero-external-setup build: **SQLite** (no Postgres/PostGIS to install or configure)
and an **auto-seeded admin account** — no manual seed step, no `.env`, no `psql`.

## Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

```

That's it. On first run it:
- creates `polar_mvp.db` (SQLite file) in the `backend/` folder automatically
- creates all tables automatically
- seeds a default admin user automatically

You'll see in the console:
```
[seed] Created default admin — email: admin@moes.gov.in  password: Manan@2007
```

Backend runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

## Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

## Deploy on Render

This repository includes `render.yaml` for separate backend and frontend services.

1. Push the project to GitHub and create a new Render Blueprint from the repository.
2. After Render creates both services, copy the frontend service URL into the backend `FRONTEND_ORIGINS` environment variable.
3. Copy the backend service URL plus `/api/v1` into the frontend `VITE_API_URL` environment variable.
4. Redeploy both services.

Example values:

```text
FRONTEND_ORIGINS=https://polar-logistics-frontend.onrender.com
VITE_API_URL=https://polar-logistics-api.onrender.com/api/v1
```

The SQLite database is created automatically by the backend. For production use,
attach persistent storage or migrate to PostgreSQL; temporary hosting storage can
be reset during redeploys.

## Demo Accounts (1-Click Login on Sign-in Page)

| Role | Email | Password | Responsibilities |
|---|---|---|---|
| **Admin** | `admin@moes.gov.in` | `Manan@2007` | Full system control, User management, Station provisioning |
| **Inventory Manager** | `inventory@moes.gov.in` | `Inventory@2026` | Cold-chain perishables, FEFO allocation, batch receipt |
| **Logistics Manager** | `logistics@moes.gov.in` | `Logistics@2026` | Shipments dispatch, GPS tracking, route manifests |
| **Expedition Team** | `expedition@moes.gov.in` | `Expedition@2026` | Field station requests, QR check-in & consumption |
| **Maintenance Team** | `maintenance@moes.gov.in` | `Maintenance@2026` | Storage thermal logs, inspections, alarm resolutions |

## Key Features & Enterprise Modules

- **5 Distinct User Roles & RBAC** — Dedicated roles, permission guards, role-colored badges, and admin user creation console.
- **Interactive Polar Map & Route Telemetry** — Leaflet map with real coordinates for Antarctic & Arctic stations (Maitri, Bharati, Dakshin Gangotri, Himadri, IndARC, McMurdo, Concordia), live convoy GPS routes, and toggleable hazard layers (Blizzard Whiteouts, Crevasse Danger Zones, Sea Ice limits).
- **PDF & Official Report Generation** — Printable Polar Cargo Manifests, Customs & Cargo Dispatch Certificates (Antarctic Treaty Environmental Protocol compliance with embedded QR verification code), and Consolidated Audit Logs.
- **Inventory (batches/FEFO)** — Asset catalog, cold-chain batches, and a working **First-Expire-First-Out** issue algorithm that allocates across multiple batches automatically.
- **QR Generate & Trace** — Real scannable PNG QR codes, scan audit log events, full traceability chain.
- **Cold-Chain Alerts & Gauges** — Auto-raised critical alerts on storage unit temperature breaches, with gauge visualizations and resolution workflow.

