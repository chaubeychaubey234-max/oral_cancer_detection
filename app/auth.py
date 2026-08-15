from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _bcrypt_safe(plain: str) -> str:
    """bcrypt has a hard 72-byte limit on the input. Older bcrypt silently
    truncated; current bcrypt raises instead. Truncate explicitly here so
    behavior is identical and predictable across bcrypt versions."""
    return plain.encode("utf-8")[:72].decode("utf-8", errors="ignore")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_bcrypt_safe(plain), hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(_bcrypt_safe(plain))


def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    to_encode = {"sub": subject}
    if extra:
        to_encode.update(extra)
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*roles: str):
    """Dependency factory: require_role('doctor', 'admin')"""

    def _checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in roles and user.role != models.UserRole.ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient permissions for this action")
        return user

    return _checker