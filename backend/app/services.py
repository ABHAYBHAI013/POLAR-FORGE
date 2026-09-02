import base64
import io
import secrets
from dataclasses import dataclass

import qrcode
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssetBatch, AssetStatus, QrEntityType


# ---------------------------------------------------------------------------
# FEFO allocation
# ---------------------------------------------------------------------------

@dataclass
class FefoAllocation:
    batch_id: str
    batch_number: str
    quantity_allocated: float
    expiry_date: object


class InsufficientStockError(Exception):
    pass


def allocate_fefo(db: Session, asset_def_id: str, station_id: str, quantity_requested: float) -> list[FefoAllocation]:
    """First-Expire-First-Out: consumes soonest-expiring batches first (NULLs last)."""
    batches = db.execute(
        select(AssetBatch)
        .where(
            AssetBatch.asset_def_id == asset_def_id,
            AssetBatch.station_id == station_id,
            AssetBatch.status == AssetStatus.in_stock,
            AssetBatch.quantity_remaining > 0,
        )
        .order_by(AssetBatch.expiry_date.asc().nulls_last(), AssetBatch.created_at.asc())
    ).scalars().all()

    remaining_needed = quantity_requested
    allocations: list[FefoAllocation] = []

    for batch in batches:
        if remaining_needed <= 0:
            break
        take = min(float(batch.quantity_remaining), remaining_needed)
        if take <= 0:
            continue
        allocations.append(FefoAllocation(str(batch.batch_id), batch.batch_number, take, batch.expiry_date))
        remaining_needed -= take

    if remaining_needed > 0:
        raise InsufficientStockError(
            f"Requested {quantity_requested} but only {quantity_requested - remaining_needed} available"
        )

    return allocations


def apply_fefo_allocation(db: Session, allocations: list[FefoAllocation]) -> None:
    for alloc in allocations:
        batch = db.get(AssetBatch, alloc.batch_id)
        batch.quantity_remaining = float(batch.quantity_remaining) - alloc.quantity_allocated
        if batch.quantity_remaining <= 0:
            batch.status = AssetStatus.consumed


# ---------------------------------------------------------------------------
# QR generation
# ---------------------------------------------------------------------------

def generate_qr_token(entity_type: QrEntityType, entity_id: str) -> str:
    return f"{entity_type.value[:4]}-{entity_id[:8]}-{secrets.token_urlsafe(6)}"


def generate_qr_image_base64(qr_token: str) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
    qr.add_data(qr_token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
