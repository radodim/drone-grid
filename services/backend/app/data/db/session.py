from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, create_engine

from app.config import GLOBAL_APP_SETTINGS

engine = create_engine(GLOBAL_APP_SETTINGS.DATABASE_URL)


def get_session():
    # TODO: see what it takes to implement async sessions
    with Session(engine) as session:
        yield session


DbSessionDep = Annotated[Session, Depends(get_session)]
