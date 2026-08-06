from typing import Self

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # env vars take precedence over the vars in the env files specified here
    # env_file here is a fallback for running outside the container runtime (e.g. openapi client generation)
    # env vars are loaded from the same env files listed here for local development, for prod there are overrides
    model_config = SettingsConfigDict(
        env_file=("../../.env", "../../config/backend/.env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    ### DBMS config ####

    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    POSTGRES_DB: str

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    ### DBMS config ####

    ### Identity server config ###

    KEYCLOAK_INTERNAL_URL: str
    KEYCLOAK_URL: str | None = None  # public URL; single-sourced with KC_HOSTNAME
    KEYCLOAK_REALM: str
    KEYCLOAK_AUDIENCE: str

    @computed_field
    @property
    def KEYCLOAK_JWKS_URL(self) -> str:
        return f"{self.KEYCLOAK_INTERNAL_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @computed_field
    @property
    def KEYCLOAK_ISSUER(self) -> str | None:
        if not self.KEYCLOAK_URL:
            return None

        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"

    @model_validator(mode="after")
    def __require_issuer_pin_outside_local(self) -> Self:
        if self.ENVIRONMENT != "local" and self.KEYCLOAK_ISSUER is None:
            raise ValueError("KEYCLOAK_URL must be set when ENVIRONMENT is NOT local.")

        return self

    ### Identity server config ###

    ### Media server config ###

    MEDIAMTX_API_URL: str
    WEBRTC_BASE_URL: str

    ### Media server config ###

    ### Messaging config ###

    NATS_URL: str

    ### Messaging config ###

    ### Deployment config ###

    ENVIRONMENT: str
    CORS_ORIGINS: str  # comma-separated list of allowed origins

    @computed_field
    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    ### Deployment config ###


GLOBAL_APP_SETTINGS = Settings()  # type: ignore
