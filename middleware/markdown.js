const fs = require("fs");
const path = require("node:path");
const systemDir = __dirname.replace(path.sep + "middleware", "");

// Read in our HTML template
const html = fs.readFileSync(systemDir + path.sep + "content" + path.sep + "markdown.html")
               .toString()
               .split("<!-- CONTENT -->");

// Handle anything we need to do server-side with the frontmatter
const handleFrontMatter = (content, html) => {

    // Check there actually is frontmatter
    if (!/^---/.test(content)) {

        return html;
    }

    return html;
};

// Main function to convert markdown
const convertMarkdown = (markdown, url) => {

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

    // Update the initial HTML with title and frontmatter
    let htmlPreamble = html[0].replace(/<!-- TITLE -->/g, pageTitle);
    htmlPreamble = handleFrontMatter(escapedContent, htmlPreamble);
    result = result + htmlPreamble;

    // If it's markdown, we've done what we need
    if (extension === "md" || /^# [^# ]/.test(escapedContent) || /^---/.test(escapedContent)) {
        result = result + escapedContent;

    // Mermaid diagram we use mermaid formatting
    } else if (extension === "mmd") {

        res.write("```mermaid\n");
        res.write(escapedContent);
        res.write("```\n");

    // Anything else we display as text
    } else {

        res.write("```\n");
        res.write(escapedContent);
        res.write("```\n");
    }

    // Remainder of the HTML we need
    result = result + html[1];
    return result;
};

module.exports = convertMarkdown;
