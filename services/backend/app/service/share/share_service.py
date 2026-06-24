import secrets
import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import Depends
from sqlmodel import col, select

from app.data.db.model.drone_share import DroneShare
from app.data.db.session import DbSessionDep
from app.service.exceptions import InvalidShareTokenError
from app.utils import get_utcnow, sha256_hex

SHARE_TOKEN_PREFIX = "dgs_"  # used to differentiate the share token from a JWT


class ShareService:
    def __init__(self, db_session: DbSessionDep) -> None:
        self.__db_session = db_session

    def mint(
        self,
        drone_id: uuid.UUID,
        created_by: uuid.UUID,
        ttl_hours: int,
        label: str | None,
    ) -> tuple[DroneShare, str]:
        """Create a share; returns the row and the plaintext token (shown once)."""
        raw_token = SHARE_TOKEN_PREFIX + secrets.token_urlsafe(32)
        share = DroneShare(
            drone_id=drone_id,
            token_hash=sha256_hex(raw_token),
            label=label,
            creation_user_id=created_by,
            expiration_timestamp=get_utcnow() + timedelta(hours=ttl_hours),
        )
        self.__db_session.add(share)
        self.__db_session.commit()
        self.__db_session.refresh(share)
        return share, raw_token

    def resolve(self, raw_token: str) -> DroneShare:
        """Return the live share for a token, or raise if invalid/expired/revoked."""
        share = self.__db_session.exec(
            select(DroneShare).where(DroneShare.token_hash == sha256_hex(raw_token))
        ).first()
        if (
            share is None
            or share.revocation_timestamp is not None
            or share.expiration_timestamp < get_utcnow()
        ):
            raise InvalidShareTokenError("Share link is invalid, expired, or revoked.")
        return share

    def list_active(self, drone_id: uuid.UUID) -> list[DroneShare]:
        now = get_utcnow()
        return list(
            self.__db_session.exec(
                select(DroneShare).where(
                    DroneShare.drone_id == drone_id,
                    col(DroneShare.revocation_timestamp).is_(None),
                    DroneShare.expiration_timestamp > now,
                )
            ).all()
        )

    def get(self, drone_id: uuid.UUID, share_id: uuid.UUID) -> DroneShare:
        """Return an active share by id within a drone, or raise if it's
        missing, expired, revoked, or belongs to another drone."""
        share = self.__db_session.get(DroneShare, share_id)
        if (
            share is None
            or share.drone_id != drone_id
            or share.revocation_timestamp is not None
            or share.expiration_timestamp < get_utcnow()
        ):
            raise InvalidShareTokenError("Share not found.")
        return share

    def revoke(self, drone_id: uuid.UUID, share_id: uuid.UUID) -> None:
        share = self.get(drone_id, share_id)
        share.revocation_timestamp = get_utcnow()
        self.__db_session.add(share)
        self.__db_session.commit()


ShareServiceDep = Annotated[ShareService, Depends(ShareService)]
