from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_token
from app.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except ValueError:
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*allowed_roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted to perform this action")
        return current_user
    return role_checker


require_admin = require_roles(UserRole.admin, UserRole.super_admin)
require_inventory = require_roles(UserRole.admin, UserRole.super_admin, UserRole.inventory_manager, UserRole.inventory_clerk)
require_logistics = require_roles(UserRole.admin, UserRole.super_admin, UserRole.logistics_manager, UserRole.logistics_officer, UserRole.station_manager)
require_expedition = require_roles(UserRole.admin, UserRole.super_admin, UserRole.expedition_team, UserRole.field_member, UserRole.logistics_manager)
require_maintenance = require_roles(UserRole.admin, UserRole.super_admin, UserRole.maintenance_team, UserRole.station_manager)
require_write = require_roles(
    UserRole.admin, UserRole.super_admin,
    UserRole.inventory_manager, UserRole.inventory_clerk,
    UserRole.logistics_manager, UserRole.logistics_officer, UserRole.station_manager,
    UserRole.expedition_team, UserRole.field_member,
    UserRole.maintenance_team,
)

