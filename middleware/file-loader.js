// Where are our icons?
const fs = require("fs");
const path = require("node:path");
const iconsDir = __dirname.replace(path.sep + "middleware", path.sep + "icons");

// Binary file types
const binaryFiles = [
    "gif",
    "ico",
    "jpg",
    "png"
];

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

const createDirectoryListing = (dirpath, rootDir) => {

    const title = dirpath.replace(rootDir, "");
    return "---\n" +
           "sidebar: none\n" +
           "---\n" +
           "# " + title + "\n" +
           getFilesInDirectory(dirpath, rootDir) + "\n\n";
};

/*
 * Get the content of a file
 */
const getFileContent = (filepath, rootDir, options) => {

    // Make sure the file exists
    if (!fs.existsSync(filepath)) {

        return null;
    }

    // Check whether this is a directory
    if (fs.lstatSync(filepath).isDirectory()) {

        return createDirectoryListing(filepath, rootDir);
    }

    // Check for a binary file
    const extn = path.parse(filepath).ext.replace(/^\./, "");
    if (binaryFiles.includes(extn)) {

        return fs.readFileSync(filepath, { flag: "r" });
    }

    // Assume we have text file format
    return fs.readFileSync(filepath, { encoding: "utf8", flag: "r" });
};

module.exports = getFileContent;
