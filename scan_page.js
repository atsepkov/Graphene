const puppeteer = require('puppeteer');
const { color, readCache, writeCache } = require('./utils');

const url = process.argv[2];

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const content = await page.evaluate(() => {
        return document.getElementsByTagName('body')[0].innerText;
    });

    writeCache('_result_', 'preview', {
        content: content
    });
    content.split('\n').forEach((line, index) => {
        console.log(`${color.bright + color.black}${('' + index).padEnd(3)}${color.reset}${line}`);
    })

    await browser.close();
})();
