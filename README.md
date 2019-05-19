Interceptor Browser
===================
This is basically a text-based browser / search engine aggregator. It allows you to search the web through the terminal. It's still a work in progress,
but works decently well. The original inspiration for this project was Ranger File Manager, but after realizing that adapting it from local browsing to
the web would require a significant rewrite, I put the project aside. Then, a couple months later, I stumbled into FZF, and figured I'd give this tool
a try again using FZF instead of Ranger as a core. And this is the result.

Usage
=====
```
interceptor [engine] [query]
```

Result: An FZF query with a set of links from the page classified as follows:
- golden/yellow: main group (probably results you meant to search for)
- white: regular group, if golden group is wrong, your results may be here
- black/gray: most-likely cruft (irrelevant/generic page links)
- cyan: navigational links that will result in query to be reperformed instead of opening the page

Selecting a result will open it in your browser of choice, unless the result is a navigational (cyan) link, which will re-trigger the search with new
offset.
