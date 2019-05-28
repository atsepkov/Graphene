engine=$1
line=$2

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

url=$(echo $line | sed 's#.*\(https*://\)#\1#')
if [[ "$line" =~ \(pager\)$ ]]; then
    bash $DIR/graphene $engine $url
else
    open $url
fi
