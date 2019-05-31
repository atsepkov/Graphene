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

// writes entry to history file
// types: S (search), U (url), N (navigational), R (result), X (external)
function writeHistory(url, type, params, initial=false) {
    let time = Date.now();
    let context = '';
    if (params) {
        if (type === 'S') {
            context = `${params.engine}> "${params.query}" `;
        } else if (type === 'R') {
            context = `graphene> "${params.title}" `;
        } else if (type === 'X') {
            context = `${params.engine}>open> "${params.result}" `;
        } else if (type === 'N') {
            context = `${params.engine}>nav> "${params.title}" `;
        } else if (type === 'U') {
            context = `url> "${params.title}" `;
        }
    }
    fs.appendFile(path.resolve(__dirname, './.cache/history'), `${initial ? '' : '    '}${time} ${type} ${context}${url}\n`, (err) => {
        if (err) {
            throw err;
        }
    });
}

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



// taken from https://github.com/alanwsmith/markdown_table_formatter
// Not the prettiest code, but it gets the job done
function MarkdownTableFormatter() {

  // Setup instance variables.
  this.cells = new Array();
  this.column_widths = new Array();
  this.output_table = "";

}

MarkdownTableFormatter.prototype.add_missing_cell_columns = function() {
  for (var row_i = 0, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
    for (var col_i = 0, col_l = this.column_widths.length; col_i < col_l; col_i = col_i + 1) {
      if (typeof this.cells[row_i][col_i] === 'undefined') {
        this.cells[row_i][col_i] = '';
      }      
    }
  }
}

MarkdownTableFormatter.prototype.format_table = function(table) {

  this.import_table(table);
  this.get_column_widths();
  this.add_missing_cell_columns();
  this.pad_cells_for_output();

  // Header
  this.output_table = "| ";
  this.output_table += this.cells[0].join(" | ");
  this.output_table += " |\n";

  // Separator 
  this.output_table += "|-";
  this.output_table += this.cells[1].join("-|-");
  this.output_table += "-|\n";


  for (var row_i = 2, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
    this.output_table += "| ";
    this.output_table += this.cells[row_i].join(" | ");
    this.output_table += " |\n";
  }

}

MarkdownTableFormatter.prototype.get_column_widths = function() {

  this.column_widths = new Array();

  for (var row_i = 0, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
    for (var col_i = 0, col_l = this.cells[row_i].length; col_i < col_l; col_i = col_i + 1) {
      if (typeof this.column_widths[col_i] === 'undefined') {
        this.column_widths[col_i] = this.cells[row_i][col_i].length;
      }
      else if (this.column_widths[col_i] < this.cells[row_i][col_i].length) {
        this.column_widths[col_i] = this.cells[row_i][col_i].length;
      }
    }
  }
}

MarkdownTableFormatter.prototype.import_table = function(table) {
  
  var table_rows = table.split("\n");

  // Remove leading empty lines
  while (table_rows[0].indexOf('|') == -1) {
    table_rows.shift();
  }

  for (var row_i = 0, row_l = table_rows.length; row_i < row_l; row_i = row_i + 1) {

    // TODO: Set up the indexes so that empty lines at either the top or bottom will
    // be removed. Right now, this is only helpful for empty lines at the bottom.
    if(table_rows[row_i].indexOf('|') == -1) {
      continue;
    }

    this.cells[row_i] = new Array();

    var row_columns = table_rows[row_i].split("\|");

    for (var col_i = 0, col_l = row_columns.length; col_i < col_l; col_i = col_i + 1) {
      this.cells[row_i][col_i] = row_columns[col_i]
      this.cells[row_i][col_i] = this.cells[row_i][col_i].replace(/^\s+/g,"");
      this.cells[row_i][col_i] = this.cells[row_i][col_i].replace(/\s+$/g,"");

      // If it's the separator row, parse down the dashes
      // Only do this if it matches to avoid adding a
      // dash in an empty column and messing with the column widths.
      if (row_i == 1) {
        this.cells[row_i][col_i] = this.cells[row_i][col_i].replace(/-+/g,"-");
      }
    }
  }


  // Remove leading and trailing rows if they are empty.
  this.get_column_widths();
  
  if (this.column_widths[0] == 0) {
    for (var row_i = 0, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
      this.cells[row_i].shift();
    }
  }

  this.get_column_widths();

  // check to see if the last item in column widths is empty
  if (this.column_widths[ (this.column_widths.length - 1) ] == 0) {
    for (var row_i = 0, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
      // Only remove the row if it is in the proper last slot.
      if (this.cells[row_i].length == this.column_widths.length) {
        this.cells[row_i].pop();
      }
    }    
  }

  this.get_column_widths();

}

MarkdownTableFormatter.prototype.pad_cells_for_output = function() {

  for (var row_i = 0, row_l = this.cells.length; row_i < row_l; row_i = row_i + 1) {
    for (var col_i = 0, col_l = this.cells[row_i].length; col_i < col_l; col_i = col_i + 1) {

      // Handle anything that's not the separator row
      if (row_i != 1) {
        while(this.cells[row_i][col_i].length < this.column_widths[col_i]) {
          this.cells[row_i][col_i] += " ";
        }
      }
      // Handle the separator row.
      else {
        while(this.cells[row_i][col_i].length < this.column_widths[col_i]) {
          this.cells[row_i][col_i] += "-";
        }
      }
    }
  }
}

module.exports = {
    color,
    readCache,
    writeCache,
    writeHistory,
    dictionary,
    stringToChunks,
    weights,
    thresholds,
    MarkdownTableFormatter
};
