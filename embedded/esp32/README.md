## Kill switch code

This Arduino IDE sketch is flashed to a ESP32 microcontroller which is connected to both the ELRS receiver and the companion computer (Raspberry Pi 3B). It checks for a sustained kill switch signal in the infinite control loop and upon receiving it a signal is sent to the shutdown GPIO pins of the companion. 
This ensures that no matter what happens a pilot with the drone within VLOS can take control of the drone at any point in time.

It also kills the companion if there is no connection between the ELRS receiver and transmitter (the TL8) for an interval of time that exceeds a given threshold. This is important because it prevents situations where the VLOS pilot does not have control. If the drone is properly configured, the signal loss (of both receiver and companion) will initiate the failsafe policy configured within the flight controller - usually RTH (Return To Home).

This is also not the best picture but you can see the jumper wires connecting the companion, the ESP32 as well as the ELRS receiver on top.

In the future diagrams may be added to better visualize the connections.

![Kill switch mechanism](../../docs/content/assets/img/x650/side_top.jpg)