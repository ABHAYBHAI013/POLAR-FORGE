from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_write
from app.models import User, Shipment, ShipmentTrackingPoint
from app.schemas import ShipmentCreate, ShipmentUpdate, ShipmentOut, TrackingPointCreate, TrackingPointOut

router = APIRouter(prefix="/api/v1", tags=["shipments"])


@router.post("/shipments", response_model=ShipmentOut, status_code=status.HTTP_201_CREATED)
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    existing = db.execute(select(Shipment).where(Shipment.shipment_code == payload.shipment_code)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Shipment code already exists")
    shipment = Shipment(**payload.model_dump())
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.get("/shipments", response_model=list[ShipmentOut])
def list_shipments(status_filter: str | None = None, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    query = select(Shipment)
    if status_filter:
        query = query.where(Shipment.status == status_filter)
    return db.execute(query.order_by(Shipment.created_at.desc())).scalars().all()


@router.patch("/shipments/{shipment_id}", response_model=ShipmentOut)
def update_shipment(shipment_id: str, payload: ShipmentUpdate, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shipment, field, value)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.post("/shipments/tracking", response_model=TrackingPointOut, status_code=status.HTTP_201_CREATED)
def add_tracking_point(payload: TrackingPointCreate, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    shipment = db.get(Shipment, payload.shipment_id)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    point = ShipmentTrackingPoint(**payload.model_dump())
    db.add(point)
    db.commit()
    db.refresh(point)
    return point


@router.get("/shipments/{shipment_id}/tracking", response_model=list[TrackingPointOut])
def get_tracking(shipment_id: str, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    return db.execute(
        select(ShipmentTrackingPoint)
        .where(ShipmentTrackingPoint.shipment_id == shipment_id)
        .order_by(ShipmentTrackingPoint.recorded_at.desc())
        .limit(100)
    ).scalars().all()
