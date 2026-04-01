from pydantic import computed_field
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
    KEYCLOAK_REALM: str
    KEYCLOAK_AUDIENCE: str

    @computed_field
    @property
    def KEYCLOAK_JWKS_URL(self) -> str:
        return f"{self.KEYCLOAK_INTERNAL_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    ### Identity server config ###

    ### Media server config ###

    MEDIAMTX_API_URL: str
    WEBRTC_BASE_URL: str

    ### Media server config ###

    ### Deployment config ###

    ENVIRONMENT: str
    CORS_ORIGINS: str  # comma-separated list of allowed origins

    @computed_field
    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    ### Deployment config ###


GLOBAL_APP_SETTINGS = Settings()  # type: ignore
