#!/bin/bash

# just using as reference of running command at the moment
# ro = readonly
docker run --publish 8080:8080 \
    --env SERVER_PORT=8080 \
    --env SERVER_HOST=localhost \
    --env VIDEO_PATH="/home" \
    -v '/Users/eliasjunior/Downloads/Videos':'/home':ro \
    --name video-api home-video-api

docker logs -f --until=2s video-api
