#!/bin/bash
if [ $# -ne 2 ]; then
    echo "Usage: $0 <image_name> <uri>"
    exit 1
fi

img_name="$1"
uri_data="$2"

echo -n "${uri_data}" | sed 's/^data:image\/[^;]*;base64,//' | base64 -d > "${img_name}"