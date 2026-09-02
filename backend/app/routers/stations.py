from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_write
from app.models import User, Station, StorageUnit, StorageTemperatureLog, Alert, AlertType, AlertSeverity
from app.schemas import (
    StationCreate, StationOut, StorageUnitCreate, StorageUnitOut,
    TemperatureLogCreate, TemperatureLogOut,
)

router = APIRouter(prefix="/api/v1", tags=["stations"])


@router.post("/stations", response_model=StationOut, status_code=status.HTTP_201_CREATED)
def create_station(payload: StationCreate, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    existing = db.execute(select(Station).where(Station.code == payload.code)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Station code already exists")
    station = Station(**payload.model_dump())
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.get("/stations", response_model=list[StationOut])
def list_stations(db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    return db.execute(select(Station).where(Station.is_active == True)).scalars().all()  # noqa: E712


@router.post("/storage-units", response_model=StorageUnitOut, status_code=status.HTTP_201_CREATED)
def create_storage_unit(payload: StorageUnitCreate, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    unit = StorageUnit(**payload.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.get("/storage-units", response_model=list[StorageUnitOut])
def list_storage_units(station_id: str | None = None, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    query = select(StorageUnit)
    if station_id:
        query = query.where(StorageUnit.station_id == station_id)
    return db.execute(query).scalars().all()


@router.post("/storage-units/temperature-log", response_model=TemperatureLogOut, status_code=status.HTTP_201_CREATED)
def log_temperature(payload: TemperatureLogCreate, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    unit = db.get(StorageUnit, payload.storage_unit_id)
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage unit not found")

    is_breach = False
    if unit.target_temp_min_c is not None and unit.target_temp_max_c is not None:
        if payload.recorded_temp_c < float(unit.target_temp_min_c) or payload.recorded_temp_c > float(unit.target_temp_max_c):
            is_breach = True

    log_entry = StorageTemperatureLog(
        storage_unit_id=payload.storage_unit_id,
        recorded_temp_c=payload.recorded_temp_c,
        is_breach=is_breach,
    )
    db.add(log_entry)

    unit.current_temp_c = payload.recorded_temp_c

    if is_breach:
        db.add(Alert(
            alert_type=AlertType.temperature_breach,
            severity=AlertSeverity.critical,
            title="Temperature breach detected",
            message=f"{unit.name} recorded {payload.recorded_temp_c}°C, outside target range "
                    f"{unit.target_temp_min_c}–{unit.target_temp_max_c}°C",
            station_id=unit.station_id,
        ))

    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.get("/storage-units/{storage_unit_id}/temperature-log", response_model=list[TemperatureLogOut])
def get_temperature_history(storage_unit_id: str, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    return db.execute(
        select(StorageTemperatureLog)
        .where(StorageTemperatureLog.storage_unit_id == storage_unit_id)
        .order_by(StorageTemperatureLog.recorded_at.desc())
        .limit(100)
    ).scalars().all()
