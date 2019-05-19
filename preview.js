const puppeteer = require('puppeteer');
const entry = process.argv[2];
const url = entry.match(/\bhttps?:\/\/\S+/gi)[0];
const preview_location = '/tmp/_web_preview.png';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    await page.screenshot({path: preview_location});
    console.log(preview_location);

    await browser.close();
})();
