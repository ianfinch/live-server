/**
 * Find files to match URL requests and handle any markdown content
 */

const fs = require("fs");
const path = require("node:path");

// Work out where our system directory is
const systemDir = __dirname.replace(path.sep + "middleware", "");

// And icons
const iconsDir = __dirname.replace(path.sep + "middleware", path.sep + "icons");

// List of file extensions to pass through unchanged
const passThrough = [
    "css",
    "dxf",
    "gif",
    "htm",
    "html",
    "jpg",
    "js",
    "mjs",
    "pdf",
    "png",
    "svg"
];

// MIME types
const mime = {
    css:  "text/css",
    htm:  "text/html",
    html: "text/html",
    js:   "text/javascript",
    mjs:  "text/javascript",
    svg:  "image/svg+xml"
};

// Read in our HTML template
const html = fs.readFileSync(systemDir + path.sep + "content" + path.sep + "markdown.html").toString().split("<!-- CONTENT -->");

// Work out which icon to use for a file
const getIcon = file => {

    // Somewhere to keep the icon name
    let icon = "blank";

    // We may want to know the file extension
    const extn = path.parse(file.name).ext.replace(/^\./, "");

    // Special cases
    if (file.name === ".git") { icon = "folder-git"; }
    else if (/ignore$/.test(file.name)) { icon = "gitignore"; }
    else if (/^\.docker/.test(file.name)) { icon = "docker"; }

    // Directories
    else if (file.isDirectory()) { icon = "folder"; }

    // Simple extensions
    else if (extn) { icon = extn; }

    // Check the icon exists
    icon = icon + ".svg";
    if (!fs.existsSync(iconsDir + path.sep + icon)) {
        icon = "blank.svg";
    }

    // Give up trying to work it out
    return icon;
};

// Get a directory listing ready for formatting as markdown
const getFilesInDirectory = (dirpath, rootDir) => {

    const doubleSlash = RegExp("\\" + path.sep + "\\" + path.sep);

    return fs.readdirSync(dirpath, { withFileTypes: true })
                .reduce((result, file) => {

                    const label = file.name;
                    const icon = getIcon(file);
                    const link = (file.parentPath + path.sep + file.name)
                                    .replace(doubleSlash, path.sep)
                                    .replace(rootDir, "")
                                    + ( icon === "folder.svg" ? "/" : "" );
                    const iconTag = "![" + icon + " icon](/system/icons/" + icon + ")";

                    return result.concat(iconTag + "[" + label + "](" + link + ")");
                }, []).join("\n\n---\n\n");
};

// Get the content of a file
const getFileContent = (res, filepath, rootDir, options) => {

    if (fs.existsSync(filepath)) {

        // Handle directories
        if (fs.lstatSync(filepath).isDirectory()) {

            const title = filepath.replace(rootDir, "");
            return "---\n" +
                   "css: /system/plugins/directory.css\n" +
                   "---\n" +
                   "# " + title + "\n" +
                   getFilesInDirectory(filepath, rootDir) + "\n\n";
        }

        // Check for a binary file
        if (options && options.binary) {

            return fs.readFileSync(filepath, { flag: "r" });
        }

        // Assume we have text file format
        return fs.readFileSync(filepath, { encoding: "utf8", flag: "r" });
    }

    console.error("ERROR: File not found: " + filepath);
    return null;
};

// Write the content of a file to the response
const writeFileContent = (res, filepath, rootDir, options) => {

    const fileContent = getFileContent(res, filepath, rootDir, options);
    if (fileContent) {
        res.statusCode = 200;
        res.write(fileContent);
        res.end();
    } else {
        console.error("ERROR File not found: " + filepath);
        res.statusCode = 404;
        res.statusMessage = "Not found";
        res.end();
    }
};

// Actual middleware function
module.exports = function(url, rootDir, res, next) {

    // Get the file extension
    const parsedUrl = path.parse(url);
    const extension = parsedUrl.ext.replace(/^\./, "");

    // Check whether this is a system file or the plugins directory
    if (/^\/system\//.test(url) || /^\/plugins\//.test(url)) {

        let filepath = url;
        filepath = filepath.replace(/^\/system\/lib\//, systemDir + path.sep + "lib" + path.sep);
        filepath = filepath.replace(/^\/system\/content\//, systemDir + path.sep + "content" + path.sep);
        filepath = filepath.replace(/^\/system\/icons\//, systemDir + path.sep + "icons" + path.sep);
        filepath = filepath.replace(/^\/system\/plugins\//, systemDir + path.sep + "plugins" + path.sep);
        filepath = filepath.replace(/^\/plugins\//, rootDir + path.sep + "plugins" + path.sep);
        res.setHeader("Content-Type", mime[extension] || "text/plain");
        writeFileContent(res, filepath, rootDir);
        return;
    }

    // Check for favicon
    if (url === "/favicon.ico") {
        const filepath = systemDir + path.sep + "content" + path.sep + "favicon.ico";
        writeFileContent(res, filepath, rootDir, { binary: true });
        return;
    }

    // Check whether we just pass this through as is
    const filepath = rootDir + (path.sep === "/" ? url : url.replace(/\//g, path.sep));
    if (passThrough.includes(extension)) {

        next();
        return
    }

    // From here on down, we are treating as markdown
    // Work out the name of this page and get the content
    const filename = parsedUrl.base;
    const fileContent = getFileContent(res, filepath, rootDir);
    if (fileContent === null) {
        return;
    }
    let escapedContent = fileContent.replace(/&/g, "&amp;")
                                    .replace(/</g, "&lt;")
                                    .replace(/>/g, "&gt;");

    // If we don't have a final newline, add one
    if (escapedContent.substr(-1) !== "\n") {
        escapedContent = escapedContent + "\n";
    }

    // Take the first heading as the page title (or use the file path)
    const dirname = parsedUrl.dir + ( parsedUrl.dir === "/" ? "" : "/");
    let pageTitle = fileContent.replace(/^[^#]*/, "").replace(/[\r\n].*/s, "");
    if (/^# /.test(pageTitle)) {

        pageTitle = pageTitle.substr(2);
    } else {

        pageTitle = dirname + filename;
    }

    // Render as HTML and embed the file contents
    res.write(html[0].replace(/<!-- TITLE -->/g, pageTitle));

    // If it's markdown, we render it
    if (extension === "md" || /^# [^# ]/.test(escapedContent) || /^---/.test(escapedContent)) {
        res.write(escapedContent);

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
    res.write(html[1]);
    res.end();
}
