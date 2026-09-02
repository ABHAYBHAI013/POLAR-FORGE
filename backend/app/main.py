from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.database import engine, Base, SessionLocal
from app.models import User, UserRole
from app.security import hash_password
from app.routers import auth, stations, inventory, qr, shipments, alerts, reports
from app.models import (
    Station, StorageUnit, StorageCondition, AssetDefinition, AssetBatch,
    Shipment, ShipmentStatus, TransportMode, ShipmentTrackingPoint, Alert, AlertType, AlertSeverity
)
import datetime
import os

app = FastAPI(
    title="Polar Expedition Logistics — MVP",
    description="SIH26062 · Ministry of Earth Sciences (MVP build — SQLite, zero external setup)",
    version="0.1.0-mvp",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stations.router)
app.include_router(inventory.router)
app.include_router(qr.router)
app.include_router(shipments.router)
app.include_router(alerts.router)
app.include_router(reports.router)


DEFAULT_USERS = [
    {
        "employee_code": "ADM001",
        "full_name": "Admin",
        "email": "admin@moes.gov.in",
        "password": "Manan@2007",
        "role": UserRole.admin,
    },
    {
        "employee_code": "INV002",
        "full_name": "Inventory Manager",
        "email": "inventory@moes.gov.in",
        "password": "Inventory@2026",
        "role": UserRole.inventory_manager,
    },
    {
        "employee_code": "LOG003",
        "full_name": "Logistics Manager",
        "email": "logistics@moes.gov.in",
        "password": "Logistics@2026",
        "role": UserRole.logistics_manager,
    },
    {
        "employee_code": "EXP004",
        "full_name": "Expedition Team",
        "email": "expedition@moes.gov.in",
        "password": "Expedition@2026",
        "role": UserRole.expedition_team,
    },
    {
        "employee_code": "MNT005",
        "full_name": "Maintenance Team",
        "email": "maintenance@moes.gov.in",
        "password": "Maintenance@2026",
        "role": UserRole.maintenance_team,
    },
]


DEFAULT_STATIONS = [
    {"code": "BHARATI", "name": "Bharati Station (Larsemann Hills)", "latitude": -69.4072, "longitude": 76.1872},
    {"code": "MAITRI", "name": "Maitri Station (Schirmacher Oasis)", "latitude": -70.7667, "longitude": 11.7333},
    {"code": "DG-BASE", "name": "Dakshin Gangotri Supply Base", "latitude": -70.7500, "longitude": 11.6333},
    {"code": "HIMADRI", "name": "Himadri Station (Arctic / Svalbard)", "latitude": 78.9236, "longitude": 11.9222},
    {"code": "INDARC", "name": "IndARC Marine Observatory", "latitude": 78.9000, "longitude": 12.0000},
    {"code": "MCMURDO", "name": "McMurdo Station (Ross Island)", "latitude": -77.8460, "longitude": 166.6680},
    {"code": "CONCORDIA", "name": "Concordia Station (Dome C)", "latitude": -75.1000, "longitude": 123.3333},
]


def seed_extended_demo_data(db):
    stations = {
        station.code: station
        for station in db.execute(select(Station)).scalars().all()
    }
    assets = {
        asset.sku: asset
        for asset in db.execute(select(AssetDefinition)).scalars().all()
    }

    extra_assets = [
        {
            "sku": "FUEL-PRO-020",
            "name": "Arctic Diesel Fuel Canister",
            "category": "Fuel & Power",
            "default_storage_condition": StorageCondition.ambient,
            "unit_of_measure": "canisters",
            "reorder_threshold": 25.0,
        },
        {
            "sku": "LAB-CRY-110",
            "name": "Cryogenic Sample Vials",
            "category": "Scientific",
            "default_storage_condition": StorageCondition.cryogenic,
            "unit_of_measure": "vials",
            "reorder_threshold": 30.0,
        },
        {
            "sku": "SAF-THR-300",
            "name": "Extreme Cold Thermal Suit",
            "category": "Safety Equipment",
            "default_storage_condition": StorageCondition.ambient,
            "unit_of_measure": "suits",
            "reorder_threshold": 10.0,
        },
    ]
    for asset_data in extra_assets:
        if asset_data["sku"] not in assets:
            asset = AssetDefinition(**asset_data)
            db.add(asset)
            db.flush()
            assets[asset.sku] = asset

    extra_batches = [
        ("FUEL-PRO-020", "BCH-FUEL-2026-B", 60, 60, "canisters", "BHARATI", 120),
        ("LAB-CRY-110", "BCH-LAB-2026-C", 80, 72, "vials", "MAITRI", 240),
        ("SAF-THR-300", "BCH-SAF-2026-D", 24, 8, "suits", "HIMADRI", 75),
        ("RAT-DRY-500", "BCH-RAT-2026-Y", 300, 300, "packs", "BHARATI", 365),
    ]
    for sku, batch_number, received, remaining, unit, station_code, expiry_days in extra_batches:
        found = db.execute(
            select(AssetBatch).where(AssetBatch.batch_number == batch_number)
        ).scalar_one_or_none()
        if not found and sku in assets and station_code in stations:
            db.add(AssetBatch(
                asset_def_id=assets[sku].asset_def_id,
                batch_number=batch_number,
                expiry_date=datetime.date.today() + datetime.timedelta(days=expiry_days),
                quantity_received=received,
                quantity_remaining=remaining,
                unit_of_measure=unit,
                station_id=stations[station_code].station_id,
            ))

    extra_shipments = [
        ("EXP-SHP-2026-002", "MAITRI", "BHARATI", TransportMode.ship, ShipmentStatus.dispatched, 8),
        ("EXP-SHP-2026-003", "HIMADRI", "INDARC", TransportMode.snow_vehicle, ShipmentStatus.planned, 48),
        ("EXP-SHP-2026-004", "BHARATI", "CONCORDIA", TransportMode.aircraft, ShipmentStatus.arrived, -30),
    ]
    for code, origin_code, destination_code, mode, shipment_status, departure_offset in extra_shipments:
        found = db.execute(
            select(Shipment).where(Shipment.shipment_code == code)
        ).scalar_one_or_none()
        if not found and origin_code in stations and destination_code in stations:
            departure = datetime.datetime.now() - datetime.timedelta(hours=departure_offset)
            shipment = Shipment(
                shipment_code=code,
                origin_station_id=stations[origin_code].station_id,
                destination_station_id=stations[destination_code].station_id,
                transport_mode=mode,
                status=shipment_status,
                planned_departure=departure,
                planned_arrival=departure + datetime.timedelta(hours=12),
            )
            db.add(shipment)
            db.flush()
            db.add_all([
                ShipmentTrackingPoint(
                    shipment_id=shipment.shipment_id,
                    latitude=float(stations[origin_code].latitude),
                    longitude=float(stations[origin_code].longitude),
                    ambient_temp_c=-21.5,
                ),
                ShipmentTrackingPoint(
                    shipment_id=shipment.shipment_id,
                    latitude=float(stations[destination_code].latitude),
                    longitude=float(stations[destination_code].longitude),
                    ambient_temp_c=-18.0,
                ),
            ])

    extra_alerts = [
        (AlertType.expiry_approaching, AlertSeverity.warning, "Medical batch approaching expiry", "BCH-MED-2026-A expires within 30 days", "MAITRI"),
        (AlertType.low_stock, AlertSeverity.warning, "Thermal suit stock below threshold", "Only 8 extreme cold thermal suits remain at Himadri", "HIMADRI"),
        (AlertType.overdue_shipment, AlertSeverity.info, "Shipment delivery confirmation pending", "EXP-SHP-2026-002 is awaiting destination confirmation", "BHARATI"),
    ]
    for alert_type, severity, title, message, station_code in extra_alerts:
        found = db.execute(select(Alert).where(Alert.title == title)).scalar_one_or_none()
        if not found and station_code in stations:
            db.add(Alert(
                alert_type=alert_type,
                severity=severity,
                title=title,
                message=message,
                station_id=stations[station_code].station_id,
                is_resolved=False,
            ))


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed or update the 5 role accounts
        for u_data in DEFAULT_USERS:
            existing = db.execute(select(User).where(User.email == u_data["email"])).scalar_one_or_none()
            if not existing:
                user = User(
                    employee_code=u_data["employee_code"],
                    full_name=u_data["full_name"],
                    email=u_data["email"],
                    password_hash=hash_password(u_data["password"]),
                    role=u_data["role"],
                    is_active=True,
                )
                db.add(user)
                print(f"[seed] Created user: {u_data['email']} ({u_data['role'].value})")
            else:
                existing.full_name = u_data["full_name"]
                existing.role = u_data["role"]


        # 2. Seed Polar Stations if empty
        station_count = db.execute(select(Station)).scalars().all()
        if not station_count:
            created_stations = {}
            for s_data in DEFAULT_STATIONS:
                st = Station(**s_data)
                db.add(st)
                db.flush()
                created_stations[s_data["code"]] = st
            print(f"[seed] Seeded {len(DEFAULT_STATIONS)} Polar Research Stations with coordinates")

            # Seed default storage units
            if "BHARATI" in created_stations:
                db.add(StorageUnit(
                    station_id=created_stations["BHARATI"].station_id,
                    code="BHR-COLD-01",
                    name="Biological Specimen Deep Freezer",
                    storage_condition=StorageCondition.deep_frozen_neg40C,
                    current_temp_c=-38.5,
                    target_temp_min_c=-45.0,
                    target_temp_max_c=-35.0,
                ))
                db.add(StorageUnit(
                    station_id=created_stations["BHARATI"].station_id,
                    code="BHR-MED-02",
                    name="Medical Rations Chilled Store",
                    storage_condition=StorageCondition.chilled_0_4C,
                    current_temp_c=2.8,
                    target_temp_min_c=0.0,
                    target_temp_max_c=4.0,
                ))

            if "MAITRI" in created_stations:
                db.add(StorageUnit(
                    station_id=created_stations["MAITRI"].station_id,
                    code="MTR-FREEZE-01",
                    name="Perishable Food Frozen Vault",
                    storage_condition=StorageCondition.frozen_neg18C,
                    current_temp_c=-19.2,
                    target_temp_min_c=-22.0,
                    target_temp_max_c=-15.0,
                ))

            # Seed sample assets & batches
            asset1 = AssetDefinition(
                sku="MED-INS-001",
                name="Insulin & Emergency Vaccines",
                category="Medical",
                default_storage_condition=StorageCondition.chilled_0_4C,
                unit_of_measure="vials",
                reorder_threshold=20.0,
            )
            asset2 = AssetDefinition(
                sku="RAT-DRY-500",
                name="High-Calorie Polar Expedition Rations",
                category="Rations",
                default_storage_condition=StorageCondition.ambient,
                unit_of_measure="packs",
                reorder_threshold=50.0,
            )
            asset3 = AssetDefinition(
                sku="BIO-SMP-800",
                name="Microbial Ice Core Preservative Agent",
                category="Scientific",
                default_storage_condition=StorageCondition.deep_frozen_neg40C,
                unit_of_measure="units",
                reorder_threshold=15.0,
            )
            db.add_all([asset1, asset2, asset3])
            db.flush()

            if "MAITRI" in created_stations:
                today = datetime.date.today()
                db.add(AssetBatch(
                    asset_def_id=asset1.asset_def_id,
                    batch_number="BCH-MED-2026-A",
                    expiry_date=today + datetime.timedelta(days=24),
                    quantity_received=100.0,
                    quantity_remaining=65.0,
                    unit_of_measure="vials",
                    station_id=created_stations["MAITRI"].station_id,
                ))
                db.add(AssetBatch(
                    asset_def_id=asset2.asset_def_id,
                    batch_number="BCH-RAT-2026-X",
                    expiry_date=today + datetime.timedelta(days=180),
                    quantity_received=500.0,
                    quantity_remaining=420.0,
                    unit_of_measure="packs",
                    station_id=created_stations["MAITRI"].station_id,
                ))

            # Seed a sample active shipment between Bharati and Maitri
            if "BHARATI" in created_stations and "MAITRI" in created_stations:
                shp = Shipment(
                    shipment_code="EXP-SHP-2026-001",
                    origin_station_id=created_stations["BHARATI"].station_id,
                    destination_station_id=created_stations["MAITRI"].station_id,
                    transport_mode=TransportMode.aircraft,
                    status=ShipmentStatus.in_transit,
                    planned_departure=datetime.datetime.now() - datetime.timedelta(hours=4),
                    planned_arrival=datetime.datetime.now() + datetime.timedelta(hours=3),
                )
                db.add(shp)
                db.flush()

                # Add waypoint tracking points along Antarctic coast
                db.add(ShipmentTrackingPoint(
                    shipment_id=shp.shipment_id,
                    latitude=-69.8500,
                    longitude=52.4000,
                    ambient_temp_c=-28.4,
                ))
                db.add(ShipmentTrackingPoint(
                    shipment_id=shp.shipment_id,
                    latitude=-69.5200,
                    longitude=68.1000,
                    ambient_temp_c=-24.1,
                ))

            # Seed an operational alert
            if "BHARATI" in created_stations:
                db.add(Alert(
                    alert_type=AlertType.temperature_breach,
                    severity=AlertSeverity.critical,
                    title="Deep Freeze Thermal Variation Alert",
                    message="BHR-COLD-01 ambient sensor recorded -34.2°C briefly (upper threshold -35°C)",
                    station_id=created_stations["BHARATI"].station_id,
                    is_resolved=False,
                ))

        seed_extended_demo_data(db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[seed] Error during startup seed: {e}")
    finally:
        db.close()



@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "Polar Expedition Logistics MVP"}


@app.get("/", tags=["health"])
def root():
    return {"message": "Polar Expedition Logistics MVP API", "docs": "/docs"}
