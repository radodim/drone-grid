# Drone setup

!!! Danger "Please be careful and make sure the propellers are off during bench testing."

- The drone assembly is done by following the [instructions](https://docs.holybro.com/drone-development-kit/x650-development-kit/download).
- After assembly the drone must be configured. [The PX4 instructions](https://docs.px4.io/main/en/config_mc/#multicopter-configuration) for multicopter configuration are very useful for this purpose.
- [QGroundControl](https://qgroundcontrol.com/) was used for the drone configuration.

## Radio transmitter and receiver setup

!!! Warning "Why do I need a radio if I can fly through Drone Grid?"

    You need a radio because Drone Grid is an experimental system.<br>
    We recommend the flight configuration described in [Safety recommendations](safety-recommendations.md).

You need to ensure that the receiver and transmitter are the same ELRS version (if applicable for your setup - in the EU only ELRS is allowed, feel free to use any compatible transmitter and receiver setup).

The RP2 ELRS receiver pads were soldered to pin headers that were then plugged into a RC Servo Y-harness.
The signal from the receiver goes to the kill switch as well as the RC IN input of the flight controller.

- For the receiver follow [these instructions](http://expresslrs.org/quick-start/webui/)
- For the transmitter follow [these](https://cdn.shopify.com/s/files/1/0701/8066/7584/files/T8L_V1.4.pdf?v=1770617495).

## Specific configuration in QGroundControl

!!! Info "For the initial configuration it is better to use the USB-C cable that comes with the X650 Dev Kit."

    If you do not use the cable the Actuators menu item will not appear (this likely depends on the version of QGroundControl). Everything else can be setup over the SiK telemetry module wirelessly.

-   **Summary**
    - Airframe - Generic Quadcopter
    - PX4 version - 1.16.2
-   Follow the instructions in the **Sensors Config** menu, refer to QGroundControl and PX4 docs (listed above) for additional details.
-   **Radio** - setup the radio after the section above
-   **Flight modes configuration**
    -   Flight Mode Settings
        - The first Drone Grid drone supports Stabilized, Position and Hold [flight modes](https://docs.px4.io/main/en/flight_modes_mc/) over radio. You may add any flight modes you wish here.
        - Currently, only the POSCTL flight mode is supported in Drone Grid (requires an active GPS lock)
    -   Switch Settings (set the channels based on your preferences)
        -   Arm switch channel
        -   Emergency Kill switch channel
            -   !!! Danger "Emergency Kill switch channel"
                This channel is the last line of defense. It will **make the drone fall out of the sky if activated.**
                You must assign this to a channel on the transmitter which cannot be easily triggered by accident,
                e.g. the [S1 Dial on the T8L](https://cdn.shopify.com/s/files/1/0701/8066/7584/files/T8L_V1.4.pdf?v=1770617495).
                **Do not confuse this emergency kill switch with the Drone Grid kill switch mechanism that uses an ESP32 which is connected to the companion and receiver - they are two completely separate things.**
        -   Return switch channel
-   **[Power](https://docs.px4.io/v1.16/en/config/battery#basic_settings)**
-   **Actuators**
    - The motors were configured with DSHOT600 instead of PWM (AUX 1-4 corresponds to Motor 1-4). This removes the need for ESC calibration.
-   **Safety**  
    -   !!! Warning 

            - Configuring Return To Launch settings that are appropriate for your flight location and in compliance with your local laws and regulations is a must.
            - The same (as Return To Launch settings) goes for RC Loss failsafe trigger (return mode) and Low Battery Failsafe Trigger

## Drone Grid configurations

!!! Warning "The configurations below are a must for the Safety Recommendations."

From QGroundControl navigate to the [MAVLink Console](https://docs.qgroundcontrol.com/Stable_V4.3/en/qgc-user-guide/analyze_view/mavlink_console.html) and follow the steps below:

### [COM_RC_IN_MODE parameter](https://docs.px4.io/v1.16/en/advanced_config/parameter_reference#COM_RC_IN_MODE)

``` shell
nsh> param set COM_RC_IN_MODE 2
nsh> param save
```

Ensure the output of the nuttx shell command is as follows:

``` shell
nsh> param show COM_RC_IN_MODE
```

``` shell
Symbols: x = used, + = saved, * = unsaved
x + COM_RC_IN_MODE [315,528] : 2
```

### [Ethernet configuration](https://docs.px4.io/v1.16/en/advanced_config/ethernet_setup#px4-ethernet-setup)

There are slight discrepancies between the official PX4 ethernet setup guide and what actually had to be done.
The following has been tested and works on this hardware configuration:

``` shell
echo DEVICE=eth0 > /fs/microsd/net.cfg
echo BOOTPROTO=static >> /fs/microsd/net.cfg
echo IPADDR=10.41.10.2 >> /fs/microsd/net.cfg
echo NETMASK=255.255.255.0 >>/fs/microsd/net.cfg
echo ROUTER=10.41.10.254 >>/fs/microsd/net.cfg
echo DNS=10.41.10.254 >>/fs/microsd/net.cfg

param set MAV_2_CONFIG 0
param save

mkdir /fs/microsd/etc
echo "mavlink start -x -t 10.41.10.1 -u 14540 -r 100000 -f -m onboard -o 14540" > /fs/microsd/etc/extras.txt

reboot
```

#### Verification (companion not connected)

This is a completely expected result if you started with the drone setup and have not gotten to [the companion setup](./companion-setup.md) yet:
In the output of the mavlink status command look for the instance whose transport protocol is UDP.

``` shell
nsh> netman show
DEVICE=eth0
BOOTPROTO=static
NETMASK=255.255.255.0
IPADDR=10.41.10.2
ROUTER=10.41.10.254
DNS=10.41.10.254

nsh> ifconfig
eth0    Link encap:Ethernet HWaddr <MAC_ADDRESS> at DOWN
    inet addr:10.41.10.2 DRaddr:10.41.10.254 Mask:255.255.255.0

nsh> mavlink status
...
instance #1:
    mavlink chan: #1
    type:        GENERIC LINK OR RADIO
    flow control: OFF
    rates:
      tx: 0.0 B/s
      txerr: 1326.8 B/s
      tx rate mult: 0.050
      tx rate max: 100000 B/s
      rx: 0.0 B/s
      rx loss: 0.0%
    FTP enabled: YES, TX enabled: YES
    mode: Onboard
    Forwarding: On
    MAVLink version: 1
    transport protocol: UDP (14540, remote port: 14540)
    Broadcast enabled: NO
...

```

#### Verification (companion configured and connected by following [the companion setup](./companion-setup.md))

Raspberry Pi connected via ETH cable that comes with X650 dev kit:

``` shell
nsh> ifconfig
eth0    Link encap:Ethernet HWaddr <MAC_ADDRESS> at UP
    inet addr:10.41.10.2 DRaddr:10.41.10.254 Mask:255.255.255.0

nsh> mavlink status
...
instance #1:
    GCS heartbeat valid
    mavlink chan: #1
    type:        GENERIC LINK OR RADIO
    flow control: OFF
    rates:
      tx: 21842.0 B/s
      txerr: 0.0 B/s
      tx rate mult: 1.000
      tx rate max: 100000 B/s
      rx: 46.9 B/s
      rx loss: 0.0%
    Received Messages:
      sysid:245, compid:190, Total: 76 (lost: 0)
    FTP enabled: YES, TX enabled: YES
    mode: Onboard
    Forwarding: On
    MAVLink version: 2
    transport protocol: UDP (14540, remote port: 14540)
    Broadcast enabled: NO
    ping statistics:
      last: 1.20 ms
      mean: 1.38 ms
      max: 3.45 ms
      min: 0.79 ms
      dropped packets: 0
...
```
