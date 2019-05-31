const puppeteer = require('puppeteer');
const { color, readCache, writeCache, writeHistory } = require('./utils');

const url = process.argv[2];

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    writeHistory(url, 'R');
    await page.addScriptTag({url: 'https://unpkg.com/turndown/dist/turndown.js'});
    await page.addScriptTag({url: 'https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js'});

    const content = await page.evaluate(() => {
        // return document.getElementsByTagName('body')[0].innerText;

        let turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-',
            // linkStyle: 'referenced',
            // linkReferenceStyle: 'collapsed'
        });
        let gfm = turndownPluginGfm.gfm;
        turndownService.use(gfm);
        turndownService.remove('script');
        turndownService.remove('style');
        /*turndownService.addRule('url', { // force url to be one-line to avoid breaking later regex
            filter: ['a'],
            replacement: function (content, node) {
                let href = node.getAttribute('href');
                let title = node.title ? ' "' + node.title.replace('\n', ' ') + '"' : '';
                return '[' + content + '](' + href + ')';
            }
        });*/
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
