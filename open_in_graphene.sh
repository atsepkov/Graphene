engine=$1
line=$2

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
url=$(echo $line | sed 's#.*\(https*://\)#\1#')

# if [[ "$line" =~ \(pager\)$ ]]; then
#     bash $DIR/graphene $engine $url
# else
#     open $url
# fi

            # --bind "f1:execute(LINES=$LINES node '$DIR/preview_full.js' {} | less -r < /dev/tty > /dev/tty 2>&1)" \
show_result() {
    local url
    url="$1"
    # TODO: fix, f1 is currently broken, the idea is to use it as copy/save mode
    node $DIR/scan_page.js $engine "$url" |
            fzf --reverse --ansi --tiebreak=begin,index \
            --bind "f1:execute(LINES=$LINES node '$DIR/preview_full.js' {} | nvim < /dev/tty > /dev/tty 2>&1)" \
            --preview-window=right:80% --preview="node '$DIR/preview_full.js' {}"
}

show_result "$url"
