engine=$1
line=$2

url=$(echo $line | sed 's#.*\(https*://\)#\1#')
if [[ "$line" =~ \(pager\)$ ]]; then
    bash graphene $engine $url
else
    open $url
fi
