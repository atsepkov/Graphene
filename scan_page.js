const puppeteer = require('puppeteer');
const { color, readCache, writeCache } = require('./utils');

const url = process.argv[2];

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    await page.addScriptTag({url: 'https://unpkg.com/turndown/dist/turndown.js'});

    const content = await page.evaluate(() => {
        // return document.getElementsByTagName('body')[0].innerText;

        let turndownService = new TurndownService();
        let markdown = turndownService.turndown(document.getElementsByTagName('body')[0].innerHTML);
        return markdown;
    });

    writeCache('_result_', 'preview', {
        url: url,
        content: content.split('\n')
    });
    content.split('\n').forEach((line, index) => {
        console.log(`${color.bright}\x1b[38;5;237m${('' + index).padEnd(3)}${color.reset}\x1b[38;5;244m${line}${color.reset}`);
    })

    await browser.close();
})();
