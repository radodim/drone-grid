import asyncio
import logging

from mavsdk import System
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
        telemetry_topic: str,
        telemetry_freq: float = 2.0,  # Hz
    ) -> None:
        self._drone = System()
        self._connection_url = connection_url
        self._messaging = messaging
        self._telemetry_topic = telemetry_topic
        self._telemetry_period = 1 / telemetry_freq

    async def connect(self) -> None:
        """Connect to the flight controller and wait until it's ready for
        commands. Must be awaited before any action or publish_telemetry call.

        Blocks indefinitely if the FC never connects or never reaches GPS
        lock — callers own the lifecycle decision about timing out.
        """
        await self._drone.connect(system_address=self._connection_url)

        logger.info("Waiting for drone to connect...")
        async for state in self._drone.core.connection_state():
            if state.is_connected:
                logger.info("Connected to drone!")
                break

        logger.info("Waiting for global position estimate...")
        async for health in self._drone.telemetry.health():
            if health.is_global_position_ok and health.is_home_position_ok:
                logger.info("Global position estimate OK")
                break

    # ── Actions — one per incoming control message ───────────────────────

    async def arm(self) -> None:
        if await self._armed():
            logger.info("Ignoring arm: already armed")
            return
        if await self._airborne():
            logger.warning("Ignoring arm: drone is airborne (unexpected)")
            return
        logger.info("Arming")
        await self._drone.action.arm()
        # PX4 accepts start_position_control() only once the manual_control
        # stream is flowing at ≥10 Hz. Send half a second of neutral frames
        # ourselves so the mode switch doesn't trip an RC-loss failsafe on
        # the UI's stream establishing late.
        await self._warm_up_manual_control()
        await self._drone.manual_control.start_position_control()
        logger.info("Armed and in POSCTL — sticks live")

    async def takeoff(self) -> None:
        if not await self._armed():
            logger.info("Ignoring takeoff: not armed")
            return
        if await self._airborne():
            logger.info("Ignoring takeoff: already airborne")
            return
        logger.info("Taking off")
        await self._drone.action.takeoff()
        # action.takeoff() overrides PX4 into AUTO_TAKEOFF → AUTO_LOITER
        # (reported as HOLD). Wait for HOLD, then return control to the
        # pilot via POSCTL so sticks become live again.
        await self._wait_for_mode(FlightMode.HOLD)
        await self._drone.manual_control.start_position_control()
        logger.info("Hovering in POSCTL — sticks live")

    async def land(self) -> None:
        if not await self._airborne():
            logger.info("Ignoring land: not airborne")
            return
        logger.info("Landing")
        await self._drone.action.land()
        # AUTO_LAND self-disarms on touchdown; in_air flips False once
        # PX4's landing detector fires.
        await self._wait_for_ground()
        logger.info("Landed")

    async def disarm(self) -> None:
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
        await self._drone.action.disarm()

    async def set_manual_control(
        self, pitch: float, roll: float, throttle: float, yaw: float
    ) -> None:
        await self._drone.manual_control.set_manual_control_input(
            pitch, roll, throttle, yaw
        )

    # ── Dispatch — a bound method matching MessageHandler[ControlMessage] ─

    async def dispatch(self, msg: ControlMessage) -> None:
        match msg.root:
            case ControlInput(a=a):
                await self.set_manual_control(*a)
            case Arm():
                await self.arm()
            case Takeoff():
                await self.takeoff()
            case Land():
                await self.land()
            case Disarm():
                await self.disarm()

    # ── Loop — spawned once as a background task ─────────────────────────

    async def publish_telemetry(self) -> None:
        while True:
            try:
                await self._messaging.publish(
                    self._telemetry_topic, await self._snapshot()
                )
            except Exception as e:
                logger.error(f"Telemetry publish error: {e}")
            await asyncio.sleep(self._telemetry_period)

    # ── Internal helpers ─────────────────────────────────────────────────

    async def _snapshot(self) -> Telemetry:
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

    async def _armed(self) -> bool:
        return await _latest(self._drone.telemetry.armed())

    async def _airborne(self) -> bool:
        return await _latest(self._drone.telemetry.in_air())

    async def _warm_up_manual_control(self, frames: int = 10, hz: float = 20.0) -> None:
        period = 1 / hz
        for _ in range(frames):
            await self._drone.manual_control.set_manual_control_input(
                0.0, 0.0, 0.0, 0.0
            )
            await asyncio.sleep(period)

    async def _wait_for_mode(self, target: FlightMode) -> None:
        async for mode in self._drone.telemetry.flight_mode():
            if mode == target:
                return

    async def _wait_for_ground(self) -> None:
        async for airborne in self._drone.telemetry.in_air():
            if not airborne:
                return
