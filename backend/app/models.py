import uuid
import enum
from datetime import datetime, date

from sqlalchemy import String, Boolean, ForeignKey, DateTime, Date, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    admin = "admin"
    super_admin = "super_admin"  # alias for admin
    inventory_manager = "inventory_manager"
    inventory_clerk = "inventory_clerk"  # legacy alias
    logistics_manager = "logistics_manager"
    logistics_officer = "logistics_officer"  # legacy alias
    station_manager = "station_manager"  # legacy alias
    expedition_team = "expedition_team"
    field_member = "field_member"  # legacy alias
    maintenance_team = "maintenance_team"



class StorageCondition(str, enum.Enum):
    ambient = "ambient"
    chilled_0_4C = "chilled_0_4C"
    frozen_neg18C = "frozen_neg18C"
    deep_frozen_neg40C = "deep_frozen_neg40C"
    cryogenic = "cryogenic"
    hazmat = "hazmat"


class AssetStatus(str, enum.Enum):
    in_stock = "in_stock"
    issued = "issued"
    consumed = "consumed"
    expired = "expired"
    disposed = "disposed"


class ShipmentStatus(str, enum.Enum):
    planned = "planned"
    dispatched = "dispatched"
    in_transit = "in_transit"
    delayed = "delayed"
    arrived = "arrived"
    cancelled = "cancelled"


class TransportMode(str, enum.Enum):
    ship = "ship"
    aircraft = "aircraft"
    helicopter = "helicopter"
    snow_vehicle = "snow_vehicle"
    sledge = "sledge"


class QrEntityType(str, enum.Enum):
    asset_batch = "asset_batch"
    asset_unit = "asset_unit"
    shipment = "shipment"
    storage_bin = "storage_bin"


class ScanAction(str, enum.Enum):
    check_in = "check_in"
    check_out = "check_out"
    transfer = "transfer"
    issue = "issue"
    inspection = "inspection"


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AlertType(str, enum.Enum):
    expiry_approaching = "expiry_approaching"
    expired = "expired"
    low_stock = "low_stock"
    temperature_breach = "temperature_breach"
    overdue_shipment = "overdue_shipment"


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Stations & storage
# ---------------------------------------------------------------------------

class Station(Base):
    __tablename__ = "stations"

    station_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StorageUnit(Base):
    __tablename__ = "storage_units"

    storage_unit_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    station_id: Mapped[str] = mapped_column(String(36), ForeignKey("stations.station_id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    storage_condition: Mapped[StorageCondition] = mapped_column(SAEnum(StorageCondition), nullable=False)
    current_temp_c: Mapped[float | None] = mapped_column(Numeric(6, 2))
    target_temp_min_c: Mapped[float | None] = mapped_column(Numeric(6, 2))
    target_temp_max_c: Mapped[float | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StorageTemperatureLog(Base):
    __tablename__ = "storage_temperature_log"

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    storage_unit_id: Mapped[str] = mapped_column(String(36), ForeignKey("storage_units.storage_unit_id"), nullable=False)
    recorded_temp_c: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_breach: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class AssetDefinition(Base):
    __tablename__ = "asset_definitions"

    asset_def_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    default_storage_condition: Mapped[StorageCondition] = mapped_column(SAEnum(StorageCondition), default=StorageCondition.ambient, nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), default="unit", nullable=False)
    reorder_threshold: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AssetBatch(Base):
    __tablename__ = "asset_batches"

    batch_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    asset_def_id: Mapped[str] = mapped_column(String(36), ForeignKey("asset_definitions.asset_def_id"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    quantity_received: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantity_remaining: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), default="unit", nullable=False)
    station_id: Mapped[str] = mapped_column(String(36), ForeignKey("stations.station_id"), nullable=False)
    storage_unit_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("storage_units.storage_unit_id"))
    status: Mapped[AssetStatus] = mapped_column(SAEnum(AssetStatus), default=AssetStatus.in_stock, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    txn_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    asset_def_id: Mapped[str] = mapped_column(String(36), ForeignKey("asset_definitions.asset_def_id"), nullable=False)
    batch_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("asset_batches.batch_id"))
    txn_type: Mapped[str] = mapped_column(String(30), nullable=False)  # receipt, issue, consumption, disposal
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    station_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("stations.station_id"))
    performed_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.user_id"), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    txn_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# QR codes & scans
# ---------------------------------------------------------------------------

class QrCode(Base):
    __tablename__ = "qr_codes"

    qr_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    qr_token: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    entity_type: Mapped[QrEntityType] = mapped_column(SAEnum(QrEntityType), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class QrScanEvent(Base):
    __tablename__ = "qr_scan_events"

    scan_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    qr_id: Mapped[str] = mapped_column(String(36), ForeignKey("qr_codes.qr_id"), nullable=False)
    scanned_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.user_id"), nullable=False)
    action: Mapped[ScanAction] = mapped_column(SAEnum(ScanAction), nullable=False)
    station_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("stations.station_id"))
    notes: Mapped[str | None] = mapped_column(Text)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Shipments & tracking
# ---------------------------------------------------------------------------

class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    shipment_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    origin_station_id: Mapped[str] = mapped_column(String(36), ForeignKey("stations.station_id"), nullable=False)
    destination_station_id: Mapped[str] = mapped_column(String(36), ForeignKey("stations.station_id"), nullable=False)
    transport_mode: Mapped[TransportMode] = mapped_column(SAEnum(TransportMode), nullable=False)
    status: Mapped[ShipmentStatus] = mapped_column(SAEnum(ShipmentStatus), default=ShipmentStatus.planned, nullable=False)
    planned_departure: Mapped[datetime | None] = mapped_column(DateTime)
    planned_arrival: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ShipmentTrackingPoint(Base):
    __tablename__ = "shipment_tracking_points"

    tracking_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.shipment_id"), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    ambient_temp_c: Mapped[float | None] = mapped_column(Numeric(6, 2))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    alert_type: Mapped[AlertType] = mapped_column(SAEnum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(SAEnum(AlertSeverity), default=AlertSeverity.info, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    station_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("stations.station_id"))
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
