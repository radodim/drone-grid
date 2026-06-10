import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, AsyncIterator, Awaitable, Callable

from mavsdk import System
from mavsdk.action import ActionError
from mavsdk.telemetry import Battery, FlightMode, GpsInfo, Health, Position

from app.exception.drone_exceptions import (
    DroneActionException,
    DroneInitializationException,
)
from app.models import (
    Arm,
    ControlInput,
    ControlMessage,
    Disarm,
    MavlinkTelemetry,
)
from app.models import (
    Gps as TelemetryGps,
)
from app.models import (
    Health as TelemetryHealth,
)
from app.models import (
    Position as TelemetryPosition,
)

logger = logging.getLogger(__name__)

MANUAL_CONTROL_STREAM_PERIOD_S = 0.02  # 50Hz
INPUT_STALE_AFTER_S = 0.5  # matches PX4's default RC-loss timeout (COM_RC_LOSS_T)


@dataclass
class TelemetryState:
    is_armed: bool | None = None
    is_in_air: bool | None = None
    battery: Battery | None = None
    flight_mode: FlightMode | None = None
    position: Position | None = None
    gps_info: GpsInfo | None = None
    health: Health | None = None
    link_connected: bool | None = None
    flight_controller_last_seen: datetime | None = None


# TODO: as part of next release - handle mid-flight restarts gracefully, current impl does not support manual control after a failure, cannot override RTH from Drone Grid
class DroneController:
    def __init__(
        self,
        connection_url: str,
        fc_connect_timeout: float = 20.0,
        fc_health_all_ok_timeout: float = 120.0,
    ) -> None:
        self.__drone: System = System()
        self.__connection_url: str = connection_url
        self.__fc_connect_timeout = fc_connect_timeout
        self.__fc_health_all_ok_timeout = fc_health_all_ok_timeout

        self.__initialized: bool = False
        self.__telemetry: TelemetryState = TelemetryState()
        self.__latest_input: tuple[ControlInput, float] | None = None
        self.__commands: asyncio.Queue[Arm | Disarm] = asyncio.Queue(maxsize=1)
        self.__command_handlers: dict[type, Callable[[Any], Awaitable[None]]] = {
            Arm: self.__handle_arm,
            Disarm: self.__handle_disarm,
        }

    @property
    def is_ready(self) -> bool:
        return self.__initialized and self.__telemetry.link_connected is True

    async def run(self) -> None:
        async with asyncio.TaskGroup() as task_group:
            await self.__connect_to_flight_controller()
            logger.info("Flight controller connected. waiting for health_all_ok...")

            self.__start_telemetry_consumers(task_group)
            task_group.create_task(self.__stream_manual_control())
            task_group.create_task(self.__process_commands())

            await self.__wait_for_health_all_ok()
            self.__initialized = True
            logger.info("Drone is ready to accept control commands.")

    async def __connect_to_flight_controller(self) -> None:
        await self.__drone.connect(system_address=self.__connection_url)
        logger.info("Waiting for flight controller connection...")
        await self.__wait_for_flight_controller_connection()

    async def __wait_for_flight_controller_connection(self) -> None:
        try:
            async with asyncio.timeout(self.__fc_connect_timeout):
                async for state in self.__drone.core.connection_state():
                    if state.is_connected:
                        return
        except asyncio.TimeoutError:
            raise DroneInitializationException(
                f"Companion failed to connect to flight controller in {self.__fc_connect_timeout}s"
            )

    def __start_telemetry_consumers(self, task_group: asyncio.TaskGroup) -> None:
        # Streams must be created after connect() — mavsdk's telemetry plugin
        # isn't initialized until the connection to mavsdk-server is up.
        # (rates may be tuned here, e.g. self.__drone.telemetry.set_rate_position(...))
        telemetry_streams = {
            "is_armed": self.__drone.telemetry.armed(),
            "is_in_air": self.__drone.telemetry.in_air(),
            "battery": self.__drone.telemetry.battery(),
            "flight_mode": self.__drone.telemetry.flight_mode(),
            "position": self.__drone.telemetry.position(),
            "gps_info": self.__drone.telemetry.gps_info(),
            "health": self.__drone.telemetry.health(),
        }
        for field, stream in telemetry_streams.items():
            task_group.create_task(self.__consume_telemetry_attr(field, stream))
        task_group.create_task(self.__consume_connection_state())
        task_group.create_task(self.__consume_status_text())

    async def __consume_telemetry_attr(
        self, field: str, stream: AsyncIterator[Any]
    ) -> None:
        async for value in stream:
            setattr(self.__telemetry, field, value)
            self.__telemetry.flight_controller_last_seen = datetime.now(UTC)

    async def __consume_connection_state(self) -> None:
        async for state in self.__drone.core.connection_state():
            self.__telemetry.link_connected = state.is_connected
            if state.is_connected:
                self.__telemetry.flight_controller_last_seen = datetime.now(UTC)
            else:
                logger.error("Flight controller link lost.")

    async def __consume_status_text(self) -> None:
        async for status_text in self.__drone.telemetry.status_text():
            logger.info(f"Status text from flight controller: '{status_text}'")

    async def __wait_for_health_all_ok(self) -> None:
        try:
            async with asyncio.timeout(self.__fc_health_all_ok_timeout):
                async for ok in self.__drone.telemetry.health_all_ok():
                    if ok:
                        return
        except asyncio.TimeoutError:
            raise DroneInitializationException(
                f"Did not receive 'health_all_ok' signal in {self.__fc_health_all_ok_timeout}s"
            )

    async def dispatch(self, msg: ControlMessage) -> None:
        command = msg.root
        if isinstance(command, ControlInput):
            self.__latest_input = (command, time.monotonic())
            return

        try:
            self.__commands.put_nowait(command)
        except asyncio.QueueFull:
            logger.warning(
                f"Dropping '{type(command).__name__}': another command is pending"
            )

    async def __stream_manual_control(self) -> None:
        while True:
            latest = self.__latest_input
            if latest is not None:
                control_input, received_at = latest
                if time.monotonic() - received_at <= INPUT_STALE_AFTER_S:
                    axes = control_input.axes
                    await self.__set_manual_control(
                        axes.pitch, axes.roll, axes.throttle, axes.yaw
                    )
            await asyncio.sleep(MANUAL_CONTROL_STREAM_PERIOD_S)

    async def __set_manual_control(
        self, pitch: float, roll: float, throttle: float, yaw: float
    ) -> None:
        await self.__drone.manual_control.set_manual_control_input(
            pitch, roll, throttle, yaw
        )

    async def __process_commands(self) -> None:
        while True:
            command = await self.__commands.get()
            handler = self.__command_handlers.get(type(command))
            if handler is None:
                logger.warning(f"No handler for command '{type(command).__name__}'")
                continue

            try:
                await handler(command)
            except Exception as e:
                name = type(command).__name__
                if isinstance(e, DroneActionException):
                    logger.error(f"Command '{name}' failed: {e}")
                else:
                    logger.exception(f"Unexpected error handling command '{name}'")

    async def __handle_arm(self, _: Arm) -> None:
        grounded_and_disarmed = (
            self.__telemetry.is_in_air is False and self.__telemetry.is_armed is False
        )
        if not grounded_and_disarmed:
            logger.warning(
                f"Ignoring arm: drone must be grounded and disarmed "
                f"(in_air={self.__telemetry.is_in_air}, armed={self.__telemetry.is_armed})."
            )
            return

        await self.__arm()
        await self.__wait_for_armed()
        await self.__enter_manual_control()

    async def __arm(self) -> None:
        health = self.__telemetry.health
        if health is None or not health.is_armable:
            logger.warning(
                "Ignoring arm command. Drone is not armable in the current state."
            )
            return

        logger.info("Arming drone...")
        try:
            await self.__drone.action.arm()
        except ActionError as e:
            raise DroneActionException(
                "Arm command rejected by the flight controller."
            ) from e

    async def __wait_for_armed(self, timeout: float = 5.0) -> None:
        try:
            async with asyncio.timeout(timeout):
                async for armed in self.__drone.telemetry.armed():
                    if armed:
                        logger.info("Drone is armed.")
                        return
        except asyncio.TimeoutError:
            logger.error("Timed out waiting for the drone to be armed.")
            raise DroneActionException(
                f"Drone did not switch to armed state in {timeout} seconds."
            )

        raise DroneActionException("Drone did not switch to the armed state.")

    async def __enter_manual_control(self) -> None:
        try:
            await self.__drone.manual_control.start_position_control()
        except Exception as e:
            raise DroneActionException("Failed to switch to POSCTL mode") from e

        logger.info("Armed and in POSCTL — manual control is enabled.")

    async def __handle_disarm(self, _: Disarm) -> None:
        # Safety gate mirroring __handle_arm: a refused disarm (e.g. mid-air)
        # must not fall through to the HOLD mode change below.
        armed_and_grounded = (
            self.__telemetry.is_armed is True and self.__telemetry.is_in_air is False
        )
        if not armed_and_grounded:
            logger.warning(
                f"Ignoring disarm: drone must be armed and grounded "
                f"(armed={self.__telemetry.is_armed}, in_air={self.__telemetry.is_in_air})."
            )
            return

        await self.__disarm()
        await self.__exit_manual_control()

    async def __disarm(self) -> None:
        logger.info("Disarming...")
        try:
            await self.__drone.action.disarm()
        except ActionError as e:
            raise DroneActionException("Disarm rejected by flight controller.") from e

    async def __exit_manual_control(self) -> None:
        try:
            await self.__drone.action.hold()
        except ActionError as e:
            raise DroneActionException("Failed to switch to HOLD mode.") from e

        logger.info("Disarmed and in HOLD.")

    def mavlink_telemetry(self) -> MavlinkTelemetry | None:
        if (
            self.__telemetry.flight_controller_last_seen is None
            or self.__telemetry.is_armed is None
            or self.__telemetry.is_in_air is None
            or self.__telemetry.flight_mode is None
        ):
            return None

        battery_percentage: float | None = None
        flight_time_remaining: float | None = None
        if self.__telemetry.battery is not None:
            battery_percentage = self.__telemetry.battery.remaining_percent
            flight_time_remaining = self.__telemetry.battery.time_remaining_s

        position = (
            TelemetryPosition(
                lat=self.__telemetry.position.latitude_deg,
                lon=self.__telemetry.position.longitude_deg,
                rel_alt=self.__telemetry.position.relative_altitude_m,
                abs_alt=self.__telemetry.position.absolute_altitude_m,
            )
            if self.__telemetry.position is not None
            else None
        )
        gps = (
            TelemetryGps(
                num_satellites=self.__telemetry.gps_info.num_satellites,
                fix_type=str(self.__telemetry.gps_info.fix_type),
            )
            if self.__telemetry.gps_info is not None
            else None
        )
        health = (
            TelemetryHealth(
                is_gyrometer_calibrated=self.__telemetry.health.is_gyrometer_calibration_ok,
                is_accelerometer_calibrated=self.__telemetry.health.is_accelerometer_calibration_ok,
                is_magnetometer_calibrated=self.__telemetry.health.is_magnetometer_calibration_ok,
                is_local_position_ok=self.__telemetry.health.is_local_position_ok,
                is_global_position_ok=self.__telemetry.health.is_global_position_ok,
                is_home_position_ok=self.__telemetry.health.is_home_position_ok,
                is_armable=self.__telemetry.health.is_armable,
            )
            if self.__telemetry.health is not None
            else None
        )

        return MavlinkTelemetry(
            flight_controller_last_seen=self.__telemetry.flight_controller_last_seen,
            is_armed=self.__telemetry.is_armed,
            is_in_air=self.__telemetry.is_in_air,
            flight_mode=str(self.__telemetry.flight_mode),
            battery_percentage=battery_percentage,
            flight_time_remaining=flight_time_remaining,
            position=position,
            gps=gps,
            health=health,
        )
