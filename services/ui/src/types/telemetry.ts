/**
 * Hand-written mirror of the backend telemetry schema
 * (services/backend/app/data/telemetry/model/telemetry.py).
 * If you change it there, change it here.
 */

export type CompanionState = "connecting" | "ready"

export interface Position {
  lat: number | null
  lon: number | null
  rel_alt: number | null
  abs_alt: number | null
}

export interface Gps {
  num_satellites: number | null
  fix_type: string | null
}

export interface Health {
  is_gyrometer_calibrated: boolean | null
  is_accelerometer_calibrated: boolean | null
  is_magnetometer_calibrated: boolean | null
  is_local_position_ok: boolean | null
  is_global_position_ok: boolean | null
  is_home_position_ok: boolean | null
  is_armable: boolean | null
}

export interface MavlinkTelemetry {
  /** ISO 8601 datetime, companion clock */
  flight_controller_last_seen: string
  is_armed: boolean
  is_in_air: boolean
  flight_mode: string
  battery_percentage: number | null
  flight_time_remaining: number | null
  position: Position | null
  gps: Gps | null
  health: Health | null
}

export interface Telemetry {
  companion_state: CompanionState
  /** ISO 8601 datetime, companion clock */
  companion_state_timestamp: string
  mavlink_telemetry: MavlinkTelemetry | null
}
