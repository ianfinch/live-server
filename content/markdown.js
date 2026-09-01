/* Settings for this site */
const settings = {

    "dark-mode": true,
    "enhanced-tables": false
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
const addMarkdownEnhancements = async (converter) => {

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

    // Dynamic content
    addMarkdownEnhancements(converter);

    // Set up the button to slide the sidebar in and out
    initSidebarToggle();

    // Set up our menu
    initMenu();
});
