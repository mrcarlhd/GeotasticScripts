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

    /************************************
     * Module 1: Darts Mode UI Injection 
     * (Switch Style with Animation & Continuous Polling)
     ************************************/
    
    // Insert custom CSS for the switch animation and layout.
    const styleModule1 = document.createElement('style');
    styleModule1.textContent = `
        /* Layout the container in a row so the switch & input are inline */
        #dartsModeUI {
            display: flex;
            align-items: center;
            margin-top: 5px;
        }
        /* Transition for the switch track and thumb only */
        #dartsModeUI .v-input--switch__track, 
        #dartsModeUI .v-input--switch__thumb {
            transition: background-color 0.3s ease, transform 0.3s ease;
        }
        /* When enabled, only the switch track & thumb turn green */
        #dartsModeUI.darts-enabled .v-input--switch__track {
            background-color: #4caf50 !important;
        }
        #dartsModeUI.darts-enabled .v-input--switch__thumb {
            transform: translateX(100%);
            background-color: #4caf50 !important;
        }
        /* Style the target score input to be visible and wide */
        #dartsTarget {
            display: none;
            margin-left: 8px;
            width: 250px;
            padding: 5px;
            font-size: 14px;
        }
    `;
    document.head.appendChild(styleModule1);

    // Helper function: wait indefinitely for an element.
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

    // Injection function for the Darts Mode UI (Module 1)
    function injectDartsUISwitch(container) {
        if (document.getElementById('dartsModeUI')) return; // prevent duplicate injection
        
        const dartsHTML = `
            <div id="dartsModeUI" class="v-input super-dense v-input--hide-details v-input--dense theme--dark v-input--selection-controls v-input--switch">
                <div class="v-input__control">
                    <div class="v-input__slot">
                        <div class="v-input--selection-controls__input">
                            <input aria-checked="false" id="dartsModeSwitch" role="switch" type="checkbox" aria-disabled="false" value="">
                            <div class="v-input--selection-controls__ripple"></div>
                            <div class="v-input--switch__track theme--dark"></div>
                            <div class="v-input--switch__thumb theme--dark"></div>
                        </div>
                        <label for="dartsModeSwitch" class="v-label theme--dark" style="left: 0px; right: auto; position: relative;">Darts Mode</label>
                    </div>
                </div>
                <input id="dartsTarget" type="number" placeholder="Enter Target Score" min="1" max="30000"/>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', dartsHTML);
        console.log("Darts Mode UI injected into container:", container);
        
        const switchInput = document.getElementById('dartsModeSwitch');
        const dartsUI = document.getElementById('dartsModeUI');
        const targetInput = document.getElementById('dartsTarget');
        
        // When clicking anywhere in the switch container (except the input) toggle the switch.
        dartsUI.addEventListener('click', (e) => {
            if (e.target.id === 'dartsTarget') return;
            switchInput.click();
        });
        
        // When switch is toggled, show/hide target input and animate.
        switchInput.addEventListener('change', () => {
            if (switchInput.checked) {
                targetInput.style.display = 'inline-block';
                dartsUI.classList.add('darts-enabled');
                console.log("Darts Mode enabled.");
            } else {
                targetInput.style.display = 'none';
                dartsUI.classList.remove('darts-enabled');
                console.log("Darts Mode disabled.");
            }
        });
        
        // Validate and store target score when changed.
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
    
    // Continuous polling to re-inject the Darts Mode UI when returning to settings.
    setInterval(() => {
        if (document.getElementById('dartsModeUI')) return;
        let localContainer = document.querySelector('div.form-elements.mb-8');
        if (localContainer) {
            injectDartsUISwitch(localContainer);
            return;
        }
        let onlineContainer = document.querySelector('div.online-settings-card .form-elements.mb-8');
        if (onlineContainer) {
            injectDartsUISwitch(onlineContainer);
        }
    }, 1000);

    /************************************
     * Module 2: Darts Target Score Display
     * (Injected into finish-guess-container .meta-infos)
     ************************************/
    // We'll inject a new "box" in the meta-infos area of the finish-guess screen.
    function waitForMetaInfos() {
        const container = document.querySelector('.finish-guess-container .meta-infos');
        if (container) {
            injectTargetScoreBox(container);
        } else {
            setTimeout(waitForMetaInfos, 500);
        }
    }
    
    function injectTargetScoreBox(container) {
        if (document.getElementById('dartsTargetBox')) return;
        const box = document.createElement('div');
        box.className = 'box';
        box.id = 'dartsTargetBox';
        box.innerHTML = '<span>Target Score</span><span id="dartsTargetValue">Not set</span>';
        container.insertBefore(box, container.firstChild);
        console.log("Injected Target Score box into meta-infos.");
    }
    
    function updateTargetScoreDisplay() {
        const targetScore = window.dartsTargetScore || localStorage.getItem("dartsTargetScore");
        const targetSpan = document.getElementById('dartsTargetValue');
        if (targetSpan) {
            targetSpan.textContent = targetScore ? targetScore : "Not set";
        }
    }
    
    waitForMetaInfos();
    setInterval(updateTargetScoreDisplay, 1000);

    /************************************
     * Module 3: Darts Total Score Tracker (Online Mode – Rainbow for Perfect)
     ************************************/
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
        
        // Select online player results.
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
            const nicknameEl = result.querySelector('.nickname-container span.nickname');
            const playerName = nicknameEl ? nicknameEl.textContent.trim() : "Unknown";
            
            // Get total score from the "total" element (only the total score).
            const totalScoreEl = result.querySelector('div.total span');
            if (!totalScoreEl) {
                console.log(`No total score element for player: ${playerName}`);
                return;
            }
            const score = parseInt(totalScoreEl.textContent.replace(/[^0-9]/g, ''), 10);
            console.log(`Player "${playerName}" total score: ${score}`);
            
            if (score > targetScore) {
                result.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'; // Red for bust.
            } else if (score === targetScore) {
                result.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)'; // Rainbow for perfect.
            } else {
                result.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'; // Yellow for valid non-perfect.
                nonPerfectPlayers.push({ element: result, diff: targetScore - score, score: score });
            }
        });
        
        // Among valid non-perfect players, highlight the closest to target in green.
        if (nonPerfectPlayers.length > 0) {
            nonPerfectPlayers.sort((a, b) => a.diff - b.diff);
            const bestPlayer = nonPerfectPlayers[0];
            bestPlayer.element.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
            console.log(`Winner among non-perfect scores: Score = ${bestPlayer.score}, Diff = ${bestPlayer.diff}`);
        } else {
            console.log("No valid non-busted players found (or all players achieved perfect score).");
        }
    }
    
    setInterval(checkOnlinePlayersScore, 2000);

})();
