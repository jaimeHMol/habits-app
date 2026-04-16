import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlmodel import Session, select
from src.infrastructure.database import get_session
from src.domain.models import User, InvitationCode
from src.api.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    full_name: str
    username: str
    password: str
    invitation_code: str


class InvitationResponse(BaseModel):
    code: str


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """
    Authenticates the user against the database securely.
    """
    statement = select(User).where(User.username == form_data.username)
    user = session.exec(statement).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterRequest,
    session: Session = Depends(get_session),
):
    """
    Registers a new user using a valid invitation code.
    """
    # 1. Validate invitation code
    statement = select(InvitationCode).where(
        InvitationCode.code == data.invitation_code
    )
    invite = session.exec(statement).first()

    if not invite or invite.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used invitation code",
        )

    # 2. Check if username already exists
    user_stmt = select(User).where(User.username == data.username)
    existing_user = session.exec(user_stmt).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # 3. Create user
    new_user = User(
        username=data.username,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role="user",
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # 4. Mark invite as used
    invite.is_used = True
    invite.used_by_id = new_user.id
    session.add(invite)
    session.commit()

    return {"message": "User registered successfully"}


@router.post("/invitations/generate", response_model=InvitationResponse)
def generate_invitation(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Generates a new one-time invitation code. Admin only.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can generate invitations",
        )

    # Generate a random 8-character code
    code = "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)
    )
    code = f"PRM-{code}"

    new_invite = InvitationCode(
        code=code,
        created_by_id=current_user.id,
    )
    session.add(new_invite)
    session.commit()

    return {"code": code}
