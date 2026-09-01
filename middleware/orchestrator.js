/*
 * The main middleware handler, governing the overall behaviour
 */

const fs = require("fs");
const path = require("node:path");
const systemDir = __dirname.replace(path.sep + "middleware", "");

const convertMarkdown = require("./markdown");
const getFileContent = require("./file-loader");

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
        writeContent(getFileContent(filepath, rootDir), res);
        return;
    }

    // Check for favicon
    if (url === "/favicon.ico") {
        const filepath = systemDir + path.sep + "content" + path.sep + "favicon.ico";
        writeContent(getFileContent(filepath, rootDir, { binary: true }), res);
        return;
    }

    // Check whether we just pass this through as is
    const filepath = rootDir + (path.sep === "/" ? url : url.replace(/\//g, path.sep));
    if (passThrough.includes(extension)) {

        next();
        return
    }

    // Get the content for this page
    const fileContent = getFileContent(filepath, rootDir);
    if (!fileContent) {

        console.error("ERROR File not found: " + filepath);
        res.statusCode = 404;
        res.statusMessage = "Not found";
        res.end();
        return;
    }

    // If this was a request for a raw response, we can just return the content now
    if (urlParams.has("raw")) {

        writeContent(fileContent, res);
        return;
    }

    // Convert the markdown to HTML and send that
    const convertedContent = convertMarkdown(fileContent, parsedUrl, filepath, rootDir);
    writeContent(convertedContent, res);
}
