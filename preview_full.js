const { color, readCache, stringToChunks } = require('./utils');
const line = process.argv[2];
const lineNumber = parseInt(line.split(' ')[0]);

const content = readCache('_result_', 'preview')

// Computes offset based on line number
function computeOffset(n) {
    let height = process.env.LINES;
    return Math.max(n - height/2, 0);
}

// Add color to the line depending on markdown element
let border = 4;
let maxLen = parseInt(process.env.COLUMNS * 0.8) - border; // 80% of the window
function pretty(line, next, highlight) {
    if (next.slice(0,3) === '===' || next.slice(0, 3) === '---' || line.slice(0, 3) === '===' || line.slice(0, 3) === '---') {
        // main header
        line = color.yellow + color.bright + line + color.reset;
    } else if (line[0] === '#') {
        // header
        line = color.yellow + color.bright + line + color.reset;
    } else if (/(?:__|[*#])|\[(.*?)\]\(.*?\)/.test(line)) {
        // url
        line = line.replace(/(?:__|[*#])|\[(.*?)\]\(.*?\)/g, color.blue + '$1' + color.reset);
        // line = color.blue + color.bright + line + color.reset;
    } else if (/^\s{4}[^*]/.test(line)) {
        // codeblock
        line = color.green + line + color.reset;
    }

    // bold, italic, underline, code
    line = line.replace(/\s\*\*([^*]+)\*\*\s/g, ' ' + color.bright + '$1' + color.reset + ' ');
    line = line.replace(/\s\*([^*]+)\*\s/g, ' ' + color.italic + '$1' + color.reset + ' ');
    line = line.replace(/\s_([^_]+)_\s/g, ' ' + color.underscore + '$1' + color.reset + ' ');
    line = line.replace(/\s`([^`]+)`\s/g, ' ' + color.green + '$1' + color.reset + ' ');

    if (highlight) {
        line = color.underscore + line;
    }

    let chunks = stringToChunks(line, maxLen);
    if (chunks.length) {
        chunks.forEach(c => {
            console.log(c);
        });
    } else {
        console.log(line);
    }
}

// Create illusion of scrolled text based on selected line number
let offset = computeOffset(lineNumber);
console.log(color.blue + content.url + color.reset);
content.content.forEach((line, index) => {
    let next = content.content.length > index + 1 ? content.content[index + 1] : '';
    if (index > offset) {
        pretty(line, next, index === lineNumber);
    }
});
