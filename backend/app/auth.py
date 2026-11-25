"""JWT authentication + role-based access control (RBAC)."""
import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .db import query

SECRET_KEY = os.getenv("JWT_SECRET", "change-this-to-a-long-random-string")
ALGORITHM = "HS256"
TOKEN_MINUTES = 480

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def authenticate(username: str, password: str):
    # Password check happens inside PostgreSQL: bcrypt via pgcrypto crypt()
    return query(
        """SELECT user_id, username, role, doctor_id, patient_id
             FROM app_user
            WHERE username = %s AND active
              AND password_hash = crypt(%s, password_hash)""",
        (username, password),
        one=True,
    )


def create_token(user: dict) -> str:
    payload = {"sub": str(user["user_id"]), "exp": datetime.utcnow() + timedelta(minutes=TOKEN_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def current_user(token: str = Depends(oauth2_scheme)) -> dict:
    cred_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(data["sub"])
    except (JWTError, KeyError, ValueError):
        raise cred_error
    user = query(
        "SELECT user_id, username, role, doctor_id, patient_id FROM app_user WHERE user_id = %s AND active",
        (user_id,),
        one=True,
    )
    if not user:
        raise cred_error
    return user


def require_roles(*roles: str):
    def checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action")
        return user

    return checker
