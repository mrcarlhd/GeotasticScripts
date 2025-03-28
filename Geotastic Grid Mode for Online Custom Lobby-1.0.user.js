// ==UserScript==
// @name         Geotastic Grid Mode for Online Custom Lobby
// @description  Grid Mode for Geotastic (Online): Injects Grid Mode UI, polls for round time updates, creates a grid overlay over the panorama with random removal over the round time, and “ends” grid mode (clearing intervals and removing UI/overlay) when the Back to Lobby button is clicked.
// @version      1.0
// @match        *://*.geotastic.net/*
// @run-at       document-end
// @grant        none
// @author       chadgpt
// @downloadURL  https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Grid%20Mode%20for%20Online%20Custom%20Lobby-1.0.user.js
// @uploadURL    https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Grid%20Mode%20for%20Online%20Custom%20Lobby-1.0.user.js
// ==/UserScript==

(function(){
    "use strict";

    // Global storage for interval IDs so we can clear them on game end.
    window.gridModeUIInjectionIntervalID = null;
    window.gridModeRoundTimePollingIntervalID = null;
    window.gridModeRemovalIntervalIDs = [];

    /************************************
     * Helper Functions
     ************************************/
    function waitForElement(selector, callback) {
        const el = document.querySelector(selector);
        if(el){
            callback(el);
        } else {
            setTimeout(() => waitForElement(selector, callback), 500);
        }
    }

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

    // Wait for a new panorama image src different from lastSrc.
    function waitForNewPanorama(lastSrc, callback) {
        const newImg = document.querySelector('.gm-style img');
        if(newImg) {
            let newSrc = newImg.getAttribute('src');
            if(newSrc && newSrc !== lastSrc) {
                callback(newSrc);
            } else {
                setTimeout(() => waitForNewPanorama(lastSrc, callback), 500);
            }
        } else {
            setTimeout(() => waitForNewPanorama(lastSrc, callback), 500);
        }
    }

    /************************************
     * Module 1: Grid Mode UI Injection in Settings
     ************************************/
    const styleModule1 = document.createElement('style');
    styleModule1.textContent = `
        #gridModeUI {
            display: flex;
            flex-direction: column;
            margin-top: 5px;
        }
        #gridModeUI .v-input--switch__track,
        #gridModeUI .v-input--switch__thumb {
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        #gridModeUI.grid-enabled .v-input--switch__track {
            background-color: #4caf50 !important;
        }
        #gridModeUI.grid-enabled .v-input--switch__thumb {
            transform: translateX(100%);
            background-color: #4caf50 !important;
        }
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

    // Inject into local and online settings containers.
    waitForElement('div.form-elements.mb-8', (container) => {
        console.log("Local settings container found.");
        injectGridModeUI(container);
    });
    waitForElement('div.online-settings-card', (onlineContainer) => {
        const container = onlineContainer.querySelector('.form-elements.mb-8');
        if(container) {
            console.log("Online settings container found.");
            injectGridModeUI(container);
        }
    });

    // Store the UI reinjection interval so we can clear it later.
    window.gridModeUIInjectionIntervalID = setInterval(() => {
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
    window.gridModeRoundTimePollingIntervalID = setInterval(() => {
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
    // Create grid overlay inside the panorama container (".gm-style > div:first-child").
    function createFixedGridOverlay(panoramaContainer) {
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
        panoramaContainer.appendChild(overlay);

        const containerWidth = panoramaContainer.offsetWidth;
        const containerHeight = panoramaContainer.offsetHeight;
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

        let removalIntervalID = setInterval(() => {
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
        window.gridModeRemovalIntervalIDs.push(removalIntervalID);
    }

    /************************************
     * End-of-Game Cleanup: End script when "Back to Lobby" is pressed.
     ************************************/
    function endGridModeScript() {
        // Clear UI injection and round time polling intervals.
        if(window.gridModeUIInjectionIntervalID) {
            clearInterval(window.gridModeUIInjectionIntervalID);
            console.log("Cleared UI injection interval.");
        }
        if(window.gridModeRoundTimePollingIntervalID) {
            clearInterval(window.gridModeRoundTimePollingIntervalID);
            console.log("Cleared round time polling interval.");
        }
        // Clear all grid removal intervals.
        if(window.gridModeRemovalIntervalIDs && window.gridModeRemovalIntervalIDs.length > 0) {
            window.gridModeRemovalIntervalIDs.forEach(id => clearInterval(id));
            window.gridModeRemovalIntervalIDs = [];
            console.log("Cleared grid removal intervals.");
        }
        // Remove the grid overlay if it exists.
        const overlay = document.getElementById("gridOverlay");
        if(overlay) {
            overlay.remove();
            console.log("Removed grid overlay.");
        }
        // Remove the injected Grid Mode UI.
        const gridModeUI = document.getElementById("gridModeUI");
        if(gridModeUI) {
            gridModeUI.remove();
            console.log("Removed Grid Mode UI.");
        }
        // Clear stored grid mode settings.
        localStorage.removeItem("gridModeSquares");
        localStorage.removeItem("gridModeRoundTime");
        console.log("Grid Mode script ended.");
    }

    // Listen for the "Back to Lobby" button click.
    document.addEventListener('click', function(e) {
        const endBtn = e.target.closest('button.v-btn.v-btn--text.theme--dark.v-size--default.white--text');
        if(endBtn && endBtn.textContent.trim() === "Back to Lobby") {
            console.log("Back to Lobby button pressed. Ending Grid Mode script.");
            endGridModeScript();
        }
    });

    /************************************
     * Online Next Round / Start Game Reset: Reset grid overlay on button click.
     ************************************/
    function resetGridOverlayForNewRound() {
        // Update round time from the time slider.
        const timeLabelEl = document.querySelector('.time-slider-component.dark .time-label');
        if(timeLabelEl) {
            const timeStr = timeLabelEl.textContent.trim();
            localStorage.setItem("gridModeRoundTime", timeStr);
            console.log("Updated round time on button click:", timeStr);
        }
        // Store current panorama src.
        let panoramaImg = document.querySelector('.gm-style img');
        let lastSrc = panoramaImg ? panoramaImg.getAttribute('src') : null;
        console.log("Stored current panorama src:", lastSrc);
        // Wait until a new panorama is loaded (src changes).
        waitForNewPanorama(lastSrc, function(newSrc) {
            console.log("New panorama loaded, src changed:", newSrc);
            waitForElement('.gm-style', (streetViewContainer) => {
                if(streetViewContainer.offsetWidth > 0 && streetViewContainer.offsetHeight > 0) {
                    let existingOverlay = document.getElementById("gridOverlay");
                    if(existingOverlay) {
                        existingOverlay.parentNode.removeChild(existingOverlay);
                        console.log("Old grid overlay removed on button click.");
                    }
                    const newOverlay = createFixedGridOverlay(streetViewContainer);
                    setupRandomGridRemoval(newOverlay);
                    console.log("Grid reset on button click after new panorama loaded.");
                } else {
                    console.log("Street view container not visible after new panorama loaded; grid overlay not created.");
                }
            });
        });
    }

    // Listen for online "Continue" button clicks.
    document.addEventListener('click', function(e) {
        const continueBtn = e.target.closest('div.cta.mb-4 button.v-btn.v-btn--is-elevated.v-btn--has-bg.theme--dark.v-size--default.primary');
        if(continueBtn && continueBtn.textContent.trim() === "Continue") {
            console.log("Online Continue button pressed");
            resetGridOverlayForNewRound();
        }
    });

    // Listen for online "Play again" button clicks.
    document.addEventListener('click', function(e) {
        const playAgainBtn = e.target.closest('button.v-btn.v-btn--is-elevated.v-btn--has-bg.theme--dark.v-size--large.primary');
        if(playAgainBtn && playAgainBtn.textContent.trim() === "Play again") {
            console.log("Online Play again button pressed");
            resetGridOverlayForNewRound();
        }
    });

    // Listen for online "Start Online Game" button clicks.
    document.addEventListener('click', function(e) {
        const startGameBtn = e.target.closest('button.v-btn.v-btn--block.v-btn--is-elevated.v-btn--has-bg.theme--dark.v-size--large.primary');
        if(startGameBtn && startGameBtn.textContent.trim().includes("Start Online Game")) {
            console.log("Online Start Game button pressed");
            resetGridOverlayForNewRound();
        }
    });

    console.log("Event delegation for online Continue/Play again/Start Online Game buttons is active.");

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
