const puppeteer = require('puppeteer');
const engine = process.argv[2];
const entry = process.argv[3];
const url = entry.match(/\bhttps?:\/\/\S+/gi)[0];
const { color, readCache } = require('./utils');
const preview_location = '/tmp/_web_preview.png';


// split a long string into shorter chunks
function stringToChunks(str, size) {
    const numChunks = Math.ceil(str.length / size);
    const chunks = [numChunks];

    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substr(o, size);
    }

    return chunks;
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
        return mod + color.black;
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
function style(element, style) {
    return colorToAnsi(style.color, 'fg') + element + color.reset;
}

// recursive helper for render()
function _render(context) {
    let text = '';

    context.children.forEach(child => {
        if (typeof child === 'string') {
            if (child.trim()) {
                text += style(child, context.css);
            }
        } else {
            text += _render(child);
        }
        if (context.css.display !== 'inline' && text) {
            text += '\n';
        }

    })

    return text;
}

function render(data) {
    // console.log(url);
    console.log(color.blue + color.underscore + url + color.reset);
    let output = _render(data.context); 

    let maxLen = parseInt(process.env.COLUMNS * 0.4); // 40% of the window
    let lines = output.split('\n');
    lines.forEach(l => {
        let chunks = stringToChunks(l, maxLen);
        chunks.forEach(c => {
            c && console.log(c);
        });
    });
}

let cache = readCache(engine, 'current');
render(cache[url]);
/*(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    // await page.screenshot({path: preview_location});
    // console.log(preview_location);

    await browser.close();
})();*/

