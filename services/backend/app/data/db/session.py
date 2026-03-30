from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine

from app.config import GLOBAL_APP_SETTINGS

engine = create_engine(GLOBAL_APP_SETTINGS.DATABASE_URL)


def create_db_and_tables():
    # TODO: system evolvability - integrate alembic to handle schema evolution
    SQLModel.metadata.create_all(engine)


def get_session():
    # TODO: see what it takes to implement async sessions
    with Session(engine) as session:
        yield session


DbSessionDep = Annotated[Session, Depends(get_session)]
