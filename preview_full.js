const { color, readCache, stringToChunks, MarkdownTableFormatter } = require('./utils');
const line = process.argv[2];
const lineNumber = parseInt(line.split(' ')[0]);

const content = readCache('_result_', 'preview')

// Computes offset based on line number
function computeOffset(n) {
    let height = process.env.LINES;
    let preferredCursorPos = 1/3;
    return Math.max(n - parseInt(height * preferredCursorPos), 0);
}

// Add color to the line depending on markdown element
const NORMAL = 0;
const CODE = 1;
const TABLE = 2;
let border = 4; // chars
let maxLen = parseInt(process.env.COLUMNS * 0.8) - border; // 80% of the window
let mode = NORMAL;
let buffer = [];
function pretty(line, next, highlight) {

    if (line.slice(0, 3) === '```') {
        // codeblock toggle
        mode = mode === NORMAL ? CODE : NORMAL;
        line = color.green + line + color.reset;
        console.log(line);
        return;
    } else if (line[0] === '|') {
        // enter table mode
        mode = TABLE;
    } else if (mode === TABLE) {
        // exit table mode
        let table = new MarkdownTableFormatter();
        try {
            table.format_table(buffer.join('\n'));
            console.log(table.output_table);
        } catch (e) {
            console.log(color.red + "[ Couldn't format table ]" + color.reset);
        }
        buffer = [];
        mode = NORMAL;
    }
    
    if (mode === NORMAL) {
        // urls
        line = line.replace(/\[(.*?)\]\(.*?\)/g, color.blue + '$1' + color.reset);

        if (line[0] === '#') {
            // header
            line = color.yellow + color.bright + line + color.reset;
        }

        // bold, italic, underline, code
        line = line.replace(/(?:^|\W)\*\*([^*]+)\*\*\s/g, ' ' + color.bright + '$1' + color.reset + ' ');
        line = line.replace(/(?:^|\W)\*([^*]+)\*\s/g, ' ' + color.italic + '$1' + color.reset + ' ');
        line = line.replace(/(?:^|\W)_([^_]+)_\s/g, ' ' + color.underscore + '$1' + color.reset + ' ');
        line = line.replace(/(?:^|\W)`([^`]+)`\s/g, ' ' + color.green + '$1' + color.reset + ' ');
    } else if (mode === TABLE) {
        buffer.push(line);
        return;
    } else {
        line = color.green + line + color.reset;
    }

    if (highlight) {
        line = color.bright + line;
    }

    /*let chunks = stringToChunks(line, maxLen);
    if (chunks.length) {
        chunks.forEach(c => {
            console.log(c);
        });
    } else {
        console.log(line);
    }*/
    console.log(line)
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
