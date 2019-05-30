const puppeteer = require('puppeteer');
const engine = process.argv[2];
const entry = process.argv[3];
const url = entry.match(/\bhttps?:\/\/\S+/gi)[0];
const { color, readCache, stringToChunks } = require('./utils');
const preview_location = '/tmp/_web_preview.png';

function showShortcuts() {
    const k = (key, msg) => { console.log(color.black + color.bright + `\t${key}\t${msg}` + color.reset) };

    console.log('');
    k('F1', 'Open result in Graphene');
    k('F2', 'Hide/show preview window');
    k('Enter', 'Open result in GUI browser');
    console.log('');
}

// convert HEX code to ANSI
function colorToAnsi(rgb, type) {
    let code = type === 'fg' ? '38' : '48';
    let colors = rgb.slice(4, -1).split(', ').map(n => parseInt(n));
    // return `\x1b${code};2;${colors[0]};${colors[1]};${colors[2]}m`;

    let mod = '';
    if (colors[0] > 130 || colors[1] > 130 || colors[2] > 130) {
        mod = color.bright;
    }

    // very crappy simulation of colors because FZF currently only does 8 colors
    if (colors[0] < 30 && colors[1] < 30 && colors[2] < 30) {
        // most websites are black text on white background, so ignore this setting for now
        // return mod + color.black;
        return mod + color.white;
    } else if (colors[0] > colors[1] * 2 && colors[0] > colors[2] * 2) {
        return mod + color.red;
    } else if (colors[1] > colors[0] * 2 && colors[1] > colors[2] * 2) {
        return mod + color.green;
    } else if (colors[2] > colors[1] * 2 && colors[2] > colors[0] * 2) {
        return mod + color.blue;
    } else if (colors[1] > colors[2] * 2) {
        return mod + color.yellow;
    } else if (colors[1] > colors[0] * 2) {
        return mod + color.cyan;
    } else if (colors[0] > colors[1] * 2) {
        return mod + color.magenta;
    }

    return mod + color.white;
}

// apply style to the element
function style(element, style, tag) {
    let rendered = colorToAnsi(style.color, 'fg') + element + color.reset;
    // console.log(tag)
    if (/H\d/.test(tag)) {
        // heading
        return `\n${color.bright}${rendered}`;
    // } else if (!/^0px /.test(style.border)) {
    //     // border
    //     return `[${rendered}]`;
    // } else if (style.background !== 'rgba(0, 0, 0, 0)') {
    //     // background
    //     let bg = colorToAnsi(style.background, 'fg');
    //     return `${bg}[${color.reset}${rendered}${bg}]${color.reset}`
    }
    return rendered;
}

// recursive helper for render()
function _render(context) {
    let text = '';

    context.children.forEach(child => {
        let visible = true;
        if (typeof child === 'string') {
            if (child.trim()) {
                text += style(child, context.css, context.tag);
            } else {
                visible = false;
            }
        } else {
            text += _render(child);
        }
        if (visible && context.css.display !== 'inline' && text) {
            text += '\n';
        }

    })

    return text;
}

function render(data) {
    console.log(color.blue + color.underscore + url + color.reset);
    showShortcuts();
    
    if (data.error) {
        console.log(color.red + data.error + color.reset);
        return;
    }

    let output = _render(data.context); 

    let border = 4;
    let maxLen = parseInt(process.env.COLUMNS * 0.4) - border; // 40% of the window
    let lines = output.split('\n');
    lines.forEach(l => {
        let chunks = stringToChunks(l.trim(), maxLen);
        chunks.forEach(c => {
            c && console.log(c);
        });
    });
}

let cache = readCache(engine, 'current');
if (Object.keys(cache).length) {
    if (cache[url]) {
        render(cache[url]);
    } else {
        render({
            error: 'There was a problem fetching preview for this result.',
        })
    }
} else {
    render({
        error: 'Preview file could not be loaded.',
    })
}
