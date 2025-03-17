// ==UserScript==
// @name         Geotastic Upside Down Panorama
// @description  Flips only the visual layer of the panorama upside down while preserving normal click behavior.
// @version      1.0
// @match        *://*.geotastic.net/*
// @run-at       document-end
// @grant        none
// @author       chadGPT
// @downloadURL  https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Upside%20Down%20Panorama-1.0.user.js
// @uploadURL    https://raw.githubusercontent.com/mrcarlhd/GeotasticScripts/main/Geotastic%20Upside%20Down%20Panorama-1.0.user.js
// ==/UserScript==

(function() {
    // Apply transform to each child element of the container.
    function applyUpsideDownToChildren() {
        const container = document.querySelector('.streetview-container');
        if (container) {
            container.childNodes.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    child.style.transform = 'rotate(180deg)';
                    child.style.transformOrigin = 'center center';
                }
            });
            console.log("Applied upside down transform to children of streetview container.");
        }
    }

    // Remove transform from the child elements.
    function removeUpsideDownFromChildren() {
        const container = document.querySelector('.streetview-container');
        if (container) {
            container.childNodes.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    child.style.transform = '';
                }
            });
            console.log("Removed upside down transform from children of streetview container.");
        }
    }

    // Check if the panorama container exists.
    function isPanoramaPresent() {
        return document.querySelector('.streetview-container') !== null;
    }

    // Monitor the presence of the panorama container.
    let previousState = false;
    setInterval(() => {
        const panoramaPresent = isPanoramaPresent();
        if (panoramaPresent && !previousState) {
            applyUpsideDownToChildren();
        } else if (!panoramaPresent && previousState) {
            removeUpsideDownFromChildren();
        }
        previousState = panoramaPresent;
    }, 500);
})();
