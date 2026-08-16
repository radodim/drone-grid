### 3D models for the Raspberry Pi V2 Camera mount for the HolyBro X650

- The mount itself is printed out of PLA (x650_mount.stl)
- Standoffs (x4) between the camera and mount themselves printed out of PLA (mount_standoff.stl)
- Dampeners (x2 but don't print simultaenously out of TPU) placed between the mount base and the carbon plate as well as one on the other side of the plate (dampener.stl)

All parts were printed on an Ender 3 V2 with the metal extruder (only upgrade).
They STL files were converted to GCODE (also available in the directory) through Ultimaker Cura.

P.S. because of the glass transition temperature of PLA, printing the parts in a light color is recommended. During extremely hot days the dark-colored PLA parts deform very quickly.

Whether or not the TPU dampeners help reduce vibrations is not confirmed. It is 100% confirmed that you should not use a Raspberry Pi V3 camera in a high-vibration environment :D because of the way its autofocus mechanism works - the lense is not static.

You will also need bolts, nuts and washers. Purchasing a set online with various sizes is easiest.

This is not the best picture but the camera mount can be seen on the left:

![Camera mount on the left](../../docs/content/assets/img/x650/other_side_close.jpg)