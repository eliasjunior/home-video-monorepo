#!/bin/bash

# Check if both parameters are provided
if [ $# -ne 3 ]; then
    echo "Usage: $0 <item> <folder> <name>"
    exit 1
fi

item=$(echo "$1" | tr -cd '[:alnum:] ' | tr '[:upper:]' '[:lower:]')
folder="$2"
name="$3"
backup_dir=~

# JSON structure to be added
new_item="\"${item}\": {\"folder\": \"$folder\", \"name\": \"$name\", \"year\": \"\"}"

# JSON file path
json_file="../public/movie_map_prod.json"

# Check if the JSON file exists
if [ ! -f "$json_file" ]; then
    echo "JSON file not found: $json_file"
    exit 1
fi

# Read the JSON content
json_content=$(cat "$json_file")

# Remove the last curly brace from the JSON content
json_content="${json_content%?}"

# Add the new item and a closing curly brace
new_json_content="$json_content,$new_item}"

# Write the modified content back to the JSON file
echo "$new_json_content" > "$json_file"

echo "New item added to $json_file"

cp -f "${json_file}" ~
echo "backup map to " ~
echo "NEXT:=>wget -O url image_name"