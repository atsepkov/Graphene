const { color, readCache } = require('./utils');
const line = process.argv[2];
const lineNumber = parseInt(line.split(' ')[0]);

const content = readCache('_result_', 'preview')

// Computes offset based on line number
function computeOffset(n) {
    let height = process.env.LINES;
    return Math.max(n - height/2, 0);
}

let offset = computeOffset(lineNumber);
content.content.split('\n').forEach((line, index) => {
    if (index > offset) {
        if (index === lineNumber) {
            line = color.yellow + line + color.reset;
        }
        console.log(line);
    }
});
