const puppeteer = require('puppeteer');
const engine = process.argv[2];
const entry = process.argv[3];
const url = entry.match(/\bhttps?:\/\/\S+/gi)[0];
const { readCache } = require('./utils');
const preview_location = '/tmp/_web_preview.png';


// apply style to the element
function style(element, style) {
    return element;
}

// recursive helper for render()
function _render(context) {
    let text = '';

    context.children.forEach(child => {
        if (typeof child === 'string') {
            text += style(child, context.style);
        } else {
            text += _render(child);
        }
    })

    return text;
}

function render(data) {
    // console.log(url);
    let output = _render(data.context); 

    console.log(output);
}

let cache = readCache(engine, 'current')
render(cache[url]);
/*(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    // await page.screenshot({path: preview_location});
    // console.log(preview_location);

    await browser.close();
})();*/
