from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_write
from app.models import User, Alert
from app.schemas import AlertOut

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(is_resolved: bool | None = None, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    query = select(Alert)
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    return db.execute(query.order_by(Alert.created_at.desc()).limit(200)).scalars().all()


@router.patch("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(alert_id: str, db: Session = Depends(get_db), _current: User = Depends(require_write)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.is_resolved = True
    db.commit()
    db.refresh(alert)
    return alert
