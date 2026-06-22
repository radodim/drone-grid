import uuid
from typing import Annotated

from fastapi import Depends
from sqlmodel import select

from app.data.db.model.drone import Drone
from app.data.db.session import DbSessionDep
from app.service.exceptions import NonExistentDroneException


class DroneService:
    # TODO: When needed import pagination, sorting, filtering, based on query string parameters
    def __init__(self, db_session: DbSessionDep) -> None:
        self.__db_session = db_session

    def get_all_drones(self) -> list[Drone]:
        return list(self.__db_session.exec(select(Drone)).all())

    def get_drones_for_user(self, user_id: uuid.UUID) -> list[Drone]:
        return list(
            self.__db_session.exec(
                select(Drone).where(Drone.creation_user_id == user_id)
            ).all()
        )

    def get_drone(self, drone_id: uuid.UUID) -> Drone:
        drone: Drone | None = self.__db_session.get(Drone, drone_id)
        if drone is None:
            raise NonExistentDroneException(f"Drone with id {drone_id} does not exist.")

        return drone

    def create_drone(self, drone_name: str, user_id: uuid.UUID) -> Drone:
        drone = Drone(name=drone_name, creation_user_id=user_id)
        self.__db_session.add(drone)
        self.__db_session.commit()
        self.__db_session.refresh(drone)

        return drone

    def delete_drone(self, drone: Drone) -> None:
        self.__db_session.delete(drone)
        self.__db_session.commit()


DroneServiceDep = Annotated[DroneService, Depends(DroneService)]
