---
title: Home
hide:
  - navigation
  - toc
---

<div style="text-align: center; margin-top: -2.5rem;" markdown>

_An open-source cloud platform for operating drones in near real time._

</div>

<video controls muted playsinline poster="assets/video/readme_poster.jpg" style="display: block; max-width: 720px; width: 100%; margin: 0 auto; border-radius: 8px;" src="assets/video/landing-demo.mp4"></video>

<div style="text-align: center;" markdown>

[:material-quadcopter: Try the public Drone Grid instance](https://drone-grid.com){ .md-button .md-button--primary }

</div>

!!! warning "Experimental system"

    This system is currently in an experimental state. [Recommendations](hardware/index.md) can be found in the documentation, but they are no substitute for your local laws and regulations — you are solely responsible for complying with the legal framework applicable in your area when controlling unmanned aerial vehicles.

## Quick start for local development and testing

**Prerequisites:** [Docker](https://docs.docker.com/engine/install/) or a Docker Compose-compatible container runtime.

- Linux (tested on Ubuntu 24.04 LTS) & macOS

``` shell
bash scripts/run_drone_grid.sh
```

Then open a browser on any computer that is connected to your local area network and access your Drone Grid instance over mDNS:

``` text
http://<HOSTNAME_OF_YOUR_MACHINE>.local
```

You may then register a user within the system and proceed with configuring your first drone.

Windows has not been tested for development.
mDNS may not work as expected with WSL and virtualization in general.
Currently, dual booting Ubuntu is the recommended solution for running Drone Grid locally on a Windows machine.

### Fly a simulated drone (PX4 SITL)

No aircraft required — the local stack can fly a simulated PX4 drone with a virtual camera (Gazebo):

1. In the UI, go to **Drones → Add Drone**, give it a name and copy the generated `DRONE_ID` / `DRONE_SECRET`.
2. In `compose.override.yaml`, uncomment the `px4-sitl` and `companion` blocks and paste the credentials into the `companion` service's environment.
3. Start the new services (the first run downloads the PX4 SITL image — give Gazebo a minute to boot):

    ``` shell
    docker compose up -d px4-sitl companion
    ```

4. Back in the Drones view the drone goes **Live** — open it to see the simulated camera feed and telemetry, then arm and fly it from the browser.

!!! Info "Simulation performance"

    The simulation is really slow (tested on a Mac mini M4) and is not representative of the system's performance on a real UAV — video and control latency are much lower on real hardware. It is nevertheless a useful instrument for testing.
    There is a plan to enhance this with Simulation as a service, backed by proper GPU infrastructure — see the [roadmap](roadmap.md).

## Explore

<div class="grid cards" markdown>

-   :material-sitemap: **[Architecture](architecture/index.md)**

    Visual representation of the system architecture.

-   :material-quadcopter: **[Hardware](hardware/index.md)**

    Supported drone configurations, safety, setup instructions, companion computer and flight controller setup.

</div>
