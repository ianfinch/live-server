/*
 * The main middleware handler, governing the overall behaviour
 */

const fs = require("fs");
const path = require("node:path");
const systemDir = __dirname.replace(path.sep + "middleware", "");

const convertMarkdown = require("./markdown");
const createDirectoryListing = require("./directory");

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

// Get the content of a file (this assumes we've already checked that the file
// exists)
const getFileContent = (res, filepath, rootDir, options) => {

        // Check whether this is a directory
        if (fs.lstatSync(filepath).isDirectory()) {

            return createDirectoryListing(filepath, rootDir);
        }

        // Check for a binary file
        if (options && options.binary) {

            return fs.readFileSync(filepath, { flag: "r" });
        }

        // Assume we have text file format
        return fs.readFileSync(filepath, { encoding: "utf8", flag: "r" });
};

// Write the content of a file to the response
const writeContent = (content, res) => {

    res.statusCode = 200;
    res.write(content);
    res.end();
};

// Actual middleware function
module.exports = function(url, rootDir, res, next) {

    // Grab any query string
    const urlParams = new URLSearchParams(url.replace(/^.*?(\?|$)/, ""));
    url = url.replace(/\?.*/, "");

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
        writeContent(getFileContent(res, filepath, rootDir), res);
        return;
    }

    // Check for favicon
    if (url === "/favicon.ico") {
        const filepath = systemDir + path.sep + "content" + path.sep + "favicon.ico";
        writeContent(getFileContent(res, filepath, rootDir), res);
        return;
    }

    // Check whether we just pass this through as is
    const filepath = rootDir + (path.sep === "/" ? url : url.replace(/\//g, path.sep));
    if (passThrough.includes(extension)) {

        next();
        return
    }

    // Make sure the file exists
    if (!fs.existsSync(filepath)) {

        console.error("ERROR File not found: " + filepath);
        res.statusCode = 404;
        res.statusMessage = "Not found";
        res.end();
        return;
    }

    // Get the content for this page
    const fileContent = getFileContent(res, filepath, rootDir);

    // If this was a request for a raw response, we can just return the content now
    if (urlParams.has("raw")) {

        writeContent(fileContent, res);
        return;
    }

    // Convert the markdown to HTML and send that
    const convertedContent = convertMarkdown(fileContent, parsedUrl);
    writeContent(convertedContent, res);
}
