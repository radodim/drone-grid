import asyncio
import logging

from mavsdk import System
from mavsdk.action import ActionError
from mavsdk.telemetry import FlightMode
from messaging.client import MessagingClient
from models import (
    Arm,
    ControlInput,
    ControlMessage,
    Disarm,
    Land,
    Position,
    Takeoff,
    Telemetry,
)

logger = logging.getLogger(__name__)


async def _latest(async_iter):
    """Pull a single value from a mavsdk async iterator.

    mavsdk exposes telemetry as async iterators that yield indefinitely.
    For preflight checks and one-shot snapshots we want the current value,
    not an ongoing subscription — this helper does exactly that.
    """
    return await async_iter.__aiter__().__anext__()


class DroneController:
    """Owns every drone-facing operation: command handling, preflight
    guards, mode transitions, and telemetry publishing. mavsdk is only
    touched from inside this class so main.py stays orchestration-only.

    Preflight guards read fresh telemetry on every invocation — no cached
    state, mavsdk is the single source of truth. Invalid preconditions
    become a logged no-op rather than a state-corrupting mavsdk call.
    """

    def __init__(
        self,
        connection_url: str,
        messaging: MessagingClient,
        telemetry_freq: float = 2.0,  # Hz
    ) -> None:
        self._drone = System()
        self._connection_url = connection_url
        self._messaging = messaging
        self._telemetry_period = 1 / telemetry_freq

    async def connect(self) -> None:
        """Connect to the flight controller and wait until it's ready for
        commands. Must be awaited before any action or publish_telemetry call.

        Blocks indefinitely if the FC never connects or never reaches a
        fully-healthy state
        """
        await self._drone.connect(system_address=self._connection_url)

        logger.info("Waiting for drone to connect...")
        async for state in self._drone.core.connection_state():
            if state.is_connected:
                logger.info("Connected to drone!")
                break

        # Waits for PX4's full preflight check — sensor calibrations,
        # local/global/home position, is_armable — to all pass. This is the
        # MAVSDK readiness signal recommended for arming.
        # https://mavsdk.mavlink.io/main/en/cpp/guide/taking_off_landing.html
        logger.info("Waiting for drone to be ready (health_all_ok)...")
        await self._wait_for_health(timeout=None)
        logger.info("Drone is ready")

    async def dispatch(self, msg: ControlMessage) -> None:
        match msg.root:
            case ControlInput(axes=axes):
                await self._set_manual_control(
                    axes.pitch, axes.roll, axes.throttle, axes.yaw
                )
            case Arm():
                await self._arm()
            case Takeoff():
                await self._takeoff()
            case Land():
                await self._land()
            case Disarm():
                await self._disarm()

    async def publish_telemetry(self) -> None:
        while True:
            try:
                await self._messaging.publish_telemetry(await self._get_telemetry())
            except Exception as e:
                logger.error(f"Telemetry publish error: {e}")
            await asyncio.sleep(self._telemetry_period)

    # ── Action handlers — one per ControlMessage variant ──────────────────

    async def _arm(self) -> None:
        if await self._armed():
            logger.info("Ignoring arm: already armed")
            return
        if await self._airborne():
            logger.warning("Ignoring arm: drone is airborne (unexpected)")
            return
        # Defense in depth — connect() already waited for health_all_ok,
        # but health can degrade between connect and a re-arm (e.g. user
        # disarms after landing, EKF goes stale while idle). Re-check here
        # so the user gets "preflight not ready" instead of COMMAND_DENIED.
        if not await self._wait_for_health():
            logger.warning("Ignoring arm: preflight checks did not pass in time")
            return
        logger.info("Arming...")
        try:
            await self._drone.action.arm()
        except ActionError as e:
            logger.warning(f"Arm rejected by PX4: {e}")
            return
        # action.arm() returns when PX4 acks the command, but armed=True
        # in telemetry takes a beat longer to flip. Without this wait the
        # next mode-change call (start_position_control) races the arming
        # state machine and PX4 silently drops the mode-change ack.
        # https://mavsdk.mavlink.io/main/en/cpp/guide/taking_off_landing.html#arming
        await self._wait_for_armed()
        # MAVSDK's start_position_control() docs: "Requires manual control
        # input to be sent regularly already." If we hit the mode change
        # before a stream is flowing, PX4 rejects it or trips RC-loss
        # failsafe (COM_RC_LOSS_T = 0.5s). We send half a second of neutral
        # frames at 20 Hz to satisfy the precondition before the UI's
        # gamepad stream takes over.
        # https://mavsdk.mavlink.io/main/en/cpp/api_reference/classmavsdk_1_1_manual_control.html#classmavsdk_1_1_manual_control_1a4e3b0094ec1f9d2a3a2cc59afb71fbe7
        await self._warm_up_manual_control()
        await self._drone.manual_control.start_position_control()
        logger.info("Armed and in POSCTL — sticks live")

    async def _takeoff(self) -> None:
        if not await self._armed():
            logger.info("Ignoring takeoff: not armed")
            return
        if await self._airborne():
            logger.info("Ignoring takeoff: already airborne")
            return
        logger.info("Taking off")
        try:
            await self._drone.action.takeoff()
        except ActionError as e:
            logger.warning(f"Takeoff rejected by PX4: {e}")
            return
        # action.takeoff() overrides PX4 into AUTO_TAKEOFF → AUTO_LOITER
        # (reported as HOLD). Wait for HOLD, then return control to the
        # pilot via POSCTL so sticks become live again.
        await self._wait_for_mode(FlightMode.HOLD)
        await self._drone.manual_control.start_position_control()
        logger.info("Hovering in POSCTL — sticks live")

    async def _land(self) -> None:
        if not await self._airborne():
            logger.info("Ignoring land: not airborne")
            return
        logger.info("Landing")
        try:
            await self._drone.action.land()
        except ActionError as e:
            logger.warning(f"Land rejected by PX4: {e}")
            return
        # AUTO_LAND self-disarms on touchdown; in_air flips False once
        # PX4's landing detector fires.
        await self._wait_for_ground()
        logger.info("Landed")

    async def _disarm(self) -> None:
        if not await self._armed():
            logger.info("Ignoring disarm: already disarmed")
            return
        if await self._airborne():
            # Disarming mid-flight drops the drone out of the sky. If an
            # emergency motor-off is ever needed, that belongs in a
            # separate Kill message, not on this button.
            logger.warning("Ignoring disarm: drone is airborne")
            return
        logger.info("Disarming")
        try:
            await self._drone.action.disarm()
        except ActionError as e:
            logger.warning(f"Disarm rejected by PX4: {e}")

    async def _set_manual_control(
        self, pitch: float, roll: float, throttle: float, yaw: float
    ) -> None:
        await self._drone.manual_control.set_manual_control_input(
            pitch, roll, throttle, yaw
        )

    # ── Internal helpers ─────────────────────────────────────────────────

    async def _armed(self) -> bool:
        return await _latest(self._drone.telemetry.armed())

    async def _airborne(self) -> bool:
        return await _latest(self._drone.telemetry.in_air())

    async def _wait_for_health(self, timeout: float | None = 30.0) -> bool:
        """Wait until PX4 reports all health checks passing — covers
        preflight, sensor calibrations, and position estimates in one
        signal. Returns True on success, False on timeout. Pass
        `timeout=None` to wait indefinitely; in that case the only
        return is True (or hang forever if the drone never recovers).
        """

        async def _wait() -> bool:
            async for ok in self._drone.telemetry.health_all_ok():
                if ok:
                    return True
            return False

        if timeout is None:
            return await _wait()
        try:
            async with asyncio.timeout(timeout):
                return await _wait()
        except asyncio.TimeoutError:
            logger.warning(f"Drone did not become healthy within {timeout}s")
            return False

    async def _wait_for_armed(self, timeout: float = 5.0) -> None:
        """Wait for armed=True in telemetry after a successful arm command.
        Bounded to avoid deadlock if PX4 acked the arm but never
        flipped armed=True — downstream mode-change calls will
        fail informatively instead of hanging the dispatch loop.
        """
        try:
            async with asyncio.timeout(timeout):
                async for armed in self._drone.telemetry.armed():
                    if armed:
                        return
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for the drone to be armed.")

    async def _warm_up_manual_control(
        self, frames: int = 10, freq: float = 20.0
    ) -> None:
        period = 1 / freq
        for _ in range(frames):
            await self._drone.manual_control.set_manual_control_input(
                0.0, 0.0, 0.0, 0.0
            )
            await asyncio.sleep(period)

    async def _wait_for_mode(self, target: FlightMode, timeout: float = 30.0) -> None:
        """Wait for PX4 to report the given flight mode"""
        try:
            async with asyncio.timeout(timeout):
                async for mode in self._drone.telemetry.flight_mode():
                    if mode == target:
                        return
        except asyncio.TimeoutError:
            logger.warning(f"Timed out waiting for flight mode {target.name}")

    async def _wait_for_ground(self, timeout: float = 120.0) -> None:
        """Wait for PX4's landing detector to flip in_air=False"""
        try:
            async with asyncio.timeout(timeout):
                async for airborne in self._drone.telemetry.in_air():
                    if not airborne:
                        return
        except asyncio.TimeoutError:
            logger.warning(
                "Timed out waiting for landing detector to flip in_air=False"
            )

    async def _get_telemetry(self) -> Telemetry:
        battery = await _latest(self._drone.telemetry.battery())
        armed = await _latest(self._drone.telemetry.armed())
        flight_mode = await _latest(self._drone.telemetry.flight_mode())
        position = await _latest(self._drone.telemetry.position())
        return Telemetry(
            armed=armed,
            mode=str(flight_mode),
            battery=battery.remaining_percent,
            position=Position(
                lat=position.latitude_deg,
                lon=position.longitude_deg,
                alt=position.relative_altitude_m,
            ),
        )
