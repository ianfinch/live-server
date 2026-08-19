/**
 * Generate a static version of the site
 */

const markdown = require("./markdown-handler");
const fs = require("fs");
const path = require("path");

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

// Process an output file
const processOutputFile = (content, sourceUrl, targetFile, depth) => {

    // Give markdown files html filenames
    if (/\.md$/.test(targetFile)) {

        // Update the filename
        targetFile = targetFile.replace(/\.md$/, "_md.html");

        // If it's a directory listing, we need to tweak it slightly
        if (/\/_index_md\.html$/.test(targetFile)) {

            // Modify the links because they use a full path
            const linkRegex = RegExp("]\\(" + sourceUrl, "g");
            content = content.replace(linkRegex, "](.");

            // Also remove the source root from the directory title
            const h1Regex = RegExp("# /" + sourceRoot);
            if ("/" + sourceRoot === sourceUrl) {

                content = content.replace(h1Regex, "# /");
            } else {

                content = content.replace(h1Regex, "#");
            }
        }
    }

    // Fix references to other files
    if (/\.html$/.test(targetFile)) {

        let prefix = ".";
        if (depth > 0) {

            prefix = Array(depth).fill("..").join("/");
        }

        // Fix up system links in HTML tags
        content = content.replace(/(src|href)="\/system\//g, "$1=\"" + prefix + "/system/");

        // We may also have system icons in our markdown
        content = content.replace(/]\(\/system\/icons\//g, "](" + prefix + "/system/icons/");

        // We also need to take care of system and plugin links (in frontmatter)
        content = content.replace(/ \/plugins\//g, " " + prefix + "/plugins/");
        content = content.replace(/ \/system\/plugins\//g, " " + prefix + "/system/plugins/");

        // Update any links to *.md to be *_md.html
        content = content.replace(/\.md\)/g, "_md.html)");

        // Assume that a link ending with a slash is a directory, so add a
        // link to the directory listing file
        content = content.replace(/\/\)/g, "/_index_md.html)");
    }

    // Write the file
    fs.writeFileSync(targetFile, content);
};

// Functions to write the result from the markdown middleware
const resultWriter = (sourceUrl, targetFile, depth) => {

    // Somewhere to store our result
    let result = "";

    return {
        statusCode: 200,
        statusMessage: "Success",
        setHeader: () => {},
        write: content => { result = result + content; },
        end: () => {

            processOutputFile(result, sourceUrl, targetFile, depth);
            result = "";
        }
    };
};

// Function to just copy a file across
const fileCopier = (sourceFile, targetFile) => {

    return () => {

        fs.copyFileSync(sourceFile, targetFile);
    };
};

// Copy a directory across
const generateDirectory = (source, target, depth = 0) => {

    const files = fs.readdirSync(source, { withFileTypes: true });
    files.forEach(file => {

        const sourceFile = file.parentPath + path.sep + file.name;
        const sourceUrl = "/" + sourceFile;
        const targetFile = target + path.sep + file.name;
        if (fs.lstatSync(sourceFile).isDirectory()) {

            // If we don't have the target directory, create it
            if (!fs.existsSync(targetFile)) {

                fs.mkdirSync(targetFile);
            }

            // Generate an index file for the directory
            markdown(sourceUrl, pwd, resultWriter(sourceUrl, targetFile + "/_index.md", depth + 1), () => null);

            // Copy over the directory contents
            generateDirectory(sourceFile, targetFile, depth + 1);
        } else {

            markdown(sourceUrl, pwd, resultWriter(sourceUrl, targetFile, depth), fileCopier(sourceFile, targetFile));
        }
    });
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

markdown(path.sep + sourceRoot, pwd, resultWriter("/" + sourceRoot, "." + path.sep + targetRoot + path.sep + "_index.md", 0), () => null);
generateDirectory(sourceRoot, targetRoot);
createSystemFiles(targetRoot, pluginDir);
