query=$1
line=$2

url=$(echo $line | sed 's#.*\(https*://\)#\1#')
lynx --dump "$url"

