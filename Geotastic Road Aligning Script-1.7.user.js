// ==UserScript==
// @name         Geotastic Road Aligning Script
// @description  Press N to set compass north and M to set camera pitch to -90 on Geotastic, regardless of key case.
// @version      1.7
// @match        *://*.geotastic.net/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  // Change key bindings here
  const KEY_FACE_NORTH = 'n';
  const KEY_PITCH_DOWN = 'm';

  let MWStreetViewInstance;

  function tryOverrideStreetView() {
    if (window.google && google.maps && google.maps.StreetViewPanorama) {
      // Override StreetViewPanorama to capture the instance.
      google.maps.StreetViewPanorama = class extends (
        google.maps.StreetViewPanorama
      ) {
        constructor(...args) {
          super(...args);
          MWStreetViewInstance = this;
        }
      };
      console.log('StreetViewPanorama overridden.');
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
    if (
      window.settings &&
      !window.settings.canMove &&
      !window.settings.canZoom &&
      !window.settings.canPan
    ) {
      console.log('Movement disabled by active settings.');
      return;
    }

    // Convert key to lowercase for case-insensitive handling.
    const key = event.key.toLowerCase();

    if (MWStreetViewInstance) {
      let pov = MWStreetViewInstance.getPov();
      if (key === KEY_FACE_NORTH) {
        pov.heading = 0;
        MWStreetViewInstance.setPov(pov);
        console.log('Set heading to 0 (north).');
      }
      if (key === KEY_PITCH_DOWN) {
        pov.pitch = -90;
        MWStreetViewInstance.setPov(pov);
        console.log('Set pitch to -90.');
      }
    }
  });
})();
