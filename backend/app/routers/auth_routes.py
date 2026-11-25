from fastapi import APIRouter, Depends, HTTPException

from ..auth import authenticate, create_token, current_user
from ..schemas import LoginIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginIn):
    user = authenticate(body.username, body.password)
    if not user:
        raise HTTPException(401, "Incorrect username or password")
    return {"token": create_token(user), "user": user}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user
