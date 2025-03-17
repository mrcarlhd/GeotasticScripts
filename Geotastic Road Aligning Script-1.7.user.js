// ==UserScript==
// @name         Geotastic Road Aligning Script
// @description  Press N to set compass north and M to set camera pitch to -90 on Geotastic, regardless of key case.
// @version      1.7
// @match        *://*.geotastic.net/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Road%20Aligning%20Script-1.7.user.js
// @uploadURL    https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Road%20Aligning%20Script-1.7.user.js
// ==/UserScript==

(function() {
    let MWStreetViewInstance;

    function tryOverrideStreetView() {
        if (window.google && google.maps && google.maps.StreetViewPanorama) {
            // Override StreetViewPanorama to capture the instance.
            google.maps.StreetViewPanorama = class extends google.maps.StreetViewPanorama {
                constructor(...args) {
                    super(...args);
                    MWStreetViewInstance = this;
                }
            };
            console.log("StreetViewPanorama overridden.");
            return true;
        }
        return false;
    }

    function waitForStreetView() {
        if (!tryOverrideStreetView()) {
            setTimeout(waitForStreetView, 500);
        }
    }
    waitForStreetView();

    document.addEventListener('keyup', (event) => {
        // Check dynamic active game settings via window.settings.
        // If all three (canMove, canZoom, canPan) are false, do nothing.
        if (window.settings && !window.settings.canMove && !window.settings.canZoom && !window.settings.canPan) {
            console.log("Movement disabled by active settings.");
            return;
        }

        // Convert key to lowercase for case-insensitive handling.
        // Change n or m to whatever letter you would like
        const key = event.key.toLowerCase();

        if (MWStreetViewInstance) {
            if (key === 'n') {
                let pov = MWStreetViewInstance.getPov();
                pov.heading = 0;
                MWStreetViewInstance.setPov(pov);
                console.log("Set heading to 0 (north).");
            }
            if (key === 'm') {
                let pov = MWStreetViewInstance.getPov();
                pov.pitch = -90;
                MWStreetViewInstance.setPov(pov);
                console.log("Set pitch to -90.");
            }
        }
    });
})();
