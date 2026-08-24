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

    const script = createElement("script")
                    .addAttribute("src", jsFile)
                    .addAttribute("type", "text/javascript")
                    .addAttribute("charset", "utf-8")
                    .value;
    const head = document.getElementsByTagName("head")[0];
    head.appendChild(script);
};

/* Function to handle frontmatter */
const handleFrontmatter = frontmatter => {

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
        elem.insertAdjacentHTML("afterend", "<article>" + html + "</article>");
        elem.remove();

        handleFrontmatter(converter.getMetadata());
    });

    // Update the title with the first h1 on the page
    const headers = document.getElementsByTagName("h1");
    if (headers.length > 0) {

        const headerText = headers[0].textContent;
        const title = document.getElementsByTagName("title");
        if (title.length > 0) {

            title[0].textContent = headerText;
        }
    }

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

    // Publish an event to allow post-conversion activities
    window.dispatchEvent(new Event("markdownConverted"));
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

/* Set the legend on the plugin enablement button */
const updatePluginsButtonLabel = () => {

    const pluginsButton = document.getElementById("plugins");
    pluginsButton.textContent = "Enable plugins";
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

        const menu = document.createElement("div");
        menu.id = "menu";
        document.getElementsByTagName("body")[0].appendChild(menu);

        [ "light-dark", "tables", "plugins" ].forEach(id => {

            const option = document.createElement("button");
            option.id = id;
            menu.appendChild(option);
        });
    }

    // Make the mode button work
    document.getElementById("light-dark").addEventListener("click", e => {

        // Use the label on the button to decide what to do
        if (/Light/i.test(e.target.textContent)) {
            setLightMode();
        } else {
            setDarkMode();
        }

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

        updateTablesButtonLabel();
    });
    updateTablesButtonLabel();

    // The plugins button
    updatePluginsButtonLabel();
};

// Populate the sidebar
const populateSidebar = (converter) => {

    // If the sidebar is already populated, we don't need to do anything
    const sidebar = document.getElementById("sidebar");
    if (sidebar.textContent) {

        return;
    }

    // Work out the directory. We know that we are working with either a
    // markdown or HTML file, so we just need to remove filename.md or
    // filename.html from the end of the URL
    const directory = location.href.replace(/\/[^\/.]*\.(md|html)/, "");
    fetch(directory + "?raw")
        .then(response => response.text())
        .then(markdown => converter.makeHtml(markdown))
        .then(html => { sidebar.innerHTML = html; });
};

// Trigger the conversion after the page has completed loading
addEventListener("load", () => {

    // Let's use dark mode by default (we can do this immediately because it
    // changes the body tag which sits outside the Markdown)
    setDarkMode();

    // We use showdown to do the markdown conversion
    if (typeof showdown !== "undefined") {

        // Set up the converter
        const converter = new showdown.Converter();
        converter.setOption("literalMidWordUnderscores", true);
        converter.setOption("tables", true);
        converter.setOption("tasklists", true);
        converter.setOption("metadata", true);
        converter.setOption("disableForced4SpacesIndentedSublists", true);

        // Do the markdown conversion
        convertMarkdown(converter);

        // Set up our sidebar
        populateSidebar(converter);
    }

    // Set up our menu
    initMenu();
});
