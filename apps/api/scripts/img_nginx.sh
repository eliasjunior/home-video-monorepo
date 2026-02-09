#!/bin/bash

# Check if folder name and new image name are provided as arguments
if [ $# -ne 3 ]; then
    echo "Usage: $0 <folder_name> <new_image_name> <image_url>"
    exit 1
fi

# Set folder name and image URL
folder_name="$1"
new_file_name="$2"
image_url="$3"

# base dir
parentFolder="/var/www/images"
fullPath="$parentFolder/$folder_name"

# Create the folder if it doesn't exist
if [ ! -d "$fullPath" ]; then
    mkdir "$fullPath"
fi

# Change to the folder
cd "$fullPath"

# Download the image file using wget
wget -O "$new_file_name" "$image_url"

echo "Image downloaded and saved as $new_file_name in folder $folder_name."
