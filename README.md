Graphene Text Browser
========================
[![Graphene Demo](https://asciinema.org/a/249148.svg)](https://asciinema.org/a/249148)

A text-based browser / search aggregator. It allows you to search the web through the terminal in a style that makes the most
sense in the terminal. It does not try to emulate a GUI browser in the terminal or replace it, because the terminal was not meant for that, and that
just creates a miserable experience for the user. Once you find the page of interest, you can preview it as markdown (`[F1]`) or open it
in your browser of choice (`[Enter]`).

Main use case is to minimize context switch by starting your search in the termimal (same place you're editing your code), and only jump to the
browser if you found the result you want. This also cuts down distractions that you'll likely encounter in the regular browser, and formats every
page in a consistent way.

This is still a work in progress, but works decently well. The original inspiration for this project was Ranger File Manager, but after realizing that
adapting it from local browsing to the web would require a significant rewrite, I put the project aside. Then, a couple months later, I stumbled into
FZF, and figured I'd give this tool a try again using FZF instead of Ranger as a way to represent results. And this is the result.


Usage
=====
```
graphene [engine] [query]
```
or
```
graphene url [url]
```

Result: An FZF query with a set of links from the page classified as follows:
- golden/yellow: main group (probably results you meant to search for)
- white: regular group, if golden group is wrong, your results may be here
- black/gray: most-likely cruft (irrelevant/generic page links)
- cyan: navigational links that will result in query to be reperformed instead of opening the page

Selecting a result will open it in your browser of choice, unless the result is a navigational (cyan) link, which will re-trigger the search with new
offset. Pressing `F1` will instead load the result as markdown version of the page in Graphene (for text-based pages this works well and often can 
avoid the unnecessary hop to a browser).

While previewing the page via `F1`, you can navigate/search the page using search patterns or simple scrolling. For example, typing `#` will filter
all page headings as search results, effectivelly creating a table of contents for the page. Similarly, typing `` ` `` will filter all code blocks
(useful for navigating directly to the example on websites like MDN).

Other options:
```
graphene history                        # browse search/view history
```

Installation
============
Project currently uses the following dependencies:

- FZF
- node.js
- puppeteer

To install on OSX/Linux:

```
brew/apt-get/dnf install fzf
npm install puppeteer
```

Add the project directory to `$PATH`, i.e. by adding this to your `.bash_profile`:

```
export PATH="/path/to/graphene:$PATH"
```

Roadmap
=======
I've built this mainly for myself, the initial set of features are mainly driven by my own use case an aesthetics. What I would like to add (when time allows):

- Identification of categorizing components (tags (github, npm), search subtypes (github, google, amazon)).
- Authentication/login (i.e. for searching your email).
- Ability to trigger a category/subtype search (i.e. search issue list of specific github repo).
- Use of `goodQuery` setting to improve initial calibration.

Configuration
=============
If you want to add a new engine that I haven't included, look at an example of an existing engine in `engines` directory and customize it accordingly.
The only required field is `query` (url used to formulate a search query). For best results, you should fill in as many parameters for the engine as possible.
If your engine works well, feel free to contribute it back to this repository. Here is an explanation of each field:

```
{
    "banner": "Banner you want displayed to the user performing the search",
    "query": "URL used by the engine as point of entry",
    "goodQuery": "Example of a good query that yields a lot of results (not yet used for calibration)",
    "badQuery": "Example of a bad query that yields few or no results",
    "pager": {
        "name": "Name to search for to identify navigational component (i.e. next/prev page of results)",
        "href": "Unique field in URL to search for that correlates to navigational offset (i.e. page=, start=, etc.)"
    },
    "weights": {
        "context": 2,         // Amount of context per element.
        "coverage": 1,        // Amount of space your elements seem to cover on screen (how spread out they are).
        "area": 1,            // Area correlates with things like font size but may break if you stick a large image inside <a> that's not a main group.
        "textLength": 1,      // Text length is the combined length of all text inside the given group of links.
        "numElements": 0,     // Number of elements in the group, higher weight means groups with more elements will be preferred.
    }
}
```

Queries are used to calibrate the caching mechanism. Pager info is optional (there is a well functioning set of defaults) and is meant for websites where
defaults. Weights are numeric values (these can be integers or floating point) used to calibrate the browser's determination of search result significance
for specific website. For a regular search engine like Google, results would have longer text length and have more contextual text to summarize the result.
For an image-based search engine like Amazon, area taken up by results may be more significant. If your engine is misclassifying the main group, play with
the weights to adjust it.

FAQ
===

#### Will this work with any search engine/website?
Probably not, but it has worked with more than I expected, and will continue to improve.

#### Can this profile a page that's not a search engine?
Yes it can, and it falls back to defaults, which usually work well but may epic-fail on some websites. You can pass an exact URL instead of the query to open.
Instead of engine, use `url` keyword. This seems to work with websites like Slashdot, with Reddit it fails to find the pager (which loads dynamically via scroll).
If you have ideas for how to handle this case or other improvements, feel free to contribute.

#### Will this work if I point it to a specific news story or blog entry via `url` keyword?
Not yet, but almost. This is not meant to be a complete replacement for your regular browser. It's designed to process aggregate-based webpages and extracting key
information for each link. It can extract arbitrary text from a webpage and render it as markdown, but for now you need to drive from an aggregate website first.

#### How does it work? How does it know which groups are signfiicant and which is the main one?
It uses heuristics similar to what a human would do when navigating to a page. Groups that take up more visual space on the page are deemed more important.
Groups whose elements don't change at all between searches are deemed unimportant, groups whose names don't change but urls do are navigational (they apply
to the search in some way but aren't part of the results).

#### Can this be made faster/smarter by specifying the exact class/id of the results group?
That's typically what scrapers do, and why they're easy to break with minor changes to the search engine. This aggregator uses more generic heuristics
and therefore harder to fool. For example, Google runs some sort of uglifier on their frontend. This uglifier mangles class/id names. These names then
stay consistent between searches (giving you the illusion of your selector working), but change every time Google redeploys their frontend (which happens
several times per week). This aggregator doesn't care about changes like that, it analyzes link significance on the page the same way a human would. Moreover,
even if the engine decides to change the page in a significant way, the aggregator should be able to adapt to it after clearing your old cache.

#### Does this comply with terms of use for the websites being aggregated?
Most websites should be fine with it (especially since I'm not explicitly blocking ads - they'd just get classified into one of the less relevant categories).
I'm also not monetizing their results in any way, which is typically what triggers them to go after you. Some websites do indeed have very draconic 
(and probably unenforcable) policies, worst thing they'll do is block puppeteer from being able to crawl their website or temporarily ban the abusing IP.
