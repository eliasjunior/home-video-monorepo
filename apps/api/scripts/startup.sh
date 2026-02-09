#!/bin/bash

# stop the app
# sudo kill $(pgrep -f "node init.js") & 

nohup npm start > /home/pi/Temp/logs/api.log &


