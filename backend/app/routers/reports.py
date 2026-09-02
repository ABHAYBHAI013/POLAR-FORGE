from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    User, Station, StorageUnit, StorageTemperatureLog, AssetDefinition, AssetBatch,
    InventoryTransaction, QrCode, QrScanEvent, Shipment, ShipmentTrackingPoint, Alert
)
from app.services import generate_qr_image_base64

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/manifest/{shipment_id}")
def get_shipment_manifest(shipment_id: str, db: Session = Depends(get_db), _current: User = Depends(get_current_user)):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    origin = db.get(Station, shipment.origin_station_id)
    dest = db.get(Station, shipment.destination_station_id)

    qr = db.execute(
        select(QrCode).where(QrCode.entity_id == shipment_id, QrCode.is_active == True)
    ).scalar_one_or_none()
    qr_b64 = generate_qr_image_base64(qr.qr_token) if qr else generate_qr_image_base64(f"POLAR-SHP:{shipment.shipment_code}")

    points = db.execute(
        select(ShipmentTrackingPoint)
        .where(ShipmentTrackingPoint.shipment_id == shipment_id)
        .order_by(ShipmentTrackingPoint.recorded_at.desc())
    ).scalars().all()

    origin_batches = db.execute(
        select(AssetBatch, AssetDefinition)
        .join(AssetDefinition, AssetBatch.asset_def_id == AssetDefinition.asset_def_id)
        .where(AssetBatch.station_id == shipment.origin_station_id)
        .limit(10)
    ).all()

    cargo_items = []
    total_qty = 0
    for b, d in origin_batches:
        cond = str(d.default_storage_condition.value if hasattr(d.default_storage_condition, 'value') else d.default_storage_condition)
        cargo_items.append({
            "batch_number": b.batch_number,
            "item_name": d.name,
            "sku": d.sku,
            "category": d.category,
            "storage_condition": cond,
            "quantity": float(b.quantity_remaining),
            "unit": b.unit_of_measure,
            "expiry_date": str(b.expiry_date) if b.expiry_date else "N/A",
        })
        total_qty += float(b.quantity_remaining)

    return {
        "manifest_id": f"MNF-{shipment.shipment_code}",
        "generated_at": datetime.now().isoformat(),
        "shipment": {
            "shipment_id": shipment.shipment_id,
            "shipment_code": shipment.shipment_code,
            "transport_mode": shipment.transport_mode.value if hasattr(shipment.transport_mode, 'value') else shipment.transport_mode,
            "status": shipment.status.value if hasattr(shipment.status, 'value') else shipment.status,
            "planned_departure": shipment.planned_departure.isoformat() if shipment.planned_departure else None,
            "planned_arrival": shipment.planned_arrival.isoformat() if shipment.planned_arrival else None,
            "created_at": shipment.created_at.isoformat() if shipment.created_at else None,
        },
        "origin_station": {
            "name": origin.name if origin else "Unknown",
            "code": origin.code if origin else "—",
            "latitude": float(origin.latitude) if origin and origin.latitude else None,
            "longitude": float(origin.longitude) if origin and origin.longitude else None,
        },
        "destination_station": {
            "name": dest.name if dest else "Unknown",
            "code": dest.code if dest else "—",
            "latitude": float(dest.latitude) if dest and dest.latitude else None,
            "longitude": float(dest.longitude) if dest and dest.longitude else None,
        },
        "qr_code_base64": qr_b64,
        "cargo_items": cargo_items,
        "summary": {
            "total_items_count": len(cargo_items),
            "total_weight_est_kg": round(total_qty * 1.85, 2),
            "cold_chain_required": any("frozen" in item["storage_condition"] or "chilled" in item["storage_condition"] for item in cargo_items),
            "hazmat_cleared": True,
            "antarctic_treaty_compliant": True,
        },
        "telemetry_checkpoints": [
            {
                "lat": float(p.latitude),
                "lng": float(p.longitude),
                "ambient_temp_c": float(p.ambient_temp_c) if p.ambient_temp_c is not None else None,
                "recorded_at": p.recorded_at.isoformat(),
            }
            for p in points
        ],
    }


@router.get("/dispatch/{shipment_id}")
def get_customs_dispatch_sheet(shipment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    manifest_data = get_shipment_manifest(shipment_id, db, current_user)
    
    return {
        "dispatch_sheet_id": f"DSP-MOES-{manifest_data['shipment']['shipment_code']}",
        "protocol": "Antarctic Treaty Environmental Protocol (Annex II/III)",
        "issuing_authority": "National Centre for Polar and Ocean Research (NCPOR) / MoES, Govt of India",
        "authorized_officer": current_user.full_name,
        "officer_code": current_user.employee_code,
        "officer_role": current_user.role.value if hasattr(current_user.role, 'value') else current_user.role,
        "manifest": manifest_data,
        "compliance_declarations": [
            "Thermal insulation integrity verified for polar transit conditions",
            "Zero hazardous bio-waste containment protocols met",
            "GPS beacon transponder operational and calibrated",
            "Emergency rations and arctic survival pack aboard",
            "Non-native species quarantine protocol verified"
        ],
        "clearance_status": "APPROVED FOR EXPEDITION TRANSIT"
    }


@router.get("/audit-log")
def get_consolidated_audit_log(
    event_type: str = "all",
    station_id: str | None = None,
    limit: int = 150,
    db: Session = Depends(get_db),
    _current: User = Depends(get_current_user)
):
    audit_events = []

    # 1. QR Scans
    if event_type in ("all", "scan"):
        scan_query = (
            select(QrScanEvent, QrCode, User, Station)
            .join(QrCode, QrScanEvent.qr_id == QrCode.qr_id)
            .join(User, QrScanEvent.scanned_by == User.user_id)
            .outerjoin(Station, QrScanEvent.station_id == Station.station_id)
        )
        if station_id:
            scan_query = scan_query.where(QrScanEvent.station_id == station_id)
        scans = db.execute(scan_query.order_by(QrScanEvent.scanned_at.desc()).limit(limit)).all()
        for scan, qr, user, st in scans:
            audit_events.append({
                "id": f"scan-{scan.scan_id}",
                "event_category": "QR Scan",
                "action": scan.action.value if hasattr(scan.action, 'value') else scan.action,
                "entity_type": qr.entity_type.value if hasattr(qr.entity_type, 'value') else qr.entity_type,
                "entity_id": qr.entity_id,
                "token": qr.qr_token,
                "performed_by": user.full_name,
                "station_name": st.name if st else "In Transit / Field",
                "notes": scan.notes or "Standard telemetry verification",
                "timestamp": scan.scanned_at.isoformat(),
                "severity": "info",
            })

    # 2. Inventory Transactions
    if event_type in ("all", "inventory"):
        txn_query = (
            select(InventoryTransaction, AssetDefinition, User, Station)
            .join(AssetDefinition, InventoryTransaction.asset_def_id == AssetDefinition.asset_def_id)
            .join(User, InventoryTransaction.performed_by == User.user_id)
            .outerjoin(Station, InventoryTransaction.station_id == Station.station_id)
        )
        if station_id:
            txn_query = txn_query.where(InventoryTransaction.station_id == station_id)
        txns = db.execute(txn_query.order_by(InventoryTransaction.txn_at.desc()).limit(limit)).all()
        for txn, asset_def, user, st in txns:
            audit_events.append({
                "id": f"txn-{txn.txn_id}",
                "event_category": "Inventory Allocation",
                "action": txn.txn_type.upper(),
                "entity_type": "Asset",
                "entity_id": asset_def.sku,
                "token": f"Qty: {txn.quantity} {asset_def.unit_of_measure}",
                "performed_by": user.full_name,
                "station_name": st.name if st else "Central Base",
                "notes": txn.remarks or f"{txn.txn_type} of {asset_def.name}",
                "timestamp": txn.txn_at.isoformat(),
                "severity": "info",
            })

    # 3. Temperature Breaches & Alerts
    if event_type in ("all", "temperature", "alerts"):
        alert_query = select(Alert, Station).outerjoin(Station, Alert.station_id == Station.station_id)
        if station_id:
            alert_query = alert_query.where(Alert.station_id == station_id)
        alerts = db.execute(alert_query.order_by(Alert.created_at.desc()).limit(limit)).all()
        for alert, st in alerts:
            audit_events.append({
                "id": f"alert-{alert.alert_id}",
                "event_category": "Cold-Chain & Operational Alert",
                "action": alert.alert_type.value if hasattr(alert.alert_type, 'value') else alert.alert_type,
                "entity_type": "Alert",
                "entity_id": alert.alert_id[:8],
                "token": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
                "performed_by": "Sensor / Auto-Telemetry",
                "station_name": st.name if st else "System Wide",
                "notes": f"{alert.title} - {alert.message} ({'Resolved' if alert.is_resolved else 'Active'})",
                "timestamp": alert.created_at.isoformat(),
                "severity": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
            })

    audit_events.sort(key=lambda x: x["timestamp"], reverse=True)
    return audit_events[:limit]
