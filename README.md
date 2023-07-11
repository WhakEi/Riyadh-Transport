
# Riyadh-Transport
Welcome to this in development program, this program is still in it's early stages of development, here's our development plan:

 - ✅ Build a prototype with a basic non-real map in Python
 - ✅ Expand the code to real world examples
 - 🛠️ Add all the busses to the python code
 - ❌ ~~Develop a QT adaptation~~ **(SCRAPPED)**
 - 🛠️ Implement integrations with mapping software
 - ❌ Develop a GUI
 - ❌ Port to mobile platforms
 - ❌ Use location proximity to find nearest station
 - ❌ Release as APK on Android
 - ❌ Deploy on Testflight for iOS
 - ❌ Official full release publicly

## Changelog
Alpha Version 0.13
 - Added viewing routes in maps
 - Fixed route previewing not displaying correctly
 - Removed routes as images (Pillow is still a dependency for now but it will be removed in the future)
 - Eel is now needed for the program to run
 - Chromium browser is now required to show route in OSM

## How to run
1. On Windows open Powershell, on Linux open Terminal and do `pip install tkinter pillow eel`
2. Make sure you have a chromium browser installed, such as Google Chrome or Chromium
3. Run the main script by doing `python ruhbuspt.py`

## Abilities and Limitations
The program can:
 - Give navigational instructions
 - Calculate routes using smart algorithms
 - Offer 2 routes, fastest and least transfers
 - Count the necessary stations crossed
 - Show you the route on a map


The program **CANNOT** so far:
 - Tell you to walk from 1 station to another
 - Use GPS
 - Know the closest station to you
 - Tell you when the bus comes
 - Pay for your busses
 - Tell you the price
