# Safety recommendations

!!! Danger "These safety recommendations are no substitute for your local laws and regulations — you are solely responsible for complying with the legal framework applicable in your area when controlling unmanned aerial vehicles."

Due to the experimental nature of the system, it is recommended that one person have the drone within their Visual Line of Sight (VLOS) throughout the entire flight.
The same person should hold the transmitter that is bound to the onboard receiver, with a dedicated channel for immediately shutting down the companion computer and taking control of the drone in the event of an issue with the system.<br>
The person operating the drone through Drone Grid can focus on the user interface. It is recommended that both operators maintain verbal communication at all times.

How does this work? Through the kill switch mechanism:

![](../../assets/img/x650/side_top.jpg)

## Principle of operation

In the image the ESP32 microcontroller is connected to both the receiver (via jumper wires and the y-harness servo cable) and the Raspberry Pi (via jumper wires directly).
The ESP32 is flashed with the [kill switch program](https://github.com/radodim/drone-grid/blob/main/embedded/esp32/kill_switch.ino).
Within the program the SHUTDOWN_CHANNEL corresponds to a physical button on the transmitter (in the case of the T8L transmitter used for this exact setup the [SD Momentary button](https://cdn.shopify.com/s/files/1/0701/8066/7584/files/T8L_V1.4.pdf?v=1770617495)).
The receiver's SBUS output is by the ESP32 microcontroller which, when the shutdown channel activates, sends a shutdown signal to the Raspberry Pi's GPIO pin.

Due to the [COM_RC_IN_MODE parameter](https://docs.px4.io/v1.16/en/advanced_config/parameter_reference#COM_RC_IN_MODE) (should have been set within the drone setup guide) the person with the transmitter immediately takes control of the drone.

In the event of a loss of communication between the transmitter and receiver the kill switch also shuts down the companion and triggers the flight controller's failsafe mechanism configured in the drone setup guide.
This ensures that there will not be a situation where one pilot has control and the other does not.
This is sometimes a bit tricky because even when the drone is on the ground and you power off the transmitter it leads to the shutdown of the companion - it is just something to be aware of.

| Wire          | From                              | To                          |
| ------------- | --------------------------------- | --------------------------- |
| SBUS signal   | ELRS receiver (via the Y-harness) | ESP32 GPIO16                |
| Shutdown line | ESP32 GPIO23                      | Pi GPIO17 (physical pin 11) |

## Prerequisites

!!! Warning "The drone must be set up properly via [the guide](drone-setup.md)"

!!! Warning "The companion must be set up properly via [the guide](companion-setup.md)"

!!! Warning "Additional Raspberry Pi configuration required for GPIO shutdown to work"

    Within the /boot/firmware/config.txt file, the following dtoverlay key-value pair must be added under the `[all]` section (leave enable_uart=1):

    ``` shell
    [all]
    dtoverlay=gpio-shutdown,gpio_pin=17,active_low=1,gpio_pull=up
    ```

    You must reboot your system for the changes to take effect.

!!! Warning "The ESP32 microcontroller must be flashed with the [kill switch program](https://github.com/radodim/drone-grid/blob/main/embedded/esp32/kill_switch.ino). Arduino IDE was used for this purpose."

    The ESP32 is powered by the Waveshare UPS HAT (B) via a USB-A to microUSB cable.

!!! Warning "Everything must be properly wired and tested multiple times and visually inspected for any issues before flight."

    The kill switch should be tested before every flight

!!! Warning "You should visually inspect the entire drone before every flight for any issues. Ensure the batteries are charged and that all systems function normally."