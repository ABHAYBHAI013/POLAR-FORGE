from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_write
from app.models import User, AssetDefinition, AssetBatch, InventoryTransaction, Station
from app.schemas import (
    AssetDefinitionCreate, AssetDefinitionOut,
    AssetBatchCreate, AssetBatchOut,
    IssueFefoRequest, InventoryTransactionOut, ExpiringBatchOut,
)
from app.services import allocate_fefo, apply_fefo_allocation, InsufficientStockError

router = APIRouter(prefix="/api/v1", tags=["inventory"])


@router.post("/asset-definitions", response_model=AssetDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_asset_definition(payload: AssetDefinitionCreate, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    existing = db.execute(select(AssetDefinition).where(AssetDefinition.sku == payload.sku)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")
    asset_def = AssetDefinition(**payload.model_dump())
    db.add(asset_def)
    db.commit()
    db.refresh(asset_def)
    return asset_def


@router.get("/asset-definitions", response_model=list[AssetDefinitionOut])
def list_asset_definitions(db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    return db.execute(select(AssetDefinition)).scalars().all()


@router.post("/asset-batches", response_model=AssetBatchOut, status_code=status.HTTP_201_CREATED)
def create_asset_batch(payload: AssetBatchCreate, db: Session = Depends(get_db), current_user: User = Depends(require_write)):
    asset_def = db.get(AssetDefinition, payload.asset_def_id)
    if not asset_def:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset definition not found")

    batch = AssetBatch(
        quantity_remaining=payload.quantity_received,
        **payload.model_dump(),
    )
    db.add(batch)
    db.flush()

    db.add(InventoryTransaction(
        asset_def_id=payload.asset_def_id,
        batch_id=batch.batch_id,
        txn_type="receipt",
        quantity=payload.quantity_received,
        station_id=payload.station_id,
        performed_by=current_user.user_id,
    ))
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/asset-batches", response_model=list[AssetBatchOut])
def list_asset_batches(station_id: str | None = None, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    query = select(AssetBatch)
    if station_id:
        query = query.where(AssetBatch.station_id == station_id)
    return db.execute(query.order_by(AssetBatch.expiry_date.asc().nulls_last())).scalars().all()


@router.post("/inventory/issue-fefo", response_model=list[InventoryTransactionOut])
def issue_stock_fefo(payload: IssueFefoRequest, db: Session = Depends(get_db), current_user: User = Depends(require_write)):
    """Issues stock using First-Expire-First-Out allocation across all in-stock batches."""
    try:
        allocations = allocate_fefo(db, payload.asset_def_id, payload.station_id, payload.quantity)
    except InsufficientStockError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    apply_fefo_allocation(db, allocations)

    transactions = []
    for alloc in allocations:
        txn = InventoryTransaction(
            asset_def_id=payload.asset_def_id,
            batch_id=alloc.batch_id,
            txn_type="issue",
            quantity=alloc.quantity_allocated,
            station_id=payload.station_id,
            performed_by=current_user.user_id,
            remarks=payload.remarks or f"FEFO auto-allocation: batch {alloc.batch_number}",
        )
        db.add(txn)
        transactions.append(txn)

    db.commit()
    for t in transactions:
        db.refresh(t)
    return transactions


@router.get("/reports/expiring-batches", response_model=list[ExpiringBatchOut])
def get_expiring_batches(db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    today = date.today()
    rows = db.execute(
        select(AssetBatch, AssetDefinition, Station)
        .join(AssetDefinition, AssetBatch.asset_def_id == AssetDefinition.asset_def_id)
        .join(Station, AssetBatch.station_id == Station.station_id)
        .where(AssetBatch.status == "in_stock", AssetBatch.expiry_date.isnot(None))
        .order_by(AssetBatch.expiry_date.asc())
    ).all()

    results = []
    for batch, asset_def, station in rows:
        days = (batch.expiry_date - today).days
        if days <= 30:
            results.append(ExpiringBatchOut(
                batch_id=batch.batch_id,
                asset_name=asset_def.name,
                quantity_remaining=batch.quantity_remaining,
                unit_of_measure=batch.unit_of_measure,
                expiry_date=batch.expiry_date,
                days_to_expiry=days,
                station_name=station.name,
            ))
    return results


@router.get("/reports/low-stock")
def get_low_stock(db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    defs = db.execute(select(AssetDefinition)).scalars().all()
    results = []
    for d in defs:
        total = db.execute(
            select(AssetBatch).where(AssetBatch.asset_def_id == d.asset_def_id, AssetBatch.status == "in_stock")
        ).scalars().all()
        total_remaining = sum(float(b.quantity_remaining) for b in total)
        if total_remaining <= float(d.reorder_threshold):
            results.append({
                "asset_def_id": d.asset_def_id,
                "name": d.name,
                "total_remaining": total_remaining,
                "reorder_threshold": float(d.reorder_threshold),
            })
    return results
