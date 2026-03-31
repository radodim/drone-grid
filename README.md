# Drone Grid

The purpose of this project is to create a system for operating drones in near real-time over the internet.
This includes live video streaming from the drone to the web browser of the client as well as duplex communication for control and telemetry.

The components of the system (and the tools used to implement said components) are:
- [Keycloak](https://www.keycloak.org/) for user authentication
	- regarding authorization - only the user roles are listed in Keycloak, the actual implementation of the authorization policy is in the backend
- Media server for video streaming ([mediamtx](https://mediamtx.org/))
	- RTSPS over TCP for device to media server communication
	- WebRTC for client browser to media server communication
	- the authentication of both the device and browser clients is handled by the backend, which is an [external for mediamtx HTTP server](https://mediamtx.org/docs/other/authentication#external-http-server), the auth flow in the backend is different depending on the type of client:
		- the drone's secret key is validated against the backend database and is authorized for the path that the device wants to publish/write the video stream to
		- the user's JWT token is forwarded to the backend where it is decoded in order to determine if the user is authorized to read the requested stream
- IoT message broker like [NATS](https://nats.io/)
	- to connect the user's input commands from the browser over websocket to the backend -> convert to mavlink -> publish mavlink commands to a topic to be consumed by drones (either over mqtt or websocket)
	- the drone also publishes telemetry to another topic that is consumed by the client in the browser
- Backend - FastAPI (RESTful HTTP API as well as websocket)
	- Exposes drone metadata and available streams of video and telemetry
	- captures user input (also supports the browser Gamepad API) converts it to mavlink and sends it to the drone over websocket
- User interface capabilities (React UI)
	- Register, remove, view drones as well as their live streams and telemetry data 
	- Gather user input either via the keyboard or the browser gamepad api and send it to the browser over websocket
- Raspberry Pi (with a 4G USB modem and v2 camera module) as the companion computer for flight controllers (e.g. px4)

For simplicity the entire deployment of this system is contained in one docker compose file for both local development and production.
Additional information can be found within DEPLOYMENT.md

# TODO: Integrate a registry to avoid cloning the source on the VPS