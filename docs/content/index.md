---
title: Home
hide:
  - navigation
  - toc
---

<div style="text-align: center; margin-top: -2.5rem;" markdown>

_An open-source cloud platform for operating drones in near real time._

</div>

<video controls muted playsinline poster="assets/video/landing-demo-poster.jpg" style="display: block; max-width: 720px; width: 100%; margin: 0 auto; border-radius: 8px;" src="assets/video/landing-demo.mp4"></video>

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

## Explore

<div class="grid cards" markdown>

-   :material-sitemap: **[Architecture](architecture/index.md)**

    Visual representation of the system architecture.

-   :material-quadcopter: **[Hardware](hardware/index.md)**

    Supported drone configurations, safety, setup instructions, companion computer and flight controller setup.

</div>
