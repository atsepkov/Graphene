const puppeteer = require('puppeteer');
const { color, readCache, writeCache } = require('./utils');

const engine = process.argv[2];
const query = process.argv[3];



// populate banner
function banner() {
    if (settings.banner) {
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
        return banner + ' ' + color.reset; // pad and terminate the end
    } else {
        return engine;
    }
}

// output data
function outputToTerminal(format, data) {
    if (format === "json") {
        console.log(JSON.stringify(data));
    } else if (format === 'shell') {
        var curated = banner() + '\n';
        data.groups.forEach(function (group, index) {
            let groupColor;
            if (index === 0) {
                groupColor = color.yellow;
            } else if (group.pagers) {
                groupColor = color.cyan;
            } else if (group.generic) {
                groupColor = color.black;
            } else if (group.other) {
                groupColor = color.black + color.bright;
            } else {
                groupColor = color.white;
            }

            group.elements.forEach(function (element) {
                curated += 
                    groupColor + element.name.replace(/\n/g, ', ').padEnd(parseInt(120 * 2 / 3)) + color.reset + '\t' + 
                    color.blue + color.underscore + element.href + color.reset + (group.pagers ? '\t\t(pager)' : '') + '\n';
            });
        });        
        console.log(curated);
    } else {
        console.log('No format specified');
    }
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
            group.style.level === style.level
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

// removes any groups/elements that are static between pages, pages are cached
function removeCruftAndClassify(currentResults) {
    let cache = readCache(engine, 'template');
    if (cache.groups) {
        // filter out results based on cache
        let urlMap = {};
        cache.groups.forEach(group => {
            let index = findGroupByStyle(currentResults, group.style);
            let cruft = [];
            let generic = [];
            if (index !== -1) {
                let currentGroup = currentResults.groups[index];
                group.elements.forEach(element => {
                    let found = currentGroup.elements.find(currentElement => {
                        return currentElement.name === element.name;
                    });
                    if (found) {
                        if (found.href === element.href || !found.name) {
                            // 100% cruft (url and name match)
                            cruft.push(found);
                        } else {
                            // generic navigational component that may be related to current search
                            // (name matches, url does not)
                            generic.push(found);
                            if (found.name === settings.pager.name &&
                                found.href.includes(settings.pager.href) &&
                                domain(found.href) === domain(settings.query)
                            ) {
                                // this is a pager group
                                currentGroup.pagers = true;
                            }
                        }
                    }
                    currentGroup.elements.forEach(e => {
                        urlMap[e.href] = e;
                    })
                });

                const mostly = (group) => group.length / currentGroup.elements.length > 0.7;
                
                if (mostly(cruft)) {
                    // a lot of generic elements
                    currentResults.groups.splice(index, 1);
                } else if (!currentGroup.pagers && group.elements.length < 2) {
                    // only 1 element in group
                    currentResults.groups.splice(index, 1);
                } else if (mostly(generic)) {
                    // group of generically-named components
                    currentGroup.generic = true;
                } else if (currentGroup.coverage < (settings.minSize ? settings.minSize : 30000)) {
                    // group is too small to seem significant
                    currentGroup.other = true;
                }
            }
        })
        writeCache(engine, 'current', urlMap);
    } else {
        // no cache yet, create it
        writeCache(engine, 'template', currentResults);
    }
    return currentResults;
}

// load engine-specific settings
let settings;
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

const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    /*await page.setRequestInterception(true);

    // skip downloading images
    page.on('request', request => {
        if (request.resourceType() === 'image') {
            request.abort();
        } else {
            request.continue();
        }
    });*/

    page.on('console', msg => console.log(msg.text()));

    if (isValidUrl(query) && domain(query) === domain(settings.query)) {
        // go directly to this page
        await page.goto(query);
    } else {
        // start a new search with query
        await page.goto(settings.query + encodeURIComponent(query));
    }
    // await page.screenshot({path: 'example.png'});
    let results = await page.evaluate((columns) => {

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

        // find DOM element ancestors
        function parents(node) {
            var nodes = [node]
            for (; node; node = node.parentNode) {
                nodes.unshift(node)
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
                border: style.border, 
                visible: isVisible(element),
                level: parents(element).length, 
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
                a.visible === b.visible &&
                a.level === b.level
            ) {
                return true;
            }
            return false;
        }

        // expands selection to elements encompassing the link elements until largest common
        // ancestor is found for all elements in the group (a basis for better preview)
        function expandSelection(nodes) {
            let parents = [...nodes].map(e => {
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
                            console.log('prev parent same', JSON.stringify(extract(parent)))
                            return parents;
                        } else if (!isSameStyle(prev, parent)) {
                            // styles don't match
                            console.log('style mistmatch', JSON.stringify(extract(prev)), JSON.stringify(extract(parent)))
                            return parents;
                        }
                    }
                    grandParents.push(parent);
                }
                console.log('expanded parents for tag: ', parents[0].tagName)
                parents = grandParents;
            }
            return parents;
        }

        // fetches details from current selection suitable for rendering later
        function getRenderDetail(node) {
            let detail = {
                ...extract(node),
                children: Array.prototype.map.call(node.childNodes, function (element) {
                    if (element.nodeType === Node.TEXT_NODE) {
                        return element.textContent;
                    } else if (element.nodeType === Node.ELEMENT_NODE) {
                        return getRenderDetail(element);
                    } else {
                        return '';
                    }
                })
            };
            if (detail.css.visible) {
                return detail;
            } else {
                return '';
            }
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
                        )
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

                // otherwise start a new group
                groups.push({
                    // deep-copy the structure, since we will edit size
                    style: { ...e.css, loc: { ...e.css.loc} },
                    elements: [e],
                    area: e.css.loc.w * e.css.loc.h,
                    coverage: e.css.loc.w * e.css.loc.h
                });
            });

            return groups;
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
        let groups = groupByStyle(relevant).sort((a, b) => a.coverage < b.coverage ? 1 : -1);
        groups.forEach(group => {
            let parents = expandSelection(group.elements);
            group.elements.forEach((element, index) => {
                element.context = getRenderDetail(parents[index]);
            });
        });

        return {
            groups: groups
        };
    }, process.stdout.columns);

    outputToTerminal('shell', removeCruftAndClassify(results));

    await browser.close();
})();
