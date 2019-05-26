const puppeteer = require('puppeteer');
const { color, dictionary, readCache, writeCache, weights, thresholds } = require('./utils');

const engine = process.argv[2];
const query = process.argv[3];


// populate banner
function banner() {
    if (engine !== 'url' && settings.banner) {
        let banner = settings.banner;
        let matches = banner.match(/{(.*?)}/g);
        matches.forEach((match, i) => {
            let escCode = '';
            let fields = match.slice(1,-1).split(',');
            fields.forEach(field => {
                props = field.split('=');
                let colorModifier = props[0].trim() === 'bg' ? 10 : 0;
                if (props[1].trim().startsWith('color')) {
                    escCode += '\x1b[' + (38 + colorModifier) + ';5;' + props[1].trim().slice(5) + 'm';
                } else {
                    escCode += color[props[1].trim()];
                    if (colorModifier) {
                        escCode = escCode.replace('[3', '[4');
                    }
                }
            });
            if (!i) escCode += ' '; // pad the beginning
            banner = banner.replace(match, escCode);
        });
        return `${banner} ${color.reset} ${color.bright}${query}${color.reset}`;
    } else {
        return `${color.red}${engine} ${color.reset} ${color.bright}${query}${color.reset}`;
    }
}

// output data
function outputToTerminal(format, groups) {
    // return if we're just caching
    if (!groups) return;

    if (format === "json") {
        console.log(JSON.stringify(groups));
    } else if (format === 'shell') {
        var curated = banner() + '\n';

        groups.forEach(function (group, index) {
            let groupColor;
            if (group.groupType === MAIN) {
                groupColor = color.yellow;
            } else if (group.groupType === PAGER) {
                groupColor = color.bright + color.cyan;
            } else if (group.groupType === GENERIC) {
                groupColor = color.black + color.bright;
            } else if (group.groupType === OTHER) {
                groupColor = color.black + color.bright;
            } else {
                groupColor = color.white;
            }

            group.elements.forEach(function (element) {
                if (!process.env.ONLY_MAIN || group.groupType === MAIN || group.groupType === PAGER) {
                    curated += 
                        groupColor + element.name.replace(/\n/g, ', ').padEnd(parseInt(120 * 2 / 3)) + color.reset + '\t' + 
                        color.blue + color.underscore + element.href + color.reset + (group.groupType === PAGER ? '\t\t(pager)' : '') + '\n';
                }
            });
        });        
        console.log(curated);
    } else {
        console.log('No format specified');
    }
}

// helper function for determining if paths are the same
function isSamePath(a, b) {
    return a.path.every((element, index) => element === b.path[index]);
}

// finds a group with the same style in current results
// chances are groups will be in the same order, but there may be missing/new
// groups depending on what the search engine inserts into the page (ads, previews, maps, cards)
function findGroupByStyle(currentResults, style) {
    for (var index = 0; index < currentResults.groups.length; index++) {
        let group = currentResults.groups[index];
        if (
            group.style.fontSize === style.fontSize &&
            group.style.fontFamily === style.fontFamily &&
            group.style.fontWeight === style.fontWeight &&
            group.style.color === style.color &&
            group.style.border === style.border && 
            group.style.visible === style.visible &&
            isSamePath(group.style, style)
        ) {
            return index;
        }
    }
    return -1;
}


// returns domain name from passed URL
function domain(url) {
    let hostname;
    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    } else {
        hostname = url.split('/')[0];
    }

    // find & remove port number
    hostname = hostname.split(':')[0];
    // find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

// helper functions used by classifier
const mostly = (g, group) => g.length / group.elements.length > 0.6;
function isNavigation(element) {
    // if (element.name.slice(0, 2) === 'Old')
    let names = dictionary.navigation.name;
    let links = dictionary.navigation.href;
    let elementName = element.name.toLowerCase();
    let elementHref = element.href.toLowerCase();
    for (var nameIndex = 0; nameIndex < names.length; nameIndex++) {
        if (new RegExp(names[nameIndex], 'u').test(elementName)) {
            // name passes navigation check
            for (var hrefIndex = 0; hrefIndex < links.length; hrefIndex++) {
                if (new RegExp(links[hrefIndex], 'u').test(elementHref)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// constants for group types
const MAIN =    0;
const PAGER =   1;
const CATEGROY =2;
const CATEGROY2=3;
const DEFAULT = 4;
const GENERIC = 5;
const OTHER =   6;

// removes any groups/elements that are static between pages, pages are cached
function removeCruftAndClassify(currentResults) {
    let urlMap = {};
    if (process.env.CACHING) {
        writeCache(engine, 'template', currentResults);
        return;
    } else if (engine === 'url') {
        currentResults.groups.slice(0).forEach(group => {
            group.groupType = DEFAULT;

            let cruft = [];
            let jsLink = [];
            let generic = [];
            group.elements.forEach(element => {
                if (dictionary.cruft.includes(element.name.toLowerCase())) {
                    cruft.push(element);
                } else if (isNavigation(element)) {
                    group.groupType = PAGER;
                } else if (element.href.slice(0, 11) === "javascript:") {
                    jsLink.push(element);
                }

                group.elements.forEach(e => {
                    urlMap[e.href] = e;
                })
            });

            let currentIndex = currentResults.groups.indexOf(group);
            if (mostly(cruft, group)) {
                // a lot of generic elements
                currentResults.groups.splice(currentIndex, 1);
            } else if (mostly(jsLink, group)) {
                // a lot of elements that only execute JS, we can't do anything with them yet
                currentResults.groups.splice(currentIndex, 1);
            } else if (group.coverage < thresholds.coverage || group.elements.length < thresholds.numElements) {
                // group is too small to seem significant
                group.groupType = OTHER;
            }
        });
    } else {
        let cache = readCache(engine, 'template');
        // filter out results based on cache
        currentResults.groups.slice(0).forEach(group => {
            group.groupType = DEFAULT;

            let index = findGroupByStyle(cache, group.style);
            let cruft = [];
            let jsLink = [];
            let generic = [];
            let currentIndex = currentResults.groups.indexOf(group);
            if (index !== -1) {
                let cachedGroup = cache.groups[index];
                group.elements.forEach(element => {
                    let found = cachedGroup.elements.find(currentElement => {
                        return currentElement.name === element.name;
                    });
                    if (found) {
                        if (found.href === element.href || !found.name) {
                            // 100% cruft (url and name match)
                            cruft.push(found);
                        } else if (dictionary.cruft.includes(element.name.toLowerCase())) {
                            cruft.push(found);
                        } else {
                            // generic navigational component that may be related to current search
                            // (name matches, url does not)
                            generic.push(found);
                            if (found.name === settings.pager.name &&
                                found.href.includes(settings.pager.href) &&
                                domain(element.href) === domain(settings.query)
                            ) {
                                // this is a pager group
                                group.groupType = PAGER;
                            }
                        }
                    } else if (element.href.slice(0, 11) === "javascript:") {
                        jsLink.push(element);
                    }
                    if (isNavigation(element)) {
                        group.groupType = PAGER;
                    }
                    group.elements.forEach(e => {
                        urlMap[e.href] = e;
                    })
                });

                if (mostly(cruft, group)) {
                    // a lot of generic elements
                    currentResults.groups.splice(currentIndex, 1);
                } else if (!group.pagers && group.elements.length < 2) {
                    // only 1 element in group
                    currentResults.groups.splice(currentIndex, 1);
                } else if (mostly(generic, group) && group.groupType !== PAGER) {
                    // group of generically-named components
                    group.groupType = GENERIC;
                }
            } else {
                group.elements.forEach(e => {
                    urlMap[e.href] = e;
                    if (isNavigation(e)) {
                        // this is needed for now since we're going off of bad query, since the query may not yield
                        // other pages, as we improve caching logic, we can probbaly remove this
                        group.groupType = PAGER;
                    } else if (e.href.slice(0, 11) === "javascript:") {
                        jsLink.push(e);
                    }
                })
            }

            // further classify the group
            if (mostly(jsLink, group)) {
                // a lot of elements that only execute JS, we can't do anything with them yet
                currentResults.groups.splice(currentIndex, 1);
            } else if (
                group.groupType !== PAGER && (
                    group.coverage < (settings.minGroupSize ? settings.minGroupSize : thresholds.coverage) ||
                    group.elements.length < thresholds.numElements
                )
            ) {
                // group is too small to seem significant
                //group.groupType = OTHER;
            }
        })
    }
    writeCache(engine, 'current', urlMap);

    // find main group
    let groupIndex = 0;
    while (groupIndex < currentResults.groups.length) {
        if (currentResults.groups[groupIndex].groupType === DEFAULT) {
            currentResults.groups[groupIndex].groupType = MAIN;
            break;
        }
    }

    return currentResults.groups.sort((a, b) => a.groupType - b.groupType);
}

// load engine-specific settings
let settings;
if (engine !== 'url') {
    try {
        settings = require('./engines/' + engine);
    } catch (e) {
        if (/Cannot find module/.test(e)) {
            console.log('No configuration exists for ' + engine);
        } else {
            console.log(engine + '.json: ' + e);
        }
        process.exit(1);
    }
}

const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

(async () => {
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
        ],
        ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    // skip downloading images
    page.on('request', request => {
        if (request.resourceType() === 'image') {
            request.abort();
        } else {
            request.continue();
        }
    });

    // page.on('console', msg => console.log('page log: ' + msg.text()));

    if (process.env.CACHING) {
        // caching page structure
        await page.goto(settings.query + encodeURIComponent(settings.badQuery));
    } else if (engine === "url") {
        // go directly to this page (direct)
        let url = query;
        if (!isValidUrl(url)) {
            url = 'http://' + url;
        }
        await page.goto(url);
    } else if (isValidUrl(query) && domain(query) === domain(settings.query)) {
        // go directly to this page (navigational)
        await page.goto(query);
    } else {
        // start a new search with query
        let modifier = settings.resultModifier ? settings.resultModifier + (process.env.RESULTS || settings.resultsPerPage || 20) : '';
        await page.goto(settings.query + encodeURIComponent(query) + modifier);
    }
    // await page.screenshot({path: 'example.png'});
    let results = await page.evaluate((columns, weights, settings) => {

        /** LIST OF LOGIC TO BE USED */


        // test if DOM element is visible to end user
        function isVisible(elem) {
            if (!(elem instanceof Element)) throw Error('DomUtil: elem is not an element.');
            var style = getComputedStyle(elem);
            var rect = elem.getBoundingClientRect();
            if (style.display === 'none') return false;
            if (style.visibility !== 'visible') return false;
            if (parseFloat(style.opacity) < 0.1) return false;
            if (elem.offsetWidth + elem.offsetHeight + rect.height + rect.width === 0) {
                return false;
            }
            return true;
        }

        // squishes node into its CSS selector
        function extractCssSelector(node) {
            return node.tagName + 
                (node.id ? '#' + node.id : '') + 
                (node.className ? '.' + Array.prototype.join.call(node.classList, '.') : '');
        }

        // find DOM element ancestors
        function listParents(node) {
            var nodes = [extractCssSelector(node)]
            for (; node; node = node.parentNode) {
                nodes.unshift(extractCssSelector(node))
            }
            return nodes
        }

        // get visual style for a single DOM element
        function getStyle(element) {
            var style = window.getComputedStyle(element);
            var dimensions = element.getBoundingClientRect();
            return {
                fontSize: style.fontSize, 
                fontFamily: style.fontFamily, 
                fontWeight: style.fontWeight, 
                color: style.color,
                background: style.backgroundColor,
                border: style.border, 
                visible: isVisible(element),
                display: style.display,
                loc: {
                    x: dimensions.left,
                    y: dimensions.top,
                    h: dimensions.height,
                    w: dimensions.width
                }
            };
        }

        // extract important DOM element properties into serializable JSON object
        function extract(element) {
            return {
                tag: element.tagName,
                css: getStyle(element),
                href: element.href,
                name: element.innerText ? element.innerText.trim() : '', 
                classes: [...element.classList], 
                path: listParents(element),
                id: element.id
            };
        }

        // compute encompassing region given 2 child regions
        function combineRegion(region1, region2) {
            var minX = Math.min(region1.x, region2.x);
            var minY = Math.min(region1.y, region2.y);
            var maxX = Math.max(region1.x + region1.w, region2.x + region2.w);
            var maxY = Math.max(region1.y + region1.h, region2.y + region2.h);

            return {
                x: minX,
                y: minY,
                w: maxX - minX,
                h: maxY - minY
            };
        }

        // helper function for expandSelection
        function isSameStyle(a, b) {
            a = getStyle(a);
            b = getStyle(b);

            if (
                a.fontSize === b.fontSize &&
                a.fontFamily === b.fontFamily &&
                a.fontWeight === b.fontWeight &&
                a.color === b.color &&
                a.border === b.border && 
                a.visible === b.visible
            ) {
                return true;
            }
            return false;
        }

        // expands selection to elements encompassing the link elements until largest common
        // ancestor is found for all elements in the group (a basis for better preview)
        function expandSelection(elements) {
            let parents = [...elements].map(e => {
                let node = e._node;
                delete e._node;
                return node;
            });
            if (parents.length === 1) {
                // there won't be other elements to compare the context to, assume no context
                return parents;
            }
            let grandParents;
            while (true) {
                grandParents = [];
                for (var i=0; i < parents.length; i++) {
                    let parent = parents[i].parentNode;
                    if (parent === window) {
                        return parents;
                    }
                    if (grandParents.length) {
                        let prev = grandParents[grandParents.length-1];
                        if (prev === parent) {
                            // at least two elements joined, stop analyzing
                            return parents;
                        } else if (!isSameStyle(prev, parent)) {
                            // styles don't match
                            return parents;
                        }
                    }
                    grandParents.push(parent);
                }
                parents = grandParents;
            }
            return parents;
        }

        // fetches details from current selection suitable for rendering later
        function getRenderDetail(node) {
            let detail = extract(node);
            if (detail.css.visible) {
                return {
                    ...detail,
                    children: Array.prototype.map.call(node.childNodes, (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            return node.textContent;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            return getRenderDetail(node);
                        } else {
                            return '';
                        }
                    })
                }
            } else {
                return '';
            }
        }

        // compares children of each node
        function isSameRenderDetail(a, b) {

            // there may be undefined nodes
            if (a === undefined) {
                if (b === undefined) {
                    return true;
                } else {
                    return false;
                }
            } else if (b === undefined) {
                return false;
            }

            // there may be text nodes
            if (a.nodeType === Node.TEXT_NODE) {
                if (b.nodeType === Node.TEXT_NODE) {
                    return true;
                } else {
                    return false;
                }
            } else if (b.nodeType === Node.TEXT_NODE) {
                return false;
            }

            let aSummary = getRenderDetail(a);
            let bSummary = getRenderDetail(b);

            // there may be invisible nodes
            if (aSummary === '') {
                if (bSummary === '') {
                    return true;
                } else {
                    return false;
                }
            } else if (bSummary === '') {
                return false;
            }

            if (
                aSummary.css.fontSize === bSummary.css.fontSize &&
                aSummary.css.fontFamily === bSummary.css.fontFamily &&
                aSummary.css.fontWeight === bSummary.css.fontWeight &&
                aSummary.css.color === bSummary.css.color &&
                aSummary.css.border === bSummary.css.border &&
                [...a.childNodes].every((child, i) => isSameRenderDetail(child, b.childNodes[i]))
            ) {
                return true;
            }
            return false;
        }

        // these parameters are used for normalization later
        let metrics = {
            'max-area': 0,
            'max-coverage': 0,
            'max-textLength': 0,
            'max-context': 0
        };
        // gather metrics
        const updateMax = (group, type) => {
            metrics['max-' + type] = Math.max(metrics['max-' + type], group[type]);
        }

        // group a list of DOM elements by visual style
        function groupByStyle(elements) {
            var groups = [];
            elements.forEach(function (e) {

                // if group already exists, find it and append to it
                for (var i = 0; i < groups.length; i++) {
                    var style = groups[i].style;
                    if (
                        // group should have same color/font
                        e.css.color === style.color &&
                        e.css.fontFamily === style.fontFamily &&
                        e.css.fontSize === style.fontSize &&
                        e.css.fontWeight === style.fontWeight && (
                            // group should resemble some sort of list/tile layout
                            e.css.loc.x === style.loc.x ||
                            e.css.loc.y === style.loc.y ||
                            e.css.loc.x + e.css.loc.w === style.loc.x + style.loc.w ||
                            e.css.loc.y + e.css.loc.h === style.loc.y + style.loc.h
                        ) && isSameRenderDetail(e._node, groups[i].elements[0]._node)
                    ) {
                        groups[i].elements.push(e);
                        groups[i].style.loc = combineRegion(
                            groups[i].style.loc, 
                            e.css.loc
                        );
                        groups[i].coverage = groups[i].style.loc.w * groups[i].style.loc.h;
                        groups[i].area += e.css.loc.w * e.css.loc.h;

                        return;
                    }
                }

                // group doesn't exist, start a new group
                groups.push({
                    // deep-copy the structure, since we will edit size
                    style: { ...e.css, loc: { ...e.css.loc}, path: e.path },
                    elements: [e],
                    area: e.css.loc.w * e.css.loc.h,
                    coverage: e.css.loc.w * e.css.loc.h
                });
            });

            groups.forEach(group => {
                group.textLength = group.elements.reduce((a, v) => { return a + v.name.length }, 0);

                updateMax(group, 'area');
                updateMax(group, 'coverage');
                updateMax(group, 'textLength');
            });

            return groups;
        }

        // helper logic for normalizing significance params and applying weights
        const weigh = (group, field) => {
            let weight = weights[field];
            if (settings && settings.weights && settings.weights[field]) {
                weight = settings.weights[field];
            }
            return weight * group[field] / metrics['max-' + field];
        }

        // returns relative significance of the group based on a number of heuristics
        function significance(group) {
            return weigh(group, 'coverage') + weigh(group, 'area') + weigh(group, 'textLength') + weigh(group, 'context');
        }



        /** END LIST, BEGIN PROGRAM **/



        let elements = document.querySelectorAll('a');
        let relevant = [];
        for (var i = 0; i < elements.length; i++) {
            var e = extract(elements[i]);
            e._node = elements[i];
            if (e.css.visible) {
                relevant.push(e);
            }
        }

        // fill in extra context for better preview later
        let groups = groupByStyle(relevant);
        groups.forEach(group => {
            let parents = expandSelection(group.elements);
            group.context = 0;
            group.elements.forEach((element, index) => {
                element.context = getRenderDetail(parents[index]);
                group.context += parents[index].innerText.length;
            });
            updateMax(group, 'context');
        });
        groups = groups.sort((a, b) => significance(a) < significance(b) ? 1 : -1);

        return {
            groups: groups
        };
    }, process.stdout.columns, weights, settings);

    outputToTerminal('shell', removeCruftAndClassify(results));

    await browser.close();
})();
