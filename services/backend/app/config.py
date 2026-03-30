from pydantic import computed_field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # pydantic automatically maps fields to environment variables, no need to do os.environ["<ENV_VAR_NAME>"]

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

    @computed_field
    @property
    def KEYCLOAK_JWKS_URL(self) -> str:
        return f"{self.KEYCLOAK_INTERNAL_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    ### Identity server config ###

    ### Media server config ###

    MEDIAMTX_API_URL: str
    WEBRTC_BASE_URL: str

    ### Media server config ###


GLOBAL_APP_SETTINGS = Settings()  # type: ignore
