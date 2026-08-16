# Companion setup

### Flashing the SD card with Raspberry OS Lite 64-bit (Trixie 13.4)

For this purpose [Raspberry Pi Imager](https://www.raspberrypi.com/software/) is used.
Enabling SSH & connecting to your Wi-Fi network is recommended.

### Configuring the companion with the utility script

!!! Info "The plan is to have fully automated companion onboarding (including credential generation via device grant authorization) but at this point in time there is some manual intervention"

Run the following commands and enter your password when prompted:

``` shell
sudo apt update
sudo apt upgrade -y
sudo apt install git -y

cd && git clone https://github.com/radodim/drone-grid.git
cd drone-grid && bash services/companion/deploy/install.sh
```

You should see the following output at the end:

```
[INFO] Done. Next steps:
  1. Edit secrets within the file: /etc/drone-grid/companion.env
  2. Start control: sudo systemctl start drone-grid-companion
  3. Start video: sudo systemctl start drone-grid-video
  4. Logs: journalctl -u drone-grid-companion -f (or -u drone-grid-video)
```

### Video systemd service test

Go to either the [central Drone Grid instance](https://drone-grid.com) if you are registered there or your local one to generate creds for the drone.
Within the Drones menu click Add Drone (give it a name) and copy the credentials.

Edit the companion.env at the location /etc/drone-grid/companion.env and paste the DRONE_ID & DRONE_SECRET pair.
If using a local Drone Grid instance follow the instructions within the comments in the .env file

``` shell
# Drone Grid companion configuration

DRONE_ID=<THE_ID_YOU_JUST_COPIED>
DRONE_SECRET=<THE_SECRET_YOU_JUST_COPIED>

CONTROL__CONNECTION_URL=udpin://0.0.0.0:14540
CONTROL__MESSAGING_URL=wss://api.drone-grid.com/api/v1/companion # Or your local instance with ws://<YOUR_MACHINES_MDNS>:8000/api/v1/companion

WHIP_URL=https://webrtc.drone-grid.com # Or your local instance with http://<YOUR_MACHINES_MDNS>:8889
```

Save the file, start the systemd service and check the logs:

``` shell
sudo systemctl start drone-grid-video
journalctl -u drone-grid-video -f 
```

If there are no errors in the logs go to the Drone Grid UI - within the Drones view the green Live status is clickable and clicking it navigates you to the live video feed.

TODO: Validate glass-to-glass between SD cards

### Control configuration and test

We've got a working video stream but no control - what good is that on its own?
The networking setup instructions are based on [PX4's instructions for companion ethernet setup](https://docs.px4.io/v1.16/en/advanced_config/ethernet_setup#ubuntu-ethernet-network-setup).

Create and apply the following network configuration:

``` shell
sudo install -m 600 /dev/stdin /etc/netplan/01-network-manager-all.yaml <<EOF
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    fc-link:
      match:
        macaddress: "$(cat /sys/class/net/eth0/address)"
      dhcp4: false
      dhcp6: false
      optional: true
      addresses:
        - 10.41.10.1/24
EOF

sudo netplan apply
```

Some time is needed for the config to actually apply **and the drone must be connected to the companion via the ETH cable that comes with the X650 dev kit**.
The drone should also be on and [configured](drone-setup.md).
Here is what the configuring state looks like vs connected and the expected output of the ip route command after that.

``` shell
$ nmcli | grep eth0
eth0: connecting (getting IP configuration) to netplan-eth0

$ nmcli | grep eth0
eth0: connected to netplan-fc-link

$ ip route get 10.41.10.2
10.41.10.2 dev eth0 src 10.41.10.1 uid 1000
```

When the status switches to connected you can examine the logs of the systemd service of the companion (the control component)

``` shell
$ sudo systemctl start drone-grid-companion
$ journalctl -u drone-grid-companion -f
Aug 16 16:45:46 dgpi systemd[1]: Started drone-grid-companion.service - Drone Grid companion.
Aug 16 16:45:54 dgpi python[1099]: INFO:mavsdk_server:MAVSDK version: v3.15.0 (mavsdk_impl.cpp:33)
Aug 16 16:45:54 dgpi python[1099]: INFO:app.messaging.drone_grid.drone_grid:Connected to drone-grid messaging at wss://api.drone-grid.com/api/v1/companion
Aug 16 16:45:54 dgpi python[1099]: INFO:mavsdk_server:Waiting to discover system on udpin://0.0.0.0:14540... (connection_initiator.h:20)
Aug 16 16:58:45 dgpi python[1099]: INFO:mavsdk_server:New system on: 10.41.10.2:14540 (system ID: 1) (udp_connection.cpp:263)
Aug 16 16:58:45 dgpi python[1099]: INFO:mavsdk_server:System discovered (connection_initiator.h:62)
Aug 16 16:58:46 dgpi python[1099]: INFO:mavsdk_server:Server started (grpc_server.cpp:177)
Aug 16 16:58:46 dgpi python[1099]: INFO:mavsdk_server:Server set to listen on 0.0.0.0:50051 (grpc_server.cpp:178)
Aug 16 17:00:06 dgpi python[1099]: INFO:app.drone.controller:Waiting for flight controller connection...
Aug 16 17:00:06 dgpi python[1099]: INFO:app.drone.controller:Flight controller connected. Streaming telemetry and accepting commands.
```

If you see the message "Streaming telemetry and accepting commands" in the logs, when clicking on the live stream in the UI (video must be up also) you will now see the live telemetry also.

### 5G/4G modem connection

Initially a 4G USB Modem was used (can be seen in the images) but the connection across restarts would take a really long time.
Another interesting observation is that for the **initial** connection to work (during one 24-hour period) the SIM card had to be used through a phone.

After a while the modem became more and more unreliable. As a temporary solution an old phone is currently used as a mobile hotspot onboard.
Surprisingly, this works much better and the connection is a lot faster.

How to connect to the mobile hostpot (your SSH connection will terminate - this is expected):

```
$ sudo nmcli device wifi rescan
$ sudo nmcli device wifi list # find the SSID of your mobile hotspot
$ sudo nmcli device wifi connect <HOTSPOT_SSID> password <YOUR_PASSWORD>
```

After that nmcli should output your Wi-Fi hotspot's SSID.

!!! Info "This solution is not ideal. Better mobile data hardware solutions are being explored."

### Hints

#### Enabling persistent journalctl logs (by default they are only in RAM)

``` shell
sudo mkdir -p /var/log/journal /etc/systemd/journald.conf.d
sudo systemd-tmpfiles --create --prefix /var/log/journal # fixes ownership/ACLs
sudo tee /etc/systemd/journald.conf.d/persist.conf > /dev/null <<'EOF'
[Journal]
Storage=persistent
SystemMaxUse=1G
SystemKeepFree=1G
EOF
sudo systemctl restart systemd-journald
sudo journalctl --flush # move the current boot's RAM logs to disk now
```

Reading your previous boot's flight logs:

``` shell
journalctl --list-boots
journalctl -b -1 -u drone-grid-companion # reading previous boot
```
