from datetime import date, datetime
from pydantic import BaseModel, EmailStr

from app.models import (
    UserRole, StorageCondition, AssetStatus, ShipmentStatus, TransportMode,
    QrEntityType, ScanAction, AlertSeverity, AlertType,
)


# --- Auth ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    employee_code: str
    full_name: str
    email: EmailStr
    password: str
    role: UserRole


class UserOut(BaseModel):
    user_id: str
    employee_code: str
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


# --- Stations ---

class StationCreate(BaseModel):
    code: str
    name: str
    latitude: float | None = None
    longitude: float | None = None


class StationOut(BaseModel):
    station_id: str
    code: str
    name: str
    latitude: float | None
    longitude: float | None
    is_active: bool

    class Config:
        from_attributes = True


class StorageUnitCreate(BaseModel):
    station_id: str
    code: str
    name: str
    storage_condition: StorageCondition
    target_temp_min_c: float | None = None
    target_temp_max_c: float | None = None


class StorageUnitOut(BaseModel):
    storage_unit_id: str
    station_id: str
    code: str
    name: str
    storage_condition: StorageCondition
    current_temp_c: float | None
    target_temp_min_c: float | None
    target_temp_max_c: float | None

    class Config:
        from_attributes = True


class TemperatureLogCreate(BaseModel):
    storage_unit_id: str
    recorded_temp_c: float


class TemperatureLogOut(BaseModel):
    log_id: int
    storage_unit_id: str
    recorded_temp_c: float
    recorded_at: datetime
    is_breach: bool

    class Config:
        from_attributes = True


# --- Inventory ---

class AssetDefinitionCreate(BaseModel):
    sku: str
    name: str
    category: str
    default_storage_condition: StorageCondition = StorageCondition.ambient
    unit_of_measure: str = "unit"
    reorder_threshold: float = 0


class AssetDefinitionOut(BaseModel):
    asset_def_id: str
    sku: str
    name: str
    category: str
    default_storage_condition: StorageCondition
    unit_of_measure: str
    reorder_threshold: float

    class Config:
        from_attributes = True


class AssetBatchCreate(BaseModel):
    asset_def_id: str
    batch_number: str
    expiry_date: date | None = None
    quantity_received: float
    unit_of_measure: str = "unit"
    station_id: str
    storage_unit_id: str | None = None


class AssetBatchOut(BaseModel):
    batch_id: str
    asset_def_id: str
    batch_number: str
    expiry_date: date | None
    quantity_received: float
    quantity_remaining: float
    unit_of_measure: str
    station_id: str
    storage_unit_id: str | None
    status: AssetStatus

    class Config:
        from_attributes = True


class IssueFefoRequest(BaseModel):
    asset_def_id: str
    station_id: str
    quantity: float
    remarks: str | None = None


class InventoryTransactionOut(BaseModel):
    txn_id: str
    asset_def_id: str
    batch_id: str | None
    txn_type: str
    quantity: float
    performed_by: str
    txn_at: datetime

    class Config:
        from_attributes = True


class ExpiringBatchOut(BaseModel):
    batch_id: str
    asset_name: str
    quantity_remaining: float
    unit_of_measure: str
    expiry_date: date | None
    days_to_expiry: int | None
    station_name: str


# --- QR ---

class QrGenerateRequest(BaseModel):
    entity_type: QrEntityType
    entity_id: str


class QrCodeOut(BaseModel):
    qr_id: str
    qr_token: str
    entity_type: QrEntityType
    entity_id: str
    is_active: bool
    qr_image_base64: str | None = None

    class Config:
        from_attributes = True


class QrScanRequest(BaseModel):
    qr_token: str
    action: ScanAction
    station_id: str | None = None
    notes: str | None = None


class QrScanEventOut(BaseModel):
    scan_id: int
    qr_id: str
    scanned_by: str
    action: ScanAction
    station_id: str | None
    notes: str | None
    scanned_at: datetime

    class Config:
        from_attributes = True


class EntityHistoryOut(BaseModel):
    entity_type: str
    entity_id: str
    scans: list[QrScanEventOut]


# --- Shipments ---

class ShipmentCreate(BaseModel):
    shipment_code: str
    origin_station_id: str
    destination_station_id: str
    transport_mode: TransportMode
    planned_departure: datetime | None = None
    planned_arrival: datetime | None = None


class ShipmentUpdate(BaseModel):
    status: ShipmentStatus | None = None


class ShipmentOut(BaseModel):
    shipment_id: str
    shipment_code: str
    origin_station_id: str
    destination_station_id: str
    transport_mode: TransportMode
    status: ShipmentStatus
    planned_departure: datetime | None
    planned_arrival: datetime | None

    class Config:
        from_attributes = True


class TrackingPointCreate(BaseModel):
    shipment_id: str
    latitude: float
    longitude: float
    ambient_temp_c: float | None = None


class TrackingPointOut(BaseModel):
    tracking_id: int
    shipment_id: str
    latitude: float
    longitude: float
    ambient_temp_c: float | None
    recorded_at: datetime

    class Config:
        from_attributes = True


# --- Alerts ---

class AlertOut(BaseModel):
    alert_id: str
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    station_id: str | None
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
