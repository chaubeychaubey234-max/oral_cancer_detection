from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import authenticate_user, create_access_token, get_current_user, hash_password
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Open registration for the hackathon build. In a real deployment this
    would be admin-only / invite-only for health workers & doctors.
    """
    if payload.role not in ("health_worker", "doctor", "admin"):
        raise HTTPException(400, "role must be one of health_worker, doctor, admin")

    existing = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing:
        raise HTTPException(400, "username already taken")

    user = models.User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=models.UserRole(payload.role),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=user.username, extra={"role": user.role.value})
    return schemas.Token(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
