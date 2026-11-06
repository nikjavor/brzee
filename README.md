# brzee
A hardware–software system that transforms live vehicle telemetry into responsive, synthesized engine audio.

PROSTOR ZA SLIKE TODO

## Project Overview
brzee is real-time automotive system which gets live car data from OBD-II port using custom adapter containing ESP32-C6 microcontroller and CAN transceiver. Data is polled and gets sent to the phone via Bluetooth Low Energy notifications. Mobile application displays received data and synthesizes supercar-sounding engine sound conforming to live data.

### Motivation
I started this project because I wanted to broaden my knowledge on embedded systems through making a project that combines wide range of concepts from automotive CAN-bus and OBD-II protocol through RTOS and embedded C all the way to BLE notifications and custom mobile app. I was also very interested in hardware part because I feel like I do not get enough experience with that in university.

## System Architecture
### Hardware
Version 1 of this project is made by soldering components to protoboard and not yet on custom PCB, though, that is planned in very near future.
Therefore, components needed for this version are:
* [XIAO ESP32-C6](https://wiki.seeedstudio.com/xiao_esp32c6_getting_started/) microcontroller
* SN65HVD230 CAN transceiver
* Step-down converter (set to output 5V)
* OBD-II connector

Exact wiring of components is shown on schema below:
<p align="center">
  <img width="1586" height="907" alt="61F097F7-EA86-4821-9020-1CAB6F07F81C" src="https://github.com/user-attachments/assets/b0e4d349-967f-4ace-b76e-73ee8186933f" />
  <em>Components wiring diagram</em>
</p>

<p align="center">
  SLIKA VEZJA TODO
  <!-- <img width="1586" height="907" alt="Actual wiring of my version" src="https://github.com/user-attachments/assets/5b31004f-bbcf-449f-bf16-fc971cfc3d6d" /> -->
  <em>Actual wiring of my version</em>
</p>

### Firmware
ESP32-C6 chip is the brain of brzee's car adapter. It orchestrates tasks, decides which data to collect and when to send it away, all using real-time operating system FreeRTOS. It's firmware is divided into 4 main components:

#### 1. OBD_TWAI (CAN-Bus Controller)
Contains all necessary functions for polling car's CAN bus. It is also checks what bitrate connected car uses (250kbit or 500kbit).

#### 2. CAR_DATA
This component handles collected data. It's functions can update data or get snapshots of stored data.

#### 3. OBD_SCHEDULER
As it's name suggest, this component decides how often and when exactly each parameter gets polled. It then calls above-mentioned components to poll and store the data.

#### 4. BLE (Bluetooth Low Energy)
When connection with the phone is established, car's live data gets periodically sent to the phone using BLE's notifications.

### Mobile app
Second half of the brzee project is its companion mobile app. It connects to brzee car adapter and interprets the received information.
When user opens the app they are met with connection button which (when pressed) automatically connects the app to adapter and starts receiving information via Bluetooth Low Energy protocol.
User is presented with virtual (car) dashboard consisting of:
* Tachometer
* Speedometer
* Pedal position gauge
* Torque meter
* Coolant temperature gauge

#### Engine sound synthesis
Most interesting feature of brzee app in my opinion is the **live supercar engine sound**.
While app displays some of live data, it also uses it to produce supercar sounding engine sounds that can be played through car speakers and give user a feeling of driving their dream car. There are of course different sound options available for user to choose.
Normal daily driver cars don't usually have same rpm limits as most of supercars. That's why brzee continuously learns and conforms ranges to the driven car so the user can experience the full power of supercars.

## Engineering challenges
### Not all cars have CAN bus
When I went to test the first brzee firmware version on my car I could not manage to get it to detect the right bitrate (which was the first thing it should do).
I inspected the code and reassembled all components but got no more lucky.
Well, the reason was that I was testing on my 2008 VW Polo which still used K-line instead of CAN bus.
After the discovery, I made the decision to continue developing the system for CAN and test on other cars, because I wanted to learn the protocol that is currently most widely used worldwide in automotive industry.

### Sometimes you aren't the problem (or are you? :)
After everything was connected and working while connected to my laptop and it was time to do the last step and get the power directly from the cars 16V supply I encountered another problem. I can't use cars voltage because it would fry the chip, so I connected it through step-down converter that should convert the voltage down to 5V. I've set it up in the lab and measured the output voltage to be correct, but when I connected it to the car and the controller it wouldn't turn on.
My first thought was that I've let through too much voltage and fried the chip, but it worked again when i connected it to the laptop's power. Then I thought that other components have excessive resistance, but after measuring it in lab again connected to the whole system the voltage was still to low for it to work.
Then it hit me: It may just be a faulty converter. I tested another converter of the same model and it worked immediately.
My guess is that I might have damaged the component when i was soldering on wires with grandpa's gigantic soldering iron (because I didn't have access to anything more practical yet at that time.
