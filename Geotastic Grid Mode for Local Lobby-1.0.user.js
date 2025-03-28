// ==UserScript==
// @name         Geotastic Grid Mode for Local Lobby
// @description  Grid Mode for Geotastic: Injects Grid Mode UI into settings, continuously polls for changes in the round time (from the time slider) and updates storage, creates a fixed grid overlay on street view with random removal over the round time, and resets the grid when the Next Round button is clicked. The Grid Mode UI is auto‑reinjected if missing.
// @version      1.0
// @match        *://*.geotastic.net/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function(){
    "use strict";

    /************************************
     * Helper Functions
     ************************************/
    // Wait until an element matching the selector appears.
    function waitForElement(selector, callback) {
        const el = document.querySelector(selector);
        if(el){
            callback(el);
        } else {
            setTimeout(() => waitForElement(selector, callback), 500);
        }
    }

    // Parse a time string in "MM:SS" (or "M:SS") format into total seconds.
    function parseTimeLabel(timeStr) {
        const parts = timeStr.split(':');
        if(parts.length !== 2) {
            console.error("Unexpected time format:", timeStr);
            return 0;
        }
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        return minutes * 60 + seconds;
    }

    /************************************
     * Module 1: Grid Mode UI Injection in Settings
     ************************************/
    const styleModule1 = document.createElement('style');
    styleModule1.textContent = `
        /* Layout container as column: switch on top, input below */
        #gridModeUI {
            display: flex;
            flex-direction: column;
            margin-top: 5px;
        }
        /* Transitions for the switch track and thumb */
        #gridModeUI .v-input--switch__track,
        #gridModeUI .v-input--switch__thumb {
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        /* When enabled, the switch track and thumb turn green */
        #gridModeUI.grid-enabled .v-input--switch__track {
            background-color: #4caf50 !important;
        }
        #gridModeUI.grid-enabled .v-input--switch__thumb {
            transform: translateX(100%);
            background-color: #4caf50 !important;
        }
        /* Style the grid squares input: hidden by default, appears below, fixed width */
        #gridSquaresInput {
            display: none;
            margin-top: 5px;
            width: 250px;
            padding: 5px;
            font-size: 14px;
        }
    `;
    document.head.appendChild(styleModule1);

    function injectGridModeUI(container) {
        if(container.querySelector('#gridModeUI')) return;
        const gridHTML = `
            <div id="gridModeUI" class="v-input super-dense v-input--hide-details v-input--dense theme--dark v-input--selection-controls v-input--switch">
                <div class="v-input__control">
                    <div class="v-input__slot">
                        <div class="v-input--selection-controls__input">
                            <input aria-checked="false" id="gridModeSwitch" role="switch" type="checkbox" aria-disabled="false" value="">
                            <div class="v-input--selection-controls__ripple"></div>
                            <div class="v-input--switch__track theme--dark"></div>
                            <div class="v-input--switch__thumb theme--dark"></div>
                        </div>
                        <label for="gridModeSwitch" class="v-label theme--dark" style="position: relative;">Grid Mode</label>
                    </div>
                </div>
                <input id="gridSquaresInput" type="number" placeholder="Enter number of squares" min="1" max="100"/>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', gridHTML);
        console.log("Grid Mode UI injected into container:", container);
        const switchInput = document.getElementById('gridModeSwitch');
        const gridModeUI = document.getElementById('gridModeUI');
        const gridSquaresInput = document.getElementById('gridSquaresInput');

        // Toggle the switch when clicking the container (except on the input).
        gridModeUI.addEventListener('click', (e) => {
            if(e.target.id === 'gridSquaresInput') return;
            switchInput.click();
        });

        switchInput.addEventListener('change', () => {
            if(switchInput.checked) {
                gridSquaresInput.style.display = 'block';
                gridModeUI.classList.add('grid-enabled');
                console.log("Grid Mode enabled.");
            } else {
                gridSquaresInput.style.display = 'none';
                gridModeUI.classList.remove('grid-enabled');
                console.log("Grid Mode disabled.");
            }
        });

        gridSquaresInput.addEventListener('change', () => {
            const squares = parseInt(gridSquaresInput.value, 10);
            if(isNaN(squares) || squares < 1 || squares > 100){
                alert("Please enter a number of squares between 1 and 100.");
                gridSquaresInput.value = "";
                return;
            }
            window.gridModeSquares = squares;
            localStorage.setItem("gridModeSquares", squares);
            console.log("Grid Mode squares stored:", squares);
        });
    }

    // Inject UI into local settings.
    waitForElement('div.form-elements.mb-8', (container) => {
        console.log("Local settings container found.");
        injectGridModeUI(container);
    });
    // Inject UI into online settings.
    waitForElement('div.online-settings-card', (onlineContainer) => {
        const container = onlineContainer.querySelector('.form-elements.mb-8');
        if(container) {
            console.log("Online settings container found.");
            injectGridModeUI(container);
        }
    });

    // Auto-reinject Grid Mode UI if missing (check every 2 seconds).
    setInterval(() => {
        const containers = document.querySelectorAll('div.form-elements.mb-8, div.online-settings-card .form-elements.mb-8');
        containers.forEach(container => {
            if(!container.querySelector('#gridModeUI')) {
                console.log("Grid Mode UI missing in container, reinjecting...");
                injectGridModeUI(container);
            }
        });
    }, 2000);

    /************************************
     * Module 4: Continuous Polling for Round Time Update
     ************************************/
    // Every second, check if the time label element has updated. If so, update storage.
    setInterval(() => {
        const timeLabelEl = document.querySelector('.time-slider-component.dark .time-label');
        if(timeLabelEl) {
            const newTimeStr = timeLabelEl.textContent.trim();
            const storedTimeStr = localStorage.getItem("gridModeRoundTime") || "";
            if(newTimeStr !== storedTimeStr) {
                localStorage.setItem("gridModeRoundTime", newTimeStr);
                console.log("Updated round time (polling):", newTimeStr);
            }
        }
    }, 1000);

    /************************************
     * Modules 2 & 3: Grid Overlay Creation & Random Removal
     ************************************/
    function createFixedGridOverlay(streetViewContainer) {
        let desiredSquares = parseInt(localStorage.getItem("gridModeSquares"), 10);
        if(isNaN(desiredSquares) || desiredSquares < 1) {
            desiredSquares = 9;
        }
        const m = Math.round(Math.sqrt(desiredSquares));
        const totalSquares = m * m;
        console.log(`Creating grid overlay with ${totalSquares} cells (${m}x${m}).`);
        const overlay = document.createElement('div');
        overlay.id = "gridOverlay";
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.zIndex = "9999";
        overlay.style.pointerEvents = "none";
        streetViewContainer.appendChild(overlay);

        const containerWidth = streetViewContainer.offsetWidth;
        const containerHeight = streetViewContainer.offsetHeight;
        const cellWidth = containerWidth / m;
        const cellHeight = containerHeight / m;

        for(let row = 0; row < m; row++){
            for(let col = 0; col < m; col++){
                const cell = document.createElement('div');
                cell.style.position = "absolute";
                cell.style.width = cellWidth + "px";
                cell.style.height = cellHeight + "px";
                cell.style.top = (row * cellHeight) + "px";
                cell.style.left = (col * cellWidth) + "px";
                cell.style.backgroundColor = "rgba(128,128,128,1)";
                cell.style.border = "1px solid rgba(100,100,100,0.5)";
                overlay.appendChild(cell);
            }
        }
        console.log("Fixed grid overlay created.");
        return overlay;
    }

    function setupRandomGridRemoval(overlay) {
        let cellsArray = Array.from(overlay.children);
        const totalCells = cellsArray.length;
        if(totalCells === 0){
            console.log("No grid cells found in overlay.");
            return;
        }
        const storedTimeStr = localStorage.getItem("gridModeRoundTime");
        if(!storedTimeStr){
            console.log("No stored round time found.");
            return;
        }
        const totalRoundTimeSeconds = parseTimeLabel(storedTimeStr);
        if(totalRoundTimeSeconds <= 0){
            console.log("Invalid round time:", storedTimeStr);
            return;
        }
        const removalInterval = (totalRoundTimeSeconds * 1000) / totalCells;
        console.log(`Round time: ${totalRoundTimeSeconds}s, Total cells: ${totalCells}, Removal interval: ${removalInterval}ms.`);

        const removalIntervalID = setInterval(() => {
            if(cellsArray.length === 0) {
                console.log("All grid squares removed. Clearing interval.");
                clearInterval(removalIntervalID);
                return;
            }
            const randomIndex = Math.floor(Math.random() * cellsArray.length);
            const cell = cellsArray[randomIndex];
            if(cell && cell.parentNode === overlay) {
                overlay.removeChild(cell);
                console.log(`Removed random cell at index ${randomIndex}. Remaining: ${cellsArray.length - 1}`);
            }
            cellsArray.splice(randomIndex, 1);
        }, removalInterval);
    }

    /************************************
     * Next Round Reset: Reset grid overlay ONLY on Next Round button click.
     ************************************/
    function resetGridOverlayForNextRound() {
        // Update round time from the time slider.
        const timeLabelEl = document.querySelector('.time-slider-component.dark .time-label');
        if(timeLabelEl){
            const timeStr = timeLabelEl.textContent.trim();
            localStorage.setItem("gridModeRoundTime", timeStr);
            console.log("Updated round time on Next Round click:", timeStr);
        }
        const streetViewContainer = document.querySelector('.gm-style');
        if(streetViewContainer && streetViewContainer.offsetWidth > 0 && streetViewContainer.offsetHeight > 0) {
            let existingOverlay = document.getElementById("gridOverlay");
            if(existingOverlay) {
                existingOverlay.parentNode.removeChild(existingOverlay);
                console.log("Old grid overlay removed on Next Round click.");
            }
            const newOverlay = createFixedGridOverlay(streetViewContainer);
            setupRandomGridRemoval(newOverlay);
            console.log("Grid reset");
        } else {
            console.log("Street view container not visible on Next Round click; grid overlay not created.");
        }
    }

    // Use event delegation to capture Next Round button presses.
    document.addEventListener('click', function(e) {
        const nextRoundBtn = e.target.closest('span.stagger-animation.mt-10 button.v-btn.v-btn--is-elevated.v-btn--fab.v-btn--has-bg.v-btn--round.theme--dark.v-size--x-large.primary');
        if(nextRoundBtn) {
            console.log("Next Round button pressed");
            resetGridOverlayForNextRound();
        }
    });

    console.log("Event delegation for Next Round button is active.");

    // Initial setup: Wait for the street view container (.gm-style) to appear and create overlay if visible.
    waitForElement('.gm-style', (streetViewContainer) => {
        if(streetViewContainer.offsetWidth > 0 && streetViewContainer.offsetHeight > 0) {
            let overlay = document.getElementById("gridOverlay");
            if(!overlay){
                overlay = createFixedGridOverlay(streetViewContainer);
                setupRandomGridRemoval(overlay);
            }
        }
    });

})();
