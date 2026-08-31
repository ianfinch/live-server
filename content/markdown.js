/* Settings for this site */
const settings = {

    "dark-mode": true,
    "enhanced-tables": false
};

/* A function to allow plugins to register for actions after markdown
 * conversion is complete
 */
let conversionComplete = false;
const registeredPlugins = [];
window.registerPluginCallback = fn => {

    if (conversionComplete) {

        fn();
    } else {

        registeredPlugins.push(fn);
    }
};

/*
 * When we load a plugin, we may need to delay until all its dependencies are loaded.
 * The parameter dependencyCheck is the function to check the dependency, and it
 * should return true or false
 */
window.waitForDependency = (dependencyCheck, remainingAttempts = 5) => {

    // How long we sleep for
    const sleepMillis = 25;

    // Create a sleep function here, so we don't clutter up the namespace
    const sleep = (delay) => {
        return new Promise((resolve) => {
            setTimeout(() => { resolve(null); }, delay);
        });
    };

    // Check we still have attempts left
    if (remainingAttempts === 0) {

        return Promise.resolve(false);
    }

    // Check the dependency
    if (dependencyCheck()) {

        return Promise.resolve(true);
    }

    // Sleep, then try again
    return sleep(sleepMillis)
            .then( () => waitForDependency(remainingAttempts - 1) );
};

/* Functions to set light or dark mode */
const setDisplayMode = wantDarkMode => {

    // The class name for when we are in dark mode
    const darkModeClassName = "dark-mode";

    return () => {

        // Check whether we are already in dark mode
        const bodyClassList = document.getElementsByTagName("body")[0].classList;
        const inDarkMode = bodyClassList.contains(darkModeClassName);

        // If the mode we are in matches the mode we want, we don't need to do anything
        if ((wantDarkMode && inDarkMode) || (!wantDarkMode && !inDarkMode)) {

            return;
        }

        // Handle the switch to dark mode
        if (wantDarkMode) {

            bodyClassList.add(darkModeClassName);

        // Handle the switch to light mode
        } else {

            bodyClassList.remove(darkModeClassName);
        }
    };
};

const setLightMode = setDisplayMode(false);
const setDarkMode = setDisplayMode(true);

/* Function to toggle expanded status on click */
const addExpandToggle = (elem, targetClassList) => {

    elem.addEventListener("click", () => {
        if (targetClassList.contains("expanded")) {
            targetClassList.remove("expanded");
        } else {
            targetClassList.add("expanded");
        }
    });
};

/* Utility function to create an element */
const createElement = name => {

    const result = {
        value: document.createElement(name),
        addAttribute: (k, v) => { result.value.setAttribute(k, v); return result; }
    };

    return result;
};

/* Function to add a stylesheet to the page */
const addStyleSheet = cssFile => {

    const link = createElement("link")
                    .addAttribute("href", cssFile)
                    .addAttribute("rel", "stylesheet")
                    .addAttribute("type", "text/css")
                    .value;
    const head = document.getElementsByTagName("head")[0];
    head.appendChild(link);
};

/* Function to add a script to the page */
const addScript = jsFile => {

    // Check that script is local
    if (!/^(\/|\.)/.test(jsFile)) {

        alert("Cannot import an external script: " + jsFile);
        return;
    }

    const script = createElement("script")
                    .addAttribute("src", jsFile)
                    .addAttribute("type", "text/javascript")
                    .addAttribute("charset", "utf-8")
                    .value;
    const head = document.getElementsByTagName("head")[0];
    head.appendChild(script);
};

/* Function to handle frontmatter */
const injectFrontmatterImports = frontmatter => {

    if (frontmatter.css) {
        frontmatter.css.split(/, */).forEach(cssFile => {
            addStyleSheet(cssFile);
        });
    }

    if (frontmatter.js) {
        frontmatter.js.split(/, */).forEach(jsFile => {
            addScript(jsFile);
        });
    }
};

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

/* Function to replace standard tables with gridjs */
const useEnhancedTables = () => {

    // If we don't have gridjs available, we can't do anything
    if (!gridjs || !gridjs.Grid) {

        return;
    }

    // Create the enhanced tables if we haven't done that already
    const noEnhancedTablesCreated = document.getElementsByClassName("injected-grid").length === 0;
    if (noEnhancedTablesCreated) {

        [...document.getElementsByTagName("table")].forEach(elem => {

            // Add somewhere for the grid to be displayed
            const targetElem = document.createElement("div");
            targetElem.classList.add("injected-grid");
            elem.after(targetElem);

            // Render the grid
            const grid = new gridjs.Grid({
                from: elem,
                sort: true,
                resizable: true
            }).render(targetElem);
        });

        // gridjs takes care of everything, so we're good to finish now
        return;
    }

    // If we get to here, the grid has already been created, but has been hidden
    [...document.getElementsByClassName("injected-grid")].forEach(grid => {

        grid.style.display = "block";
        grid.previousSibling.style.display = "none";
    });
};

/* Function to use basic tables */
const useBasicTables = () => {

    // We run through the injected tables, hiding them and making the related
    // tables visible
    [...document.getElementsByClassName("injected-grid")].forEach(grid => {

        grid.style.display = "none";
        grid.previousSibling.style.display = "block";
    });
};

/* Function to do the conversion */
const convertMarkdown = async (converter) => {

    // Convert any markdown blocks to HTML
    [...document.getElementsByClassName("markdown")].forEach(elem => {

        const text = elem.textContent.replace(/(```[a-z]+) +/g, "$1");
        const html = converter.makeHtml(text);
        const frontmatter = converter.getMetadata();
        const htmlWithVars = injectFrontmatterVariables(html, frontmatter);
        elem.insertAdjacentHTML("afterend", "<article>" + htmlWithVars + "</article>");
        elem.remove();

        injectFrontmatterImports(frontmatter);
    });

    // Add image expansion where needed
    [...document.querySelectorAll("p > img:only-child")].forEach(elem => {
        addExpandToggle(elem, elem.classList);
    });

    // If we have mermaid diagrams, render them
    mermaid.initialize({ startOnLoad: false });
    await mermaid.run({
        querySelector: ".mermaid",
        postRenderCallback: (id) => {
            const diagram = document.getElementById(id);
            const classes = diagram.parentElement.parentElement.classList;
            diagram.style.width = diagram.style["max-width"];
            diagram.style["max-width"] = "100%";
            addExpandToggle(diagram, classes);
        }
    });
};

/* Set the legend on the enhanced tables button */
const updateTablesButtonLabel = () => {

    const tablesButton = document.getElementById("tables");

    // If we have enhanced tables, we must have injected the grid and the
    // injected grid must be displayed
    const injected = [...document.getElementsByClassName("injected-grid")];
    const usingEnhancedTables = (injected.length > 0 &&
        injected.filter(x => x.style.display.includes("none")).length === 0);

    tablesButton.textContent = usingEnhancedTables ? "Basic tables" : "Enhanced tables";
};

/* Set the legend on the light/dark mode button */
const updateModeButtonLabel = () => {

    const modeButton = document.getElementById("light-dark");
    const inDarkMode = document.getElementsByTagName("body")[0].classList.contains("dark-mode");
    modeButton.textContent = inDarkMode ? "Light mode" : "Dark mode";
};

/* Initialise the menu */
const initMenu = () => {

    // Create a menu
    if (!document.getElementById("menu")) {

        // The overall menu container
        const menu = document.createElement("div");
        menu.id = "menu";

        // The menu button
        const menuButton = document.createElement("button");
        menuButton.textContent = "☰";
        menu.appendChild(menuButton);

        // Somewhere to add the options
        const menuOptions = document.createElement("div");
        menu.appendChild(menuOptions);
        document.getElementsByClassName("content")[0].appendChild(menu);

        // Add in the options
        [ "light-dark", "tables" ].forEach(id => {

            const option = document.createElement("button");
            option.id = id;
            menuOptions.appendChild(option);
        });
    }

    // Make the menu itself work
    const menu = document.getElementById("menu");
    const menuButton = menu.getElementsByTagName("button")[0];
    menuButton.addEventListener("click", e => {

        if (menu.classList.contains("is-active")) {

            menu.classList.remove("is-active");
            menuButton.textContent = "☰";
        } else {

            menu.classList.add("is-active");
            menuButton.textContent = "🗙";
        }
    });

    // Make the mode button work
    document.getElementById("light-dark").addEventListener("click", e => {

        // Use the label on the button to decide what to do
        if (/Light/i.test(e.target.textContent)) {
            setLightMode();
        } else {
            setDarkMode();
        }

        menu.classList.remove("is-active");
        menuButton.textContent = "☰";
        updateModeButtonLabel();
    });
    updateModeButtonLabel();

    // The tables button
    document.getElementById("tables").addEventListener("click", e => {

        if (/Enhanced tables/i.test(e.target.textContent)) {
            useEnhancedTables();
        } else {
            useBasicTables();
        }

        menu.classList.remove("is-active");
        menuButton.textContent = "☰";
        updateTablesButtonLabel();
    });
    updateTablesButtonLabel();
};

// Make all markdown headings one level deeper
const increaseHeaderDepth = content => {

    headingRegex = new RegExp(/^#/, "mg");
    return content.replace(headingRegex, "##");
};

// Move a section into a new parent element
// It takes an element ID and a target element to move it under. It moves all
// elements from the one with that ID up to the next element with the same tag.
// For example if the element with that ID is an h2 heading, it will move
// everything up to the next h2 heading
const moveSection = (id, target) => {

    // Make sure we find an element to copy
    let elem = document.getElementById(id);
    if (elem === null) {

        target.innerHTML = "<h2>Error</h2><p>Cannot find element with ID of " + id + "</p>";
        return;
    }

    // If we've got a match, walk through the siblings until we hit another of
    // the same tag (or run out of elements)
    // Because we are moving elements around, we need to find the next sibling
    // before we move the current element (otherwise we won't find a next
    // sibling if we check after we've moved it)
    const tagName = elem.nodeName;
    let nextElem;
    do {
        nextElem = elem.nextSibling;
        target.appendChild(elem);
        elem = nextElem;
    } while (nextElem !== null && nextElem.nodeName !== tagName);
};

// Populate the sidebar
const populateSidebar = (converter) => {

    // If the sidebar is already populated, we don't need to do anything
    const sidebar = document.getElementById("sidebar");
    if (sidebar.textContent) {

        return;
    }

    // Check whether the front matter wants us to do anything with the sidebar
    const frontmatter = converter.getMetadata();
    if (frontmatter.sidebar) {

        // Are we hiding the sidebar?
        if (frontmatter.sidebar === "none") {

            // Do nothing

        // If we start with a hash, look in the content for something with that ID
        } else if (frontmatter.sidebar.substr(0, 1) === "#") {

            moveSection(frontmatter.sidebar.substr(1), sidebar);

        // If it starts with a dot, it's a file we need to load
        } else if (frontmatter.sidebar.substr(0, 1) === ".") {

            const url = new URL(frontmatter.sidebar, location.href).toString() + "?raw";
            fetch(url)
                .then(response => response.text())
                .then(markdown => converter.makeHtml(markdown))
                .then(html => { sidebar.innerHTML = html; })
                .catch(err => { sidebar.innerHTML = "<h2>Error</h2><p>" + err + "</p>"; });

        // Anything else, put it directly into the sidebar as text
        } else {

            sidebar.textContent = frontmatter.sidebar;
        }

    // If the front matter doesn't specify any sidebar content, we will use the
    // directory. We know that we are working with either a markdown or HTML
    // file, so we just need to remove filename.md or filename.html from the
    // end of the URL
    } else {

        const directory = location.href.replace(/\/[^\/.]*\.(md|html)/, "");
        fetch(directory + "?raw")
            .then(response => response.text())
            .then(markdown => converter.makeHtml(increaseHeaderDepth(markdown)))
            .then(html => { sidebar.innerHTML = html; });
    }
};

// Make the sidebar toggle button work
const initSidebarToggle = () => {

    const toggle = document.getElementById("sidebar-toggle");
    toggle.addEventListener("click", e => {

        const sidebar = document.getElementById("sidebar-container");
        if (sidebar.classList.contains("visible")) {

            sidebar.classList.remove("visible");
            sidebar.classList.add("closed");
            toggle.textContent = "❯";
        } else {

            if (sidebar.classList.contains("closed")) {

                sidebar.classList.remove("closed");
            }
            sidebar.classList.add("visible");
            toggle.textContent = "❮";
        }
    });
};

// Trigger the conversion after the page has completed loading
addEventListener("load", () => {

    // Check whether we need to start with dark mode
    if (settings["dark-mode"]) {

        setDarkMode();
    }

    // We use showdown to do the markdown conversion
    if (typeof showdown !== "undefined") {

        // Set up the converter
        const converter = new showdown.Converter();
        converter.setOption("literalMidWordUnderscores", true);
        converter.setOption("tables", true);
        converter.setOption("tasklists", true);
        converter.setOption("metadata", true);
        converter.setOption("disableForced4SpacesIndentedSublists", true);
        converter.setOption("ghCompatibleHeaderId", true);

        // Do the markdown conversion
        convertMarkdown(converter);

        // Set up our sidebar
        populateSidebar(converter);
    }

    // Set up the button to slide the sidebar in and out
    initSidebarToggle();

    // Set up our menu
    initMenu();

    // Look for any plugins we need to initialise
    conversionComplete = true;
    registeredPlugins.forEach(fn => {

        fn();
    });
});
