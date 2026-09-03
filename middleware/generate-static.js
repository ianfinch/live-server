/**
 * Generate a static version of the site
 */

const fs = require("fs");
const path = require("path");

const convertMarkdown = require("./markdown");
const getFileContent = require("./file-loader");

// Check the user has passed in a source and target directory
if (process.argv.length !== 4 && process.argv.length !== 5) {

    console.error("Syntax: " + path.basename(process.argv[1]) + " <source directory> <target directory> [<plugin directory>]");
    process.exit(1);
}

// Want to know where we are working from
const pwd = process.cwd();

// Quick reference for the directories
const sourceRoot = process.argv[2];
const targetRoot = process.argv[3];
const pluginDir = process.argv[4] || sourceRoot + "/plugins";

// Check we have directories
if (!fs.existsSync(sourceRoot)) {

    console.error("Error: " + sourceRoot + " directory does not exist");
    process.exit(1);
}

if (!fs.existsSync(targetRoot)) {

    console.error("Info: Creating " + targetRoot);
    fs.mkdirSync(targetRoot);
}

/*
 * Tidy up directory listings
 */
const processDirectoryListing = (content, sourceUrl, heading = "h1") => {

    // Modify the links because they use a full path
    const dirpath = sourceUrl.replace(pwd, "");
    const linkRegex = new RegExp('href="' + dirpath, "g");
    content = content.replace(linkRegex, 'href=".');

    // Also remove the source root from the directory headings and title
    const mdHeadingRegex = new RegExp("(<" + heading + "[^>]*>)/" + sourceRoot, "g");
    content = content.replace(mdHeadingRegex, "$1");

    return content;
};

/*
 * Find the sidebar and fix any directory links in there
 */
const fixSidebarListing = (content, sourceFile) => {

    const sidebarRegex = new RegExp('<div id="sidebar">.*?</div>', "s");
    const sidebarMatch = content.match(sidebarRegex);
    if (sidebarMatch) {

        const sidebarContent = sidebarMatch[0];
        const sourceDir = sourceFile.replace(/\/[^\/]*$/, "");
        content = content.replace(sidebarContent, processDirectoryListing(sidebarContent, sourceDir, "h2"));
    }

    return content;
};

/*
 * Update links to reflect the static structure
 */
const fixFileReferences = (content, sourceFile, depth) => {

    let prefix = ".";
    if (depth > 0) {

        prefix = Array(depth).fill("..").join("/");
    }

    // Fix up system links in HTML tags
    content = content.replace(/(src|href)="\/system\//g, "$1=\"" + prefix + "/system/");
    content = content.replace(/(src|href)="\/plugins\//g, "$1=\"" + prefix + "/plugins/");

    // We may have a directory listing in the sidebar, so we need to fix links
    // in that too
    content = fixSidebarListing(content, sourceFile);

    // Update any links to *.md to be *_md.html
    content = content.replace(/\.md/g, "_md.html");

    // Assume that a link ending with a slash is a directory, so add a
    // link to the directory listing file
    content = content.replace(/\/"/g, '/_index_md.html"');

    return content;
};

/*
 * Copy a markdown file from source to destination
 */
const copyMarkdownFile = (sourceFile, targetFile, rootDir, depth) => {

    // Give markdown files html filenames
    if (/\.md$/.test(targetFile)) {

        // Update the filename
        targetFile = targetFile.replace(/\.md$/, "_md.html");
    }

    // If the source url has a query string, remove it
    sourceFile = sourceFile.replace(/\?.*/, "");

    // Get the markdown for the file
    let sourceMarkdown = getFileContent(sourceFile, rootDir);

    // Generate the HTML
    let sourceHtml = convertMarkdown(sourceMarkdown, sourceFile, sourceFile, rootDir);

    // If it's a directory listing, we need to tweak it slightly
    if (/\/_index_md\.html$/.test(targetFile)) {

        sourceHtml = processDirectoryListing(sourceHtml, sourceFile);
    }

    // Fix references to other files
    sourceHtml = fixFileReferences(sourceHtml, sourceFile, depth);

    fs.writeFileSync(targetFile, sourceHtml);
};

// Create any system files
const createSystemFiles = (targetDir, pluginDir) => {

    const root = path.dirname(path.dirname(process.argv[1]));

    // Create any directories we need
    [ "/system", "/system/content", "/system/lib", "/system/plugins", "/system/icons", "/plugins", "/plugins/lib" ].forEach(dir => {

        if (!fs.existsSync(targetDir + dir)) {
            fs.mkdirSync(targetDir + dir);
        }
    });

    // Copy across the system files
    const systemSource = root + path.sep;
    const systemTarget = targetDir + path.sep + "system" + path.sep;
    const pluginSource = pluginDir + path.sep;
    const pluginTarget = targetDir + path.sep + "plugins" + path.sep;
    const files = [ fs.readdirSync(root + "/content").map(x => [systemSource + "content/" + x, systemTarget + "content/" + x]),
                    fs.readdirSync(root + "/lib").map(x => [systemSource + "lib/" + x, systemTarget + "lib/" + x]),
                    fs.readdirSync(root + "/plugins").map(x => [systemSource + "plugins/" + x, systemTarget + "plugins/" + x]),
                    fs.readdirSync(root + "/icons").map(x => [systemSource + "icons/" + x, systemTarget + "icons/" + x]),
                    fs.readdirSync(pluginDir).map(x => [pluginSource + x, pluginTarget + x]),
                    fs.readdirSync(pluginDir + "/lib").map(x => [pluginSource + "lib/" + x, pluginTarget + "lib/" + x]),
                  ].flat();
    files.forEach(([source, target]) => {

        if (!fs.lstatSync(source).isDirectory()) {
            fs.copyFileSync(source, target);
        }
    });
};

/*
 * Copy a directory across
 */
const generateDirectory = (source, target, rootDir, depth = 0) => {

    const files = fs.readdirSync(source, { withFileTypes: true });
    files.forEach(file => {

        const sourceFile = file.parentPath + path.sep + file.name;
        const sourceUrl = "/" + sourceFile;
        const targetFile = target + path.sep + file.name;

        // Handle directories
        if (fs.lstatSync(sourceFile).isDirectory()) {

            // If we don't have the target directory, create it
            if (!fs.existsSync(targetFile)) {

                fs.mkdirSync(targetFile);
            }

            // Generate an index file for the directory
            copyMarkdownFile(sourceFile, targetFile + path.sep + "_index.md", rootDir, depth + 1);

            // Copy over the directory contents
            generateDirectory(sourceFile, targetFile, rootDir, depth + 1);

        // Convert markdown files
        } else if (/\.md$/.test(file.name)) {

            copyMarkdownFile(sourceFile, targetFile, rootDir, depth);

        // HTML files need a little tweaking
        } else if (/\.html$/.test(file.name)) {

            /* TBD */ fs.copyFileSync(sourceFile, targetFile);

        // Any other files, just copy them across
        } else {

            fs.copyFileSync(sourceFile, targetFile);
        }
    });
};

createSystemFiles(targetRoot, pluginDir);
generateDirectory(pwd + path.sep + sourceRoot, pwd + path.sep + targetRoot, pwd);
