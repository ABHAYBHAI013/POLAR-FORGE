import csv
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import (
    Alert,
    AlertSeverity,
    AlertType,
    AssetBatch,
    AssetDefinition,
    Shipment,
    ShipmentStatus,
    ShipmentTrackingPoint,
    Station,
    StorageCondition,
    TransportMode,
)

CSV_PATH = Path(__file__).parent / "data" / "smart-logistics-extracted" / "smart_logistics_dataset.csv"


def safe_code(value):
    return re.sub(r"[^A-Z0-9]+", "-", value.upper()).strip("-")[:35]


def import_dataset():
    rows_by_asset = defaultdict(list)
    with CSV_PATH.open(newline="", encoding="utf-8") as csv_file:
        for row in csv.DictReader(csv_file):
            rows_by_asset[row["Asset_ID"]].append(row)

    db = SessionLocal()
    imported = {"stations": 0, "assets": 0, "batches": 0, "shipments": 0, "tracking": 0, "alerts": 0}
    try:
        origin = db.execute(select(Station).where(Station.code == "BHARATI")).scalar_one_or_none()
        for asset_id, rows in rows_by_asset.items():
            code = safe_code(asset_id)
            station_code = f"KGL-{code}"
            station = db.execute(select(Station).where(Station.code == station_code)).scalar_one_or_none()
            first = rows[0]
            if not station:
                station = Station(
                    code=station_code,
                    name=f"Kaggle Logistics Node - {asset_id}",
                    latitude=float(first["Latitude"]),
                    longitude=float(first["Longitude"]),
                )
                db.add(station)
                db.flush()
                imported["stations"] += 1

            sku = f"KGL-{code}"
            asset = db.execute(select(AssetDefinition).where(AssetDefinition.sku == sku)).scalar_one_or_none()
            if not asset:
                asset = AssetDefinition(
                    sku=sku,
                    name=f"Imported Logistics Asset - {asset_id}",
                    category="Kaggle Logistics",
                    default_storage_condition=StorageCondition.ambient,
                    unit_of_measure="units",
                    reorder_threshold=float(first["Demand_Forecast"]),
                )
                db.add(asset)
                db.flush()
                imported["assets"] += 1

            batch_number = f"KGL-BATCH-{code}"
            batch = db.execute(select(AssetBatch).where(AssetBatch.batch_number == batch_number)).scalar_one_or_none()
            latest_inventory = max(float(rows[-1]["Inventory_Level"]), 0)
            if not batch:
                db.add(AssetBatch(
                    asset_def_id=asset.asset_def_id,
                    batch_number=batch_number,
                    expiry_date=date.today() + timedelta(days=365),
                    quantity_received=max(latest_inventory, 1),
                    quantity_remaining=latest_inventory,
                    unit_of_measure="units",
                    station_id=station.station_id,
                ))
                imported["batches"] += 1

            shipment_code = f"KGL-SHP-{code}"
            shipment = db.execute(select(Shipment).where(Shipment.shipment_code == shipment_code)).scalar_one_or_none()
            status_map = {
                "Delivered": ShipmentStatus.arrived,
                "In Transit": ShipmentStatus.in_transit,
                "Delayed": ShipmentStatus.delayed,
            }
            first_time = datetime.fromisoformat(first["Timestamp"])
            if not shipment:
                shipment = Shipment(
                    shipment_code=shipment_code,
                    origin_station_id=origin.station_id if origin else station.station_id,
                    destination_station_id=station.station_id,
                    transport_mode=TransportMode.snow_vehicle,
                    status=status_map.get(first["Shipment_Status"], ShipmentStatus.planned),
                    planned_departure=first_time,
                    planned_arrival=first_time + timedelta(hours=12),
                )
                db.add(shipment)
                db.flush()
                imported["shipments"] += 1

            existing_tracking = db.execute(
                select(ShipmentTrackingPoint).where(ShipmentTrackingPoint.shipment_id == shipment.shipment_id)
            ).scalars().first()
            if not existing_tracking:
                for row in rows:
                    db.add(ShipmentTrackingPoint(
                        shipment_id=shipment.shipment_id,
                        latitude=float(row["Latitude"]),
                        longitude=float(row["Longitude"]),
                        ambient_temp_c=float(row["Temperature"]),
                        recorded_at=datetime.fromisoformat(row["Timestamp"]),
                    ))
                    imported["tracking"] += 1

            alert_title = f"Imported delay alert - {asset_id}"
            has_delay = any(row["Shipment_Status"] == "Delayed" for row in rows)
            existing_alert = db.execute(select(Alert).where(Alert.title == alert_title)).scalar_one_or_none()
            if has_delay and not existing_alert:
                db.add(Alert(
                    alert_type=AlertType.overdue_shipment,
                    severity=AlertSeverity.warning,
                    title=alert_title,
                    message=f"Kaggle data reports a delayed shipment for {asset_id}.",
                    station_id=station.station_id,
                ))
                imported["alerts"] += 1

        db.commit()
        print("Imported Kaggle records:", imported)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import_dataset()
