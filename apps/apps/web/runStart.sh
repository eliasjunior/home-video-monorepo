#!/bin/bash

cd /home/pi/Projects/home-video

git pull

npm run build

# server api

cd /home/pi/Projects/home-video-api

git pull
