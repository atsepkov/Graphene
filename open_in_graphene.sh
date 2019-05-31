line=$1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
url=$(echo $line | sed 's#.*\(https*://\)#\1#')

# if [[ "$line" =~ \(pager\)$ ]]; then
#     bash $DIR/graphene $engine $url
# else
#     open $url
# fi

show_result() {
    local url
    url="$1"
    echo "$(node $DIR/scan_page.js "$url" |
            fzf --reverse --ansi --tiebreak=begin,index \
            --preview-window=right:80% --preview="node $DIR/preview_full.js {}" && echo $url)"
}

show_result "$url"
