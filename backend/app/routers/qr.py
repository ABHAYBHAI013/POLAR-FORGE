from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_write
from app.models import User, QrCode, QrScanEvent
from app.schemas import QrGenerateRequest, QrCodeOut, QrScanRequest, QrScanEventOut, EntityHistoryOut
from app.services import generate_qr_token, generate_qr_image_base64

router = APIRouter(prefix="/api/v1/qr", tags=["qr-tracking"])


@router.post("/generate", response_model=QrCodeOut, status_code=status.HTTP_201_CREATED)
def generate_qr(payload: QrGenerateRequest, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    # Deactivate any previous active QR for this entity
    existing = db.execute(
        select(QrCode).where(
            QrCode.entity_type == payload.entity_type,
            QrCode.entity_id == payload.entity_id,
            QrCode.is_active == True,  # noqa: E712
        )
    ).scalars().all()
    for old in existing:
        old.is_active = False

    token = generate_qr_token(payload.entity_type, payload.entity_id)
    qr_code = QrCode(qr_token=token, entity_type=payload.entity_type, entity_id=payload.entity_id)
    db.add(qr_code)
    db.commit()
    db.refresh(qr_code)

    image_b64 = generate_qr_image_base64(token)
    return QrCodeOut(
        qr_id=qr_code.qr_id, qr_token=qr_code.qr_token, entity_type=qr_code.entity_type,
        entity_id=qr_code.entity_id, is_active=qr_code.is_active, qr_image_base64=image_b64,
    )


@router.post("/scan", response_model=QrScanEventOut, status_code=status.HTTP_201_CREATED)
def record_scan(payload: QrScanRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    qr_code = db.execute(select(QrCode).where(QrCode.qr_token == payload.qr_token)).scalar_one_or_none()
    if not qr_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
    if not qr_code.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="QR code has been deactivated")

    scan_event = QrScanEvent(
        qr_id=qr_code.qr_id,
        scanned_by=current_user.user_id,
        action=payload.action,
        station_id=payload.station_id,
        notes=payload.notes,
    )
    db.add(scan_event)
    db.commit()
    db.refresh(scan_event)
    return scan_event


@router.get("/entity/{entity_type}/{entity_id}/history", response_model=EntityHistoryOut)
def get_entity_history(entity_type: str, entity_id: str, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    qr_codes = db.execute(
        select(QrCode).where(QrCode.entity_type == entity_type, QrCode.entity_id == entity_id)
    ).scalars().all()
    if not qr_codes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No QR codes found for this entity")

    qr_ids = [qc.qr_id for qc in qr_codes]
    scans = db.execute(
        select(QrScanEvent).where(QrScanEvent.qr_id.in_(qr_ids)).order_by(QrScanEvent.scanned_at.desc())
    ).scalars().all()

    return EntityHistoryOut(entity_type=entity_type, entity_id=entity_id, scans=scans)
