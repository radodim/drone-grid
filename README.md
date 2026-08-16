<p align="center">
  <img src="services/ui/public/favicon.svg" width="140" alt="Drone Grid icon" />
</p>

<h1 align="center">Drone Grid</h1>

<p align="center"><em>An open-source cloud platform for operating drones in near real time.</em><p>

---
<p align="center">
  <a href="docs/content/assets/video/landing-demo.mp4">
    <img src="docs/content/assets/video/readme_poster.jpg" alt="Drone Grid flight" width="640" />
  </a>
</p>


<div align="center">

| [Public Drone Grid instance](https://drone-grid.com) | [Documentation](https://docs.drone-grid.com) |
| ---------------------------------------------------- | -------------------------------------------- |

</div>

> [!WARNING]
> This system is currently in an experimental state. [Recommendations](https://docs.drone-grid.com/hardware/) can be found in the documentation, but they are no substitute for your local laws and regulations — you are solely responsible for complying with the legal framework applicable in your area when controlling unmanned aerial vehicles.

## Quick start for local development and testing

**Prerequisites:** [Docker](https://docs.docker.com/engine/install/) or a Docker Compose-compatible container runtime.

- Linux (tested on Ubuntu 24.04 LTS) & macOS

```shell
bash scripts/run_drone_grid.sh
```

Then open a browser on any computer that is connected to your local area network and access your Drone Grid instance over mDNS:
```
http://<HOSTNAME_OF_YOUR_MACHINE>.local
```

You may then register a user within the system and proceed with configuring your first drone.
Local registration asks for email verification — the message lands in the bundled mail sink at `http://localhost:8025` (mailpit); open it and click the link.

Windows has not been tested for development.
mDNS may not work as expected with WSL and virtualization in general.
Currently, dual booting Ubuntu is the recommended solution for running Drone Grid locally on a Windows machine.

## Policies

Operational runbooks: [docs/OPERATIONS.md](docs/OPERATIONS.md) · [docs/PRIVACY_OPS.md](docs/PRIVACY_OPS.md) · vulnerability reporting: [SECURITY.md](SECURITY.md).
The hosted service's [Terms of Service](https://drone-grid.com/terms) and [Privacy Policy](https://drone-grid.com/privacy) are maintained in [services/ui/src/legal/](services/ui/src/legal/).
