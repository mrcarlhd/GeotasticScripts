// ==UserScript==
// @name         Geotastic Darts Mode
// @description  Merged script for Darts Mode: injects UI in settings, displays target score during gameplay, and tracks online final scores with color highlighting.
// @version      1.0
// @match        *://*.geotastic.net/*
// @run-at       document-end
// @grant        none
// @author       chadgpt
// @downloadURL  https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Darts%20Mode-1.0.user.js
// @uploadURL    https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Darts%20Mode-1.0.user.js
// ==/UserScript==

(function() {
    "use strict";

    /*-----------------------------------------------------------
      Module 1: Darts Mode UI Injection (with Infinite Polling)
    -----------------------------------------------------------*/
    // Helper: Poll indefinitely for an element.
    function waitForElement(selector, callback) {
        const interval = 500;
        (function check() {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
            } else {
                setTimeout(check, interval);
            }
        })();
    }

    // Injection function: Adds the Darts Mode UI (toggle button + input field) if not already present.
    function injectDartsUI(container) {
        if (document.getElementById('dartsModeUI')) return;
        const dartsHTML = `
            <div id="dartsModeUI" class="v-input super-dense v-input--hide-details v-input--is-label-active v-input--is-dirty v-input--dense theme--dark v-text-field v-text-field--filled v-text-field--is-booted v-text-field--enclosed v-text-field--outlined" style="margin-top: 10px;">
                <div class="v-input__control">
                    <div class="v-input__slot">
                        <label class="v-label v-label--active theme--dark" style="position: absolute; left: 0;">Darts Mode</label>
                        <div class="v-select__selections" style="margin-top: 30px;">
                            <button id="dartsToggle" class="v-btn v-btn--outlined v-btn--dense theme--dark" style="cursor: pointer;">Toggle Darts Mode</button>
                            <input id="dartsTarget" type="number" placeholder="Enter target score" min="1" max="30000" style="display: none; margin-left: 10px;" />
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', dartsHTML);
        console.log("Darts Mode UI injected.");

        // Attach event listeners.
        const toggleButton = document.getElementById('dartsToggle');
        const targetInput = document.getElementById('dartsTarget');
        let dartsEnabled = false;
        toggleButton.addEventListener('click', () => {
            dartsEnabled = !dartsEnabled;
            if (dartsEnabled) {
                targetInput.style.display = 'inline-block';
                toggleButton.textContent = 'Darts Mode ON';
            } else {
                targetInput.style.display = 'none';
                toggleButton.textContent = 'Toggle Darts Mode';
            }
        });
        targetInput.addEventListener('change', () => {
            const score = parseInt(targetInput.value, 10);
            if (isNaN(score) || score < 1 || score > 30000) {
                alert("Please enter a target score between 1 and 30000.");
                targetInput.value = "";
                return;
            }
            window.dartsTargetScore = score;
            localStorage.setItem("dartsTargetScore", score);
            console.log("Darts target score stored:", score);
        });
    }

    // For local game settings.
    waitForElement('div.form-elements.mb-8', function(container) {
        console.log("Local Game Scoring Settings container found.");
        injectDartsUI(container);
    });

    // For online game settings.
    waitForElement('div.online-settings-card', function(onlineContainer) {
        const container = onlineContainer.querySelector('.form-elements.mb-8');
        if (container) {
            console.log("Online Game Scoring Settings container found.");
            injectDartsUI(container);
        } else {
            console.log("Online Game Scoring Settings container not yet available.");
        }
    });

    /*-----------------------------------------------------------
      Module 2: Darts Target Score Display
    -----------------------------------------------------------*/
    // Create a banner element to display the target score during gameplay.
    const targetDisplay = document.createElement('div');
    targetDisplay.id = 'dartsTargetDisplay';
    targetDisplay.style.position = 'fixed';
    targetDisplay.style.top = '20px';
    targetDisplay.style.left = '50%';
    targetDisplay.style.transform = 'translateX(-50%)';
    targetDisplay.style.padding = '10px 20px';
    targetDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    targetDisplay.style.color = '#fff';
    targetDisplay.style.fontSize = '16px';
    targetDisplay.style.zIndex = '10000';
    targetDisplay.style.borderRadius = '5px';
    targetDisplay.style.display = 'none';
    document.body.appendChild(targetDisplay);

    function updateTargetDisplay() {
        // We assume the panorama is shown when an element with class '.gm-style' is present.
        const panorama = document.querySelector('.gm-style');
        if (panorama) {
            const targetScore = window.dartsTargetScore || localStorage.getItem("dartsTargetScore");
            targetDisplay.textContent = targetScore ? "Target Score = " + targetScore : "Target Score not set";
            targetDisplay.style.display = 'block';
        } else {
            targetDisplay.style.display = 'none';
        }
    }
    setInterval(updateTargetDisplay, 1000);

    /*-----------------------------------------------------------
      Module 3: Darts Total Score Tracker (Online Mode – Rainbow for Perfect)
    -----------------------------------------------------------*/
    // Helper to parse numeric score from text.
    function parseScoreFromText(text) {
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    function checkOnlinePlayersScore() {
        let targetScore = parseInt(window.dartsTargetScore || localStorage.getItem("dartsTargetScore"), 10);
        if (!targetScore || isNaN(targetScore)) {
            console.log("No valid target score set.");
            return;
        }
        console.log("Target Score:", targetScore);

        // Select player results from online mode final results.
        // Using a selector based on our previous adjustments.
        const playerResults = document.querySelectorAll('.online-player-results .player-result');
        if (!playerResults.length) {
            console.log("No player results found with selector '.online-player-results .player-result'.");
            return;
        }

        let nonPerfectPlayers = [];

        // Clear previous highlights.
        playerResults.forEach(result => {
            result.style.backgroundColor = '';
            result.style.background = '';
        });

        playerResults.forEach(result => {
            // Retrieve player's nickname.
            const nicknameEl = result.querySelector('.nickname-container span.nickname');
            const playerName = nicknameEl ? nicknameEl.textContent.trim() : "Unknown";

            // Retrieve the total score from the element with class "total" (only the total score).
            const totalScoreEl = result.querySelector('div.total span');
            if (!totalScoreEl) {
                console.log(`No total score element for player: ${playerName}`);
                return;
            }
            const score = parseInt(totalScoreEl.textContent.replace(/[^0-9]/g, ''), 10);
            console.log(`Player "${playerName}" total score: ${score}`);

            if (score > targetScore) {
                result.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'; // Red for busted.
            } else if (score === targetScore) {
                result.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)'; // Rainbow for perfect.
            } else {
                result.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'; // Yellow for valid but not perfect.
                nonPerfectPlayers.push({ element: result, diff: targetScore - score, score: score });
            }
        });

        // Among non-perfect players, determine the closest to target and highlight in green.
        if (nonPerfectPlayers.length > 0) {
            nonPerfectPlayers.sort((a, b) => a.diff - b.diff);
            const bestPlayer = nonPerfectPlayers[0];
            bestPlayer.element.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
            console.log(`Winner among non-perfect scores: Score = ${bestPlayer.score}, Difference = ${bestPlayer.diff}`);
        } else {
            console.log("No non-busted players found (or all players achieved perfect score).");
        }
    }

    // Check online players' scores periodically.
    setInterval(checkOnlinePlayersScore, 2000);

})();
