const fs = require('fs');
const path = require("path");

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
    fs.writeFileSync(path.resolve(__dirname, './.cache/' + engine + '-' + type + '.json'), JSON.stringify(json));
};

// split a long string into shorter chunks
function stringToChunks(str, size) {
    // const numChunks = Math.ceil(str.length / size);
    const chunks = [];

    let index = 0;
    while (str.length && index < str.length - 1) {
        let line = str.substr(index, size);
        index += size;
        if (index < str.length - 1 && str[index-1] !== ' ' && str[index] !== ' ') {
            // we're mid-word
            let offset = 0
            while (index && str[index-1] !== ' ') {
                index--;
                offset++;
            }
            line = line.substr(0, line.length-offset);
        }
        chunks.push(line);
    }

    return chunks;
}


// dictionary of common element names
let dictionary = {
    // groups that are typically not actionable from terminal
    cruft: [
        // account
        'sign in',
        'log in',
        'login',
        'sign up',
        'join',
        'register',

        // menus
        'about',
        'blog',
        'contact us',
        'cookie policy',
        'feedback',
        'help',
        'home',
        'jobs',
        'legal',
        'privacy',
        'privacy policy',
        'return policy',
        'security',
        'settings',
        'terms',
        'terms of service',
        'terms of use',

        // categorization
        'questions',
        'tags',
        'users',
        'votes',

        // media sharing
        'facebook',
        'linkedin',
        'reddit',
        'twitch',
        'twitter',
        'youtube',
    ],
    // navigation elements/groups
    navigation: {
        name: [
            '^1$',
            '^2$',
            '^3$',
            '^4$',
            '^5$',
            '^next\\b',
            '^prev\\b',
            '^previous\\b',
            '^back\\b',
            '^newer\\b',
            '^older\\b',
        ],
        href: [
            '\\bstart=\\d+\\b',
            '\\bpage=\\d+\\b',
            '\\bp=\\d+\\b',
            '\\bpstart=\\d+\\b',
        ]
    }
};

// weights to apply when evaluating significance of each group
const weights = {
    context: 2,         // amount of context per element
    coverage: 1,        // amount of space your elements seem to cover on screen (how spread out they are)
    area: 1,            // area correlates with things like font size but may break if you stick a large image inside <a> that's not a main group
    textLength: 1,      // text length is the combined length of all text inside the given group of links
    numElements: 0,     // number of elements in the group
}

// minimum thresholds each group has to meet to be considered significant
const thresholds = {
    coverage: 30000,
    numElements: 5,
};

module.exports = {
    color,
    readCache,
    writeCache,
    dictionary,
    stringToChunks,
    weights,
    thresholds
};
