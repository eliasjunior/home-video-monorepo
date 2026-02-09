readFolder() {
    local parentD="/media/pi/ExternalHD/Movies"
    local destBASE="/home/pi/Images"
    echo "read in ${parentD}"
    echo "----------------"
    for file in "${parentD}"/* ; do 
        if [ -d "${file}" ]; then
            echo "Source      ==> $file"
            folderName="${file##*/}"
            echo "Destination ==> ${destBASE}/$folderName"
            mkdir "${destBASE}/$folderName"
        fi
       
    done
}

readFolder