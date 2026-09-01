const fs = require("fs");
const path = require("node:path");
const showdown = require("showdown");
const systemDir = __dirname.replace(path.sep + "middleware", "");

const getFileContent = require("./file-loader");

// Set up the converter
const converter = new showdown.Converter();
converter.setOption("literalMidWordUnderscores", true);
converter.setOption("tables", true);
converter.setOption("tasklists", true);
converter.setOption("metadata", true);
converter.setOption("disableForced4SpacesIndentedSublists", true);
converter.setOption("ghCompatibleHeaderId", true);

// Read in our HTML template
const html = fs.readFileSync(systemDir + path.sep + "content" + path.sep + "markdown.html")
               .toString()
               .split("<!-- CONTENT -->");

/*
 * Function to insert variables from fontmatter into the page
 * Variables are defined in the frontmatter as vars.<key>: <value>
 * Insertion into the content is indicated by {% <key> %}
 */
const injectFrontmatterVariables = (content, frontmatter) => {

    Object.keys(frontmatter).forEach(key => {

        if (/^vars\./.test(key)) {

            const regex = new RegExp("{% *" + key.substr(5) + " *%}", "g");
            content = content.replace(regex, frontmatter[key]);
        }
    });

    return content;
};

/* Function to inject JS and CSS from frontmatter */
const injectFrontmatterImports = frontmatter => {

    let result = "";

    if (frontmatter.css) {
        frontmatter.css.split(/, */).forEach(cssFile => {
            result = result + '<link href="' + cssFile + '" rel="stylesheet" type="text/css" />' + "\n";
        });
    }

    if (frontmatter.js) {
        frontmatter.js.split(/, */).forEach(jsFile => {

            result = result + '<script src="' + jsFile +
                              '" type="text/javascript" charset="utf-8"></script>' + "\n";
        });
    }

    return result;
};

/*
 * Grab content from HTML, so we can move it
 *
 * It takes an element ID It grabs all elements from the one with that ID up to
 * the next element with the same tag. For example if the element with that ID
 * is an h2 heading, it will move everything up to the next h2 heading
 *
 * It's using regexes, which is not elegant, but I'm trying to avoid using
 * jsdom unless there's a bigger use case for it
 */
const findSectionToMove = (content, id) => {

    // First find which tag has this ID
    const idRegex = new RegExp('<[^<>]+id="' + id);
    const idMatch = content.match(idRegex);
    if (!idMatch) {

        return "Cannot find match for id " + id;
    }

    // Now search for that tag plus the content from there up to the next
    // occurrence of the same tag
    const tag = idMatch[0].split(" ")[0].substr(1);
    const sectionRegex = new RegExp('<' + tag + ' [^<>]*id="' + id + '.*?(?=<' + tag + ')', "s");
    const sectionMatch = content.match(sectionRegex);
    if (!sectionMatch) {

        return "Cannot find section matching id " + id;
    }

    return sectionMatch[0];
};

/*
 * Grab or load the content for the sidebar
 */
const createSidebarContent = (bodyContent, frontmatter, filepath, rootDir) => {

     let sidebarContent = "";

     // Does the frontmatter tell us what to do?
     if (frontmatter.sidebar) {

        // Sidebar could be empty
        if (frontmatter.sidebar === "none") {

        // If we start with a hash, look in the content for something with that ID
        } else if (frontmatter.sidebar.substr(0, 1) === "#") {

            sidebarContent = findSectionToMove(bodyContent, frontmatter.sidebar.substr(1));
            bodyContent = bodyContent.replace(sidebarContent, "");

        // If it starts with a dot, it's a file we need to load
        } else if (frontmatter.sidebar.substr(0, 1) === ".") {

            // We only need to do basic markdown conversion
            const sidebarFile = path.resolve(path.dirname(filepath), frontmatter.sidebar);
            sidebarContent = converter.makeHtml(getFileContent(sidebarFile, rootDir));

        // Anything else, put it directly into the sidebar as text
        } else {

            sidebarContent = frontmatter.sidebar;
        }

     // If not, we will use a directory listing
     } else {

         const dirMarkdown = getFileContent(path.dirname(filepath), rootDir);

         // We want to move all headings down a level for a sidebar listing
         const headingRegex = new RegExp(/^#/, "mg");
         const dirForSidebar = dirMarkdown.replace(headingRegex, "##");
         sidebarContent = converter.makeHtml(dirForSidebar);
     }

     return [ bodyContent, sidebarContent ];
};

/*
 * Function to do the actual markdown conversion
 */
const markdownToHtml = (markdown, filepath, rootDir) => {

    // Do the conversion
    let body = converter.makeHtml(markdown);
    body = "<article>\n" + body + "\n</article>";
    const frontmatter = converter.getMetadata();
    body = injectFrontmatterVariables(body, frontmatter);

    // Handle any header changes
    let header = "";
    header = header + injectFrontmatterImports(frontmatter);

    // Populate the sidebar
    let sidebar;
    [ body, sidebar ] = createSidebarContent(body, frontmatter, filepath, rootDir);

    return [ header, body, sidebar ];
};

/*
 * Main function to convert markdown
 */
const convertMarkdown = (markdown, url, filepath, rootDir) => {

    let result = "";
    const extension = url.ext.replace(/^\./, "");

    let escapedContent = markdown.replace(/&/g, "&amp;")
                                 .replace(/</g, "&lt;")
                                 .replace(/>/g, "&gt;");

    // If we don't have a final newline, add one
    if (escapedContent.substr(-1) !== "\n") {
        escapedContent = escapedContent + "\n";
    }

    // Take the first heading as the page title (or use the file path)
    const dirname = url.dir + ( url.dir === "/" ? "" : "/");
    const titleRegex = new RegExp("^#[^#].*", "m");
    let pageTitle = markdown.match(titleRegex);
    if (pageTitle) {

        pageTitle = pageTitle[0].substr(2);
    } else {

        pageTitle = dirname + url.base;
    }

    // If it's markdown, we've done what we need
    if (extension === "md" || /^# [^# ]/.test(escapedContent) || /^---/.test(escapedContent)) {
        result = result + escapedContent;

    // Mermaid diagram we use mermaid formatting
    } else if (extension === "mmd") {

        result = result + "```mermaid\n";
        result = result + escapedContent;
        result = result + "```\n";

    // Anything else we display as text
    } else {

        result = result + "```\n";
        result = result + escapedContent;
        result = result + "```\n";
    }

    // Convert the markdown to HTML
    [ header, result, sidebar ] = markdownToHtml(result, filepath, rootDir);

    // Assemble the full page
    let htmlPreamble = html[0].replace(/<!-- TITLE -->/g, pageTitle);
    htmlPreamble = htmlPreamble.replace("</head>", header + "</head>");
    htmlPreamble = htmlPreamble.replace("<!-- SIDEBAR -->", sidebar);
    result = htmlPreamble + result + html[1];

    return result;
};

module.exports = convertMarkdown;
