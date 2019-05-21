const fs = require('fs');

// color scheme
const color = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    italic: '\x1b[3m',
    underscore: '\x1b[4m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

// reads previously written cache
function readCache(engine, type) {
    let json;
    try {
        json = require('./.cache/' + engine + '-' + type);
    } catch (e) {
        json = {};
    }

    return json;
};

// writes page as a cache file to disk
function writeCache(engine, type, json) {
    fs.writeFileSync('.cache/' + engine + '-' + type + '.json', JSON.stringify(json));
};

module.exports = {
    color,
    readCache,
    writeCache
};
