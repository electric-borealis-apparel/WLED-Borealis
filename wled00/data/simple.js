// My condolences to anyone trying to read this code.
// Mostly vibe coded with Cursor + Sonnet 3.5

// Add updatePeakPercentage as a global function at the top
window.updatePeakPercentage = async () => {
  try {
    const response = await enqueueRequest(() => fetch(`${BASE_URL}/json/si`));
    const newState = await response.json();
    const audioSource = newState?.info?.u?.["Audio Source"]?.[1] || "";
    const peakDisplay = document.getElementById('peak-display');
    
    if (peakDisplay) {
      // Flash the text white
      peakDisplay.style.color = '#ffffff';
      
      // Remove the leading " - " if present and display the message
      const displayText = audioSource.replace(/^ - /, '');
      peakDisplay.textContent = displayText;
      
      // Return to blue after a short delay
      setTimeout(() => {
        peakDisplay.style.color = '#007BFF';
      }, 200);
    }
  } catch (err) {
    console.error("Error updating peak percentage:", err);
  }
};

// Add rapid update function
let rapidUpdateInterval = null;
let isUpdating = false;

function startRapidUpdate() {
  if (isUpdating) return;
  isUpdating = true;
  
  // Clear any existing interval
  if (rapidUpdateInterval) {
    clearInterval(rapidUpdateInterval);
  }
  
  // Update immediately
  updatePeakPercentage();
  
  // Start rapid updates
  rapidUpdateInterval = setInterval(updatePeakPercentage, 1000);
}

function stopRapidUpdate() {
  isUpdating = false;
  if (rapidUpdateInterval) {
    clearInterval(rapidUpdateInterval);
    rapidUpdateInterval = null;
  }
}

var h = document.getElementsByTagName("head")[0];
var l = document.createElement("script");
l.type = "application/javascript";
l.src = "iro.js";
l.addEventListener("load", (e) => {
  // Hide color picker by default
  document.querySelector("#color-picker").style.display = "none";

  var l = document.createElement("script");
  l.type = "application/javascript";
  l.src = "rangetouch.js";
  l.addEventListener("load", (e) => {
    // after rangetouch is loaded initialize global variable
    ranges = RangeTouch.setup('input[type="range"]', {});
    let stateCheck = setInterval(() => {
      if (document.readyState === "complete") {
        clearInterval(stateCheck);
        // document ready, start processing UI
        onLoad();
      }
    }, 100);
  });
  setTimeout(() => {
    h.appendChild(l);
  }, 100);
});
setTimeout(() => {
  h.appendChild(l);
}, 100);

const BASE_URL =
  window.location.protocol === "file:" ? "http://192.168.1.165" : "";

// Add this at the top of your script, after the BASE_URL declaration
let requestQueue = Promise.resolve(); // Initialize request queue

// Helper function to add requests to the queue
function enqueueRequest(requestFn) {
  requestQueue = requestQueue.then(requestFn).catch((err) => {
    // Continue the queue even if a request fails
    return Promise.resolve();
  });
  return requestQueue;
}

// In-memory storage for JSON data
let jsonData = {
  patterns: {},
  effects: [],
  palettes: [],
  fxdata: {},
  currentState: {},
  effectIndices: {},
};

// Add these new functions before loadAllData()
let palettesData = null;

function unGamma(val, gamma) {
  return Math.round(Math.pow(val / 255.0, 1.0 / gamma) * 255.0);
}

// Simplified genPalPrevCss with focused debugging
function genPalPrevCss(paletteData) {
  if (!paletteData) return "display: none";

  if (paletteData.length == 1) {
    paletteData = [...paletteData, paletteData[0]];
  }

  var gradient = [];

  for (let j = 0; j < paletteData.length; j++) {
    const e = paletteData[j];
    let r, g, b;
    let index = false;

    if (Array.isArray(e)) {
      index = Math.round((e[0] / 255) * 100);
      r = unGamma(e[1], 2.5);
      g = unGamma(e[2], 2.3);
      b = unGamma(e[3], 2.4);
    } else if (e === "r") {
      r = Math.floor(Math.random() * 256);
      g = Math.floor(Math.random() * 256);
      b = Math.floor(Math.random() * 256);
    } else if (typeof e === "string" && e.startsWith("c")) {
      const slotNum = parseInt(e.substring(1)) - 1;
      const currentColors = jsonData.currentState?.state?.seg?.[0]?.col || [];

      if (currentColors[slotNum]) {
        [r, g, b] = currentColors[slotNum];
      } else {
        r = g = b = 255; // Default to white instead of gray
      }
    } else if (typeof e === "object") {
      r = e.r;
      g = e.g;
      b = e.b;
    } else {
      r = g = b = 255; // Default to white instead of gray
    }

    if (index === false) {
      index = Math.round((j / (paletteData.length - 1)) * 100);
    }

    gradient.push(`rgb(${r},${g},${b}) ${index}%`);
  }

  return `background: linear-gradient(to right,${gradient.join()});`;
}

// Update renderPalettes to use simplified debugging
function renderPalettes() {
  const list = document.getElementById("color-effects-list");
  list.innerHTML = "";

  // Get current palette index from state
  const currentPaletteIndex = jsonData.currentState?.state?.seg?.[0]?.pal;

  // Create array of palette objects with index to maintain original index after sorting
  const sortedPalettes = jsonData.palettes.map((name, index) => ({
    name,
    index,
  }));

  // Sort alphabetically, ignoring case and special characters at start
  sortedPalettes.sort((a, b) => {
    if (a.name === "Default") return -1;
    if (b.name === "Default") return 1;

    const nameA = a.name.replace(/^[*~]/, "").toLowerCase();
    const nameB = b.name.replace(/^[*~]/, "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  sortedPalettes.forEach(({ name: palette, index }) => {
    const li = document.createElement("li");
    li.classList.add("list-item");
    li.textContent = palette;
    li.style.position = "relative";
    li.dataset.paletteIndex = index;

    // Mark as active if this is the current palette
    if (index === currentPaletteIndex) {
      li.classList.add("active");
      // Scroll to the active palette after a short delay to ensure rendering is complete
      setTimeout(() => {
        li.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }

    // Add palette preview
    const preview = document.createElement("div");
    preview.className = "lstIprev";

    // Get palette data and handle color slots
    if (palettesData && palettesData[index]) {
      const paletteData = palettesData[index];
      preview.style = genPalPrevCss(paletteData);
    }

    // Add click handler for palette selection
    li.onclick = async () => {
      // Deselect all other palettes
      document
        .querySelectorAll("#color-effects-list .list-item")
        .forEach((item) => {
          item.classList.remove("active");
        });
      // Select this palette
      li.classList.add("active");

      // Send palette selection to API
      try {
        await enqueueRequest(() =>
          fetch(`${BASE_URL}/json/si`, {
            method: "POST",
            body: JSON.stringify({
              seg: {
                pal: index,
              },
            }),
            headers: { "Content-Type": "application/json" },
          })
        );

        // Update the current state with the new palette
        if (!jsonData.currentState.state) {
          jsonData.currentState.state = {};
        }
        jsonData.currentState.state.pal = index;

        // Update debug info if we're on the Options tab
        const optionsTab = document.getElementById("tab4-content");
        if (optionsTab.classList.contains("active")) {
          const effectsList = document.getElementById("effects-list");
          const activeEffect = effectsList.querySelector(".active");
          if (activeEffect) {
            const effectIndex = Array.from(effectsList.children).indexOf(
              activeEffect
            );
            renderEffectDetails(effectIndex);
          }
        }
      } catch (err) {}
    };

    li.appendChild(preview);
    list.appendChild(li);
  });
}

// Add these variables near the top with other variables
var lastinfo = {};

// Add this function before loadPalettesData
function parseInfo(i) {
  lastinfo = i;
  // We only need vid from info for palette data
}

// Add this near the top with other state variables
let brightnessPresets = [20, 50, 80, 120, 150]; // Default values until we load from config

// Update loadAllData to parse info from si response
async function loadAllData() {
  try {
    // Helper function to add request to queue
    const queuedFetch = (url) => {
      return enqueueRequest(async () => {
        const response = await fetch(`${BASE_URL}${url}`);
        return response.json();
      });
    };

    // Sequential fetches that wait for previous request to complete
    const presets = await queuedFetch("/presets.json");
    const si = await queuedFetch("/json/si");
    const effects = await queuedFetch("/json/effects");
    const fxdata = await queuedFetch("/json/fxdata");
    const palettes = await queuedFetch("/json/palettes");
    const config = await queuedFetch("/cfg.json");

    // Get brightness presets from config
    if (config?.um?.Borealis?.['brightness-values']) {
      brightnessPresets = config.um.Borealis['brightness-values'];
    }

    // Parse info from si response
    if (si.info) parseInfo(si.info);

    jsonData.palettes = palettes;
    jsonData.patterns = presets;
    jsonData.currentState = si;
    jsonData.effects = effects.filter((effect) => effect !== "RSVD").sort();
    jsonData.fxdata = fxdata;

    // Create a mapping of sorted effect names to their original indices
    jsonData.effectIndices = {};
    effects.forEach((effect, index) => {
      if (effect !== "RSVD") {
        jsonData.effectIndices[effect] = index;
      }
    });

    // Load palette data and render immediately
    loadPalettesData(() => {
      const colorEffectsList = document.getElementById("color-effects-list");
      if (colorEffectsList) {
        colorEffectsList.classList.add("visible");
        renderPalettes();
        // Show color picker and set up initial color controls
        const colorPicker = document.getElementById("color-picker");
        if (colorPicker) {
          colorPicker.style.display = "block";
        }
      }
    });

    renderPatterns();
    renderEffects();

    // Get current effect from state and trigger its selection
    const currentEffectId = si.state?.seg?.[0]?.fx;
    if (currentEffectId !== undefined) {
      // Find the effect name that corresponds to this ID
      const effectName = jsonData.effects.find(
        (effect) => jsonData.effectIndices[effect] === currentEffectId
      );

      if (effectName) {
        const effectIndex = jsonData.effects.indexOf(effectName);

        // Get effect metadata and set up color controls
        const effectData = jsonData.fxdata[currentEffectId];
        const metadata = parseEffectMetadata(effectData);
        const currentColors = si.state.seg[0].col || [
          [255, 0, 0],
          [0, 0, 255],
        ];
        metadata.defaults = currentColors.map(
          (col) =>
            `#${col[0].toString(16).padStart(2, "0")}${col[1]
              .toString(16)
              .padStart(2, "0")}${col[2].toString(16).padStart(2, "0")}`
        );

        // Update color controls
        setupColorControls(metadata);

        // Update effect details/options
        renderEffectDetails(effectIndex);
      }
    }
  } catch (err) {}
}

// Update loadPalettesData to handle paged loading
function loadPalettesData(callback = null) {
  if (palettesData) return;
  const lsKey = "wledPalx";
  var lsPalData = localStorage.getItem(lsKey);
  if (lsPalData) {
    try {
      var d = JSON.parse(lsPalData);
      if (d && d.vid == lastinfo.vid) {
        palettesData = d.p;
        if (callback) callback();
        return;
      }
    } catch (e) {}
  }

  palettesData = {};
  getPalettesData(0, () => {
    localStorage.setItem(
      lsKey,
      JSON.stringify({
        p: palettesData,
        vid: lastinfo.vid,
      })
    );
    redrawPalPrev();
    if (callback) setTimeout(callback, 99);
  });
}

function getPalettesData(page, callback) {
  queuedFetch(`/json/palx?page=${page}`)
    .then((json) => {
      palettesData = Object.assign({}, palettesData, json.p);
      if (page < json.m)
        setTimeout(() => {
          getPalettesData(page + 1, callback);
        }, 50);
      else callback();
    })
    .catch((error) => {
      console.error(error);
    });
}

// Add this shared function before renderPatterns
function createHoldToDeleteHandler(element, onDelete, onShortPress, preventDefault = false) {
  let pressTimer;
  let isLongPress = false;
  let touchStartTime;
  let animationFrame;
  let startTime;
  let isTouchDevice = false;
  let isMouseDown = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let hasMoved = false;

  // Add transition CSS
  element.style.transition = "background-color 0.2s";

  function updateBackground() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / 1000, 1); // 1 second duration

    // Interpolate between blue (#007BFF) and red (#FF0000)
    const r = Math.round(0x00 + (0xff - 0x00) * progress);
    const g = Math.round(0x7b * (1 - progress));
    const b = Math.round(0xff * (1 - progress));

    element.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

    if (progress < 1) {
      animationFrame = requestAnimationFrame(updateBackground);
    }
  }

  function handleMouseDown(e) {
    if (isTouchDevice || e.buttons !== 1) return; // Only handle left mouse button
    isMouseDown = true;
    
    startTime = Date.now();
    updateBackground();

    pressTimer = setTimeout(() => {
      isLongPress = true;
      onDelete();
    }, 1000);
  }

  function handleMouseUp(e) {
    if (!isMouseDown) return;
    isMouseDown = false;
    
    clearTimeout(pressTimer);
    cancelAnimationFrame(animationFrame);
    element.style.backgroundColor = ""; // Reset color
    
    if (!isLongPress) {
      onShortPress();
    }
    isLongPress = false;
  }

  function handleMouseLeave() {
    if (!isMouseDown) return;
    isMouseDown = false;
    
    clearTimeout(pressTimer);
    cancelAnimationFrame(animationFrame);
    element.style.backgroundColor = ""; // Reset color
    isLongPress = false;
  }

  function handleTouchStart(e) {
    if (preventDefault) e.preventDefault();
    isTouchDevice = true;
    touchStartTime = Date.now();
    startTime = Date.now();
    hasMoved = false;
    
    // Store initial touch position
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    updateBackground();

    pressTimer = setTimeout(() => {
      isLongPress = true;
      onDelete();
    }, 1000);
  }

  function handleTouchMove(e) {
    if (!touchStartX || !touchStartY) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    // Calculate distance moved
    const deltaX = Math.abs(touchX - touchStartX);
    const deltaY = Math.abs(touchY - touchStartY);
    
    // If moved more than 10 pixels in any direction, consider it a scroll
    if (deltaX > 10 || deltaY > 10) {
      hasMoved = true;
      clearTimeout(pressTimer);
      cancelAnimationFrame(animationFrame);
      element.style.backgroundColor = ""; // Reset color
    }
  }

  function handleTouchEnd(e) {
    clearTimeout(pressTimer);
    cancelAnimationFrame(animationFrame);
    element.style.backgroundColor = ""; // Reset color
    
    if (!isLongPress && !hasMoved) {
      onShortPress();
    }
    isLongPress = false;
    hasMoved = false;
    touchStartX = 0;
    touchStartY = 0;
  }

  // Add event listeners
  element.addEventListener("mousedown", handleMouseDown);
  element.addEventListener("mouseup", handleMouseUp);
  element.addEventListener("mouseleave", handleMouseLeave);
  
  element.addEventListener("touchstart", handleTouchStart);
  element.addEventListener("touchmove", handleTouchMove);
  element.addEventListener("touchend", handleTouchEnd);
  element.addEventListener("touchcancel", handleTouchEnd);
}

// Update createPatternItem to use the shared handler
function createPatternItem({ id, name }) {
  const li = document.createElement("li");
  li.classList.add("list-item");
  // Split name and ID, then add span for ID
  const nameWithoutId = name.replace(/ \(\d+\)$/, '');
  li.innerHTML = `${nameWithoutId}<span class="pattern-id">(${id})</span>`;
  if (id == currentPattern) {
    li.classList.add("active");
  }

  createHoldToDeleteHandler(
    li,
    () => deletePattern(id, name),
    () => changePattern(id)
  );

  return li;
}

// Update renderPatterns to remove modal creation code
function renderPatterns() {
  const list = document.getElementById("pattern-list");
  const currentPattern = jsonData.currentState.state.ps;

  list.innerHTML = "";

  // Split patterns into three groups
  const group1Patterns = [];
  const group2Patterns = [];
  const group3Patterns = [];

  Object.entries(jsonData.patterns).forEach(([id, item]) => {
    if (item.n) {
      const patternObj = { id, name: `${item.n} (${id})` };
      if (id < 100) {
        group1Patterns.push(patternObj);
      } else if (id < 200) {
        group2Patterns.push(patternObj);
      } else if (id < 250) {
        group3Patterns.push(patternObj);
      }
    }
  });

  function createPatternItem({ id, name }) {
    const li = document.createElement("li");
    li.classList.add("list-item");
    // Split name and ID, then add span for ID
    const nameWithoutId = name.replace(/ \(\d+\)$/, '');
    li.innerHTML = `${nameWithoutId}<span class="pattern-id">(${id})</span>`;
    if (id == currentPattern) {
      li.classList.add("active");
    }

    createHoldToDeleteHandler(
      li,
      () => deletePattern(id, name),
      () => changePattern(id)
    );

    return li;
  }

  // Add Group 1 patterns
  if (group1Patterns.length) {
    const group1Header = document.createElement("div");
    group1Header.className = "pattern-group-header";
    group1Header.textContent = "Group 1";
    list.appendChild(group1Header);
    group1Patterns.forEach((pattern) => {
      list.appendChild(createPatternItem(pattern));
    });
  }

  // Add Group 2 patterns
  if (group2Patterns.length) {
    const group2Header = document.createElement("div");
    group2Header.className = "pattern-group-header";
    group2Header.textContent = "Group 2";
    list.appendChild(group2Header);
    group2Patterns.forEach((pattern) => {
      list.appendChild(createPatternItem(pattern));
    });
  }

  // Add Group 3 patterns
  if (group3Patterns.length) {
    const group3Header = document.createElement("div");
    group3Header.className = "pattern-group-header";
    group3Header.textContent = "Group 3";
    list.appendChild(group3Header);
    group3Patterns.forEach((pattern) => {
      list.appendChild(createPatternItem(pattern));
    });
  }
}

// Render effects in tab 2 (sorted and filtered)
function renderEffects() {
  const list = document.getElementById("effects-list");
  list.innerHTML = "";

  // Get current effect index from state
  const currentEffectIndex = jsonData.currentState?.state?.seg?.[0]?.fx;

  jsonData.effects.forEach((effect, index) => {
    const li = document.createElement("li");
    li.classList.add("list-item");

    // Get effect metadata and render name with symbols
    const effectData = jsonData.fxdata[jsonData.effectIndices[effect]];
    const metadata = parseEffectMetadata(effectData);
    li.textContent = renderEffectName(effect, metadata);

    // Check if this is the current effect
    if (jsonData.effectIndices[effect] === currentEffectIndex) {
      li.classList.add("active");
    }

    createHoldToDeleteHandler(
      li,
      () => {
        if (confirm(`Are you sure you want to delete effect "${effect}"?`)) {
          // TODO: Implement effect deletion if needed
          console.log("Effect deletion not implemented yet");
        }
      },
      async () => {
        // Deselect all other effects
        document.querySelectorAll("#effects-list .list-item").forEach((item) => {
          item.classList.remove("active");
        });
        // Select this effect
        li.classList.add("active");

        // Update pattern list - select Custom button and deselect others
        document.querySelectorAll("#pattern-list .list-item").forEach((item) => {
          item.classList.remove("active");
        });
        const customButton = document.querySelector(
          "#pattern-list .list-item:nth-child(2)"
        );
        if (customButton) {
          customButton.classList.add("active");
        }

        // Get effect metadata and set up color controls
        const effectData = jsonData.fxdata[jsonData.effectIndices[effect]];
        const metadata = parseEffectMetadata(effectData);
        const currentColors = jsonData.currentState?.state?.seg?.[0]?.col || [
          [255, 0, 0],
          [0, 0, 255],
        ];
        metadata.defaults = currentColors.map(
          (col) =>
            `#${col[0].toString(16).padStart(2, "0")}${col[1]
              .toString(16)
              .padStart(2, "0")}${col[2].toString(16).padStart(2, "0")}`
        );

        // Update color controls
        setupColorControls(metadata);

        // First, ensure we're in a known state by turning on the LED strip
        await enqueueRequest(() =>
          fetch(`${BASE_URL}/json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              on: true,
              bri: 128,
              v: true
            }),
          })
        );

        // Then send effect with options
        try {
          await enqueueRequest(() =>
            fetch(`${BASE_URL}/json/si`, {
              method: "POST",
              body: JSON.stringify({
                seg: {
                  fx: jsonData.effectIndices[effect],
                  col: currentColors,
                },
                v: true
              }),
              headers: { "Content-Type": "application/json" },
            })
          );

          // Fetch updated state to get the current effect options
          const stateResponse = await enqueueRequest(() => 
            fetch(`${BASE_URL}/json/state?v=true`)
          );
          const newState = await stateResponse.json();
          jsonData.currentState = newState;

          // Update local state
          if (!jsonData.currentState.state) {
            jsonData.currentState.state = {};
          }
          if (!jsonData.currentState.state.seg) {
            jsonData.currentState.state.seg = [{}];
          }
          jsonData.currentState.state.seg[0].fx = jsonData.effectIndices[effect];
          jsonData.currentState.state.seg[0].col = currentColors;

          // Update effect details with new state
          renderEffectDetails(index);
        } catch (err) {
          console.error("Error setting effect:", err);
        }
      }
    );

    list.appendChild(li);
  });

  // Scroll to active effect after rendering
  requestAnimationFrame(() => {
    const activeEffect = list.querySelector(".active");
    if (activeEffect) {
      activeEffect.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

// Add this function to parse effect metadata
function parseEffectMetadata(metadata) {
  if (!metadata) return null;

  // If metadata is directly a string (not in an object), use it directly
  const metadataString =
    typeof metadata === "string" ? metadata : metadata.metadata;
  if (!metadataString) return null;

  const sections = metadataString.split(";");
  const result = {
    parameters: [],
    colors: [],
    palette: null,
    flags: [],
    defaults: {},
  };

  // Parse parameters section
  if (sections[0]) {
    const params = sections[0].split(",");
    params.forEach((param) => {
      if (param === "!") {
        // Use default label
        if (result.parameters.length === 0)
          result.parameters.push({ id: "sx", label: "Speed" });
        else if (result.parameters.length === 1)
          result.parameters.push({ id: "ix", label: "Intensity" });
        else if (result.parameters.length >= 2)
          result.parameters.push({
            id: `c${result.parameters.length - 1}`,
            label: `Custom ${result.parameters.length - 1}`,
          });
      } else if (param) {
        // Custom label
        if (result.parameters.length === 0)
          result.parameters.push({ id: "sx", label: param });
        else if (result.parameters.length === 1)
          result.parameters.push({ id: "ix", label: param });
        else if (result.parameters.length >= 2)
          result.parameters.push({
            id: `c${result.parameters.length - 1}`,
            label: param,
          });
      }
    });
  }

  // Parse colors section (if exists)
  if (sections[1]) {
    result.colors = sections[1].split(",").filter((c) => c);
  }

  // Parse palette requirement (if exists)
  if (sections[2]) {
    result.palette = sections[2] === "!" ? "required" : sections[2];
  }

  // Parse flags (if exists)
  if (sections[3]) {
    const flagStr = sections[3];
    if (flagStr.includes("0")) result.flags.push("0d");
    if (flagStr.includes("1")) result.flags.push("1d");
    if (flagStr.includes("1.5d")) result.flags.push("1.5d");
    if (flagStr.includes("2")) result.flags.push("2d");
    if (flagStr.includes("v")) result.flags.push("volume");
    if (flagStr.includes("f")) result.flags.push("frequency");
  }

  // Parse defaults (if exists)
  if (sections[4]) {
    const defaults = sections[4].split(",");
    defaults.forEach((def) => {
      const [key, value] = def.split("=");
      result.defaults[key] = value;
    });
  }

  return result;
}

// Add new function to render effect name with symbols
function renderEffectName(effect, metadata) {
  let displayName = effect + " ";

  if (metadata) {
    // Add flags symbols
    if (metadata.flags) {
      if (metadata.flags.includes("0d")) displayName += "•"; // 0D effects (PWM & On/Off)
      if (metadata.flags.includes("1d") || metadata.flags.includes("1.5d"))
        displayName += "⋮"; // 1D effects
      if (metadata.flags.includes("2d")) displayName += "▦"; // 2D effects
      if (metadata.flags.includes("volume")) displayName += "♪"; // Volume effects
      if (metadata.flags.includes("frequency")) displayName += "♫"; // Frequency effects
    }

    // Add palette symbol if effect uses palette
    if (metadata.palette) {
      displayName += "🎨"; // Palette indicator
    }
  }

  return displayName;
}

// Update renderEffectDetails to include debug information
function renderEffectDetails(effectId) {
  const details = document.getElementById("effect-details");
  const effect = jsonData.effects[effectId];
  const effectData = jsonData.fxdata[jsonData.effectIndices[effect]];
  const metadata = parseEffectMetadata(effectData);

  // Get current effect options from state
  const currentOptions = jsonData.currentState?.state?.seg?.[0] || {};
  const currentBrightness = jsonData.currentState?.state?.bri || 128;
  const currentAudioGain = jsonData.currentState?.info?.u?.["Audio Input Level"]?.[0]?.match(/value=(\d+)/)?.[1] || 0;
  const currentPeak = jsonData.currentState?.info?.u?.["Audio Source"]?.[1]?.match(/peak (\d+)%/)?.[1] || 0;

  // Function to start/stop peak updates based on visibility
  const handlePeakUpdates = () => {
    const isMobile = window.innerWidth <= 1200;
    const isOptionsTab = document.getElementById('tab4-content').classList.contains('active');
    const isVisible = !isMobile || (isMobile && isOptionsTab);

    if (isVisible) {
      // Start updates if not already running
      if (!peakUpdateInterval) {
        updatePeakPercentage(); // Initial update
        peakUpdateInterval = setInterval(updatePeakPercentage, 2000);
      }
    } else {
      // Stop updates if running
      if (peakUpdateInterval) {
        clearInterval(peakUpdateInterval);
        peakUpdateInterval = null;
      }
    }
  };

  // Set up visibility observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        handlePeakUpdates();
      } else {
        if (peakUpdateInterval) {
          clearInterval(peakUpdateInterval);
          peakUpdateInterval = null;
        }
      }
    });
  }, { threshold: 0.1 });

  // Get effect name with symbols
  const effectName = renderEffectName(effect, metadata);

  // Create parameter controls HTML
  let parameterControls = "";
  if (metadata?.parameters?.length > 0) {
    parameterControls = `
      <div style="margin-bottom: 20px; padding: 15px; background: #2d2d2d; border-radius: 8px; border: 1px solid #3d3d3d;">
        <div style="margin-bottom: 10px; font-weight: bold;">Effect Parameters:</div>
        ${metadata.parameters
          .map(
            (param) => `
          <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
            <label style="flex: 0 0 100px; color: white;">
              ${param.label}
            </label>
            <input type="range" 
                   id="${param.id}" 
                   min="0" 
                   max="255" 
                   style="flex: 1;"
                   value="${currentOptions[param.id] || metadata.defaults[param.id] || 128}"
            >
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // Add brightness control box
  const brightnessControl = `
    <div style="margin-bottom: 20px; padding: 15px; background: #2d2d2d; border-radius: 8px; border: 1px solid #3d3d3d;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: bold;">Brightness:</div>
        <div id="brightness-warning-container"></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <input type="range" 
               id="brightness" 
               min="0" 
               max="255" 
               style="width: 100%;"
               value="${currentBrightness}"
        >
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${brightnessPresets.map((value, index) => `
            <button onclick="setBrightness(${value})" 
                    style="flex: 1; min-width: 50px; padding: 8px; background: ${currentBrightness === value ? '#007BFF' : '#2d2d2d'}; 
                           color: white; border: 1px solid #3d3d3d; border-radius: 4px; cursor: pointer;">
              ${index + 1}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Add audio gain control box
  const audioGainControl = `
    <div style="margin-bottom: 20px; padding: 15px; background: #2d2d2d; border-radius: 8px; border: 1px solid #3d3d3d;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: bold; cursor: pointer;" onclick="updatePeakPercentage()">Audio Gain:</div>
        <div id="peak-display" 
             style="color: #007BFF; cursor: pointer; transition: color 0.2s ease;" 
             onclick="startRapidUpdate()"
             onmouseleave="stopRapidUpdate()"
             ontouchstart="startRapidUpdate()"
             ontouchend="stopRapidUpdate()">peak ${currentPeak}%</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <input type="range" 
               id="audioGain" 
               min="0" 
               max="255" 
               style="width: 100%;"
               value="${currentAudioGain}"
        >
      </div>
    </div>
  `;

  // Only show Expand FX if effect is NOT 2D
  const showExpandFx = !metadata?.flags?.includes("2d");
  const expandFxHtml = showExpandFx
    ? `
    <div style="display: flex; align-items: center; margin-bottom: 15px; gap: 10px;">
      <label style="flex: 0 0 100px;">Expand FX:</label>
      <select id="m12" style="width: 100%; padding: 8px; background: #2d2d2d; color: white; border: 1px solid #3d3d3d; border-radius: 4px; box-sizing: border-box; height: 36px;">
        <option value="0" ${currentOptions.m12 === 0 ? "selected" : ""}>Pixels</option>
        <option value="1" ${currentOptions.m12 === 1 ? "selected" : ""}>Bar</option>
        <option value="2" ${currentOptions.m12 === 2 ? "selected" : ""}>Arc</option>
        <option value="3" ${currentOptions.m12 === 3 ? "selected" : ""}>Corner</option>
      </select>
    </div>
  `
    : "";

  details.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3 style="margin-bottom: 15px;">Pattern Settings</h3>
      ${parameterControls}
      <div style="margin-bottom: 20px; padding: 15px; background: #2d2d2d; border-radius: 8px; border: 1px solid #3d3d3d;">
        <div style="margin-bottom: 10px; font-weight: bold;">Effect Options:</div>
        ${expandFxHtml}
        <label style="display: block; margin: 8px 0;">
          <input type="checkbox" id="rev" name="rev" ${currentOptions.rev ? "checked" : ""}> Flip X
        </label>
        <label style="display: block; margin: 8px 0;">
          <input type="checkbox" id="rY" name="rY" ${currentOptions.rY ? "checked" : ""}> Flip Y
        </label>
        <label style="display: block; margin: 8px 0;">
          <input type="checkbox" id="mi" name="mi" ${currentOptions.mi ? "checked" : ""}> Mirror X
        </label>
        <label style="display: block; margin: 8px 0;">
          <input type="checkbox" id="mY" name="mY" ${currentOptions.mY ? "checked" : ""}> Mirror Y
        </label>
        <label style="display: block; margin: 8px 0;">
          <input type="checkbox" id="tp" name="tp" ${currentOptions.tp ? "checked" : ""}> Transpose
        </label>
      </div>

      <div style="margin-bottom: 20px; padding: 15px; background: #2d2d2d; border-radius: 8px; border: 1px solid #3d3d3d;">
        <div style="margin-bottom: 10px; font-weight: bold;">Save as Pattern:</div>
        <select id="patternGroup" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #2d2d2d; color: white; border: 1px solid #3d3d3d; border-radius: 4px; box-sizing: border-box; height: 36px;">
          <option value="group1">Group 1</option>
          <option value="group2">Group 2</option>
          <option value="group3" selected>Group 3</option>
        </select>
        <input type="text" id="patternName" placeholder="Pattern Name" value="${effect}" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #2d2d2d; color: white; border: 1px solid #3d3d3d; border-radius: 4px; box-sizing: border-box; height: 36px;">
        <button onclick="savePattern(${effectId})" style="width: 100%; padding: 8px; background: #007BFF; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Save
        </button>
      </div>
    </div>

    <div style="margin-bottom: 100px;">
      <h3 style="margin-bottom: 15px;">Borealis Settings</h3>
      ${brightnessControl}
      ${audioGainControl}
    </div>
  `;

  // Add change listeners to parameter sliders
  if (metadata?.parameters) {
    metadata.parameters.forEach((param) => {
      const slider = document.getElementById(param.id);
      if (slider) {
        slider.addEventListener("change", async () => {
          const value = parseInt(slider.value);
          try {
            await enqueueRequest(() =>
              fetch(`${BASE_URL}/json/si`, {
                method: "POST",
                body: JSON.stringify({
                  seg: {
                    [param.id]: value,
                  },
                }),
                headers: { "Content-Type": "application/json" },
              })
            );
          } catch (err) {}
        });
      }
    });
  }

  // Add change listener for brightness slider
  const brightnessSlider = document.getElementById("brightness");
  if (brightnessSlider) {
    brightnessSlider.addEventListener("change", async () => {
      const value = parseInt(brightnessSlider.value);
      try {
        await enqueueRequest(() =>
          fetch(`${BASE_URL}/json`, {
            method: "POST",
            body: JSON.stringify({
              bri: value
            }),
            headers: { "Content-Type": "application/json" },
          })
        );
        updateBrightnessWarning(value);
      } catch (err) {
        console.error("Error updating brightness:", err);
      }
    });
  }

  // Add change listener for audio gain slider
  const audioGainSlider = document.getElementById("audioGain");
  if (audioGainSlider) {
    audioGainSlider.addEventListener("change", async () => {
      const value = parseInt(audioGainSlider.value);
      try {
        await enqueueRequest(() =>
          fetch(`${BASE_URL}/json`, {
            method: "POST",
            body: JSON.stringify({
              AudioReactive: {
                inputLevel: value
              }
            }),
            headers: { "Content-Type": "application/json" },
          })
        );
        // Update peak percentage after changing gain
        updatePeakPercentage();
      } catch (err) {
        console.error("Error updating audio gain:", err);
      }
    });
  }

  // Add change listeners to checkboxes
  ["rev", "rY", "mi", "mY", "tp"].forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener("change", async () => {
        // Get all checkbox values
        const options = {
          rev: document.getElementById("rev").checked,
          rY: document.getElementById("rY").checked,
          mi: document.getElementById("mi").checked,
          mY: document.getElementById("mY").checked,
          tp: document.getElementById("tp").checked,
        };

        // Send updated effect with options
        try {
          await enqueueRequest(() =>
            fetch(`${BASE_URL}/json/si`, {
              method: "POST",
              body: JSON.stringify({
                seg: {
                  fx: jsonData.effectIndices[effect],
                  ...options,
                },
              }),
              headers: { "Content-Type": "application/json" },
            })
          );
        } catch (err) {}
      });
    }
  });

  // Add change listener for m12 dropdown
  const m12Select = document.getElementById("m12");
  if (m12Select) {
    m12Select.addEventListener("change", async () => {
      try {
        await enqueueRequest(() =>
          fetch(`${BASE_URL}/json/si`, {
            method: "POST",
            body: JSON.stringify({
              seg: {
                m12: parseInt(m12Select.value),
              },
            }),
            headers: { "Content-Type": "application/json" },
          })
        );
      } catch (err) {
        console.error("Error updating Expand FX:", err);
      }
    });
  }

  // Clean up observer and interval when the effect details are updated
  return () => {
    // No cleanup needed
  };
}

// Update savePattern to handle Group 3
async function savePattern(effectId) {
  const patternName = document.getElementById("patternName").value.trim();
  const patternGroup = document.getElementById("patternGroup").value;
  const saveButton = document.querySelector('button[onclick="savePattern(' + effectId + ')"]');

  if (!patternName) {
    alert("Please enter a pattern name");
    return;
  }

  // Count existing patterns in each group
  const group1Count = Object.keys(jsonData.patterns).filter(id => id < 100).length;
  const group2Count = Object.keys(jsonData.patterns).filter(id => id >= 100 && id < 200).length;
  const group3Count = Object.keys(jsonData.patterns).filter(id => id >= 200).length;

  // Check limits based on selected group
  if (patternGroup === "group1" && group1Count >= 99) {
    alert("Group 1 is full (maximum 99 patterns)");
    return;
  }
  if (patternGroup === "group2" && group2Count >= 99) {
    alert("Group 2 is full (maximum 99 patterns)");
    return;
  }
  if (patternGroup === "group3" && group3Count >= 50) {
    alert("Group 3 is full (maximum 50 patterns)");
    return;
  }

  // Get current effect options
  const options = {
    rev: document.getElementById("rev").checked,
    rY: document.getElementById("rY").checked,
    mi: document.getElementById("mi").checked,
    mY: document.getElementById("mY").checked,
    tp: document.getElementById("tp").checked,
  };

  // Get current effect parameters from UI controls
  const effectData = jsonData.fxdata[jsonData.effectIndices[jsonData.effects[effectId]]];
  const metadata = parseEffectMetadata(effectData);
  if (metadata?.parameters) {
    metadata.parameters.forEach(param => {
      const slider = document.getElementById(param.id);
      if (slider) {
        const value = parseInt(slider.value);
        if (!isNaN(value)) {
          options[param.id] = value;
        }
      }
    });
  }

  // Get current colors and palette from active elements
  const activePalette = document.querySelector("#color-effects-list .list-item.active");
  const currentPalette = activePalette ? parseInt(activePalette.dataset.paletteIndex) : 0;
  
  // Get current colors from color buttons
  const colorButtons = document.querySelectorAll(".color-buttons button");
  const currentColors = Array.from(colorButtons).map(button => {
    const color = button.style.backgroundColor;
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return [255, 0, 0]; // Default to red if parsing fails
  });

  console.log("Saving pattern with:", {
    effectId,
    options,
    currentPalette,
    currentColors
  });

  // Find the next available ID based on group
  const existingIds = Object.keys(jsonData.patterns)
    .map((id) => parseInt(id))
    .filter((id) => {
      if (patternGroup === "group2") return id >= 100 && id < 200;
      if (patternGroup === "group3") return id >= 200 && id < 250;
      return id < 100; // group1
    });

  // Set base ID based on group
  let baseId;
  if (patternGroup === "group2") baseId = 100;
  else if (patternGroup === "group3") baseId = 200;
  else baseId = 1; // group1

  const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : baseId;

  // Create the new pattern with the correct structure
  const newPattern = {
    n: patternName,
    mainseg: 0,
    seg: [
      {
        id: 0,
        fx: jsonData.effectIndices[jsonData.effects[effectId]],
        ...options,
        col: currentColors,
        pal: currentPalette
      },
    ],
  };

  try {
    // Create new presets object with all existing patterns plus the new one
    const newPresets = { ...jsonData.patterns };
    newPresets[nextId] = newPattern;

    // Create form data with the updated presets
    const formData = new FormData();
    const presetsBlob = new Blob([JSON.stringify(newPresets)], {
      type: "application/json"
    });
    formData.append("data", presetsBlob, "presets.json");

    // Upload the new presets.json
    const response = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload presets");
    }

    // Update local data
    jsonData.patterns = newPresets;

    // Re-render patterns list
    renderPatterns();

    // Clear only the pattern name input, keep the group selection
    document.getElementById("patternName").value = "";

    // Add flash animation to save button
    if (saveButton) {
      saveButton.classList.add('save-flash');
      // Remove the class after animation completes
      setTimeout(() => {
        saveButton.classList.remove('save-flash');
      }, 500);
    }

    console.log("Pattern saved successfully");

    // Select the newly saved pattern
    await changePattern(nextId);
  } catch (err) {
    console.error("Error saving pattern:", err);
    console.error("Failed to save pattern");
  }
}

// Change pattern and update UI
async function changePattern(id) {
  try {
    // Get the pattern data
    const pattern = jsonData.patterns[id];
    if (!pattern || !pattern.seg || !pattern.seg[0]) return;

    const segment = pattern.seg[0];

    // Send pattern change request with all parameters
    await enqueueRequest(() =>
      fetch(`${BASE_URL}/json/si`, {
        method: "POST",
        body: JSON.stringify({
          ps: id,
          seg: {
            fx: segment.fx,
            col: segment.col,
            pal: segment.pal,
            rev: segment.rev,
            rY: segment.rY,
            mi: segment.mi,
            mY: segment.mY,
            tp: segment.tp,
            sx: segment.sx,
            ix: segment.ix,
            c1: segment.c1,
            c2: segment.c2,
            c3: segment.c3
          }
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    // Wait a moment for the device to process the change
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fetch updated state after pattern change
    const response = await enqueueRequest(() => fetch(`${BASE_URL}/json/si`));
    const newState = await response.json();
    jsonData.currentState = newState;

    // Get the current segment state
    const currentSegment = newState.state?.seg?.[0];
    if (!currentSegment) return;

    // Find the effect name that corresponds to the current effect ID
    const effectName = jsonData.effects.find(
      (effect) => jsonData.effectIndices[effect] === currentSegment.fx
    );

    if (effectName) {
      const effectIndex = jsonData.effects.indexOf(effectName);

      // Re-render effects list to update active state and scroll
      renderEffects();

      // Get effect metadata and set up color controls
      const effectData = jsonData.fxdata[currentSegment.fx];
      const metadata = parseEffectMetadata(effectData);
      metadata.defaults = currentSegment.col.map(
        (col) =>
          `#${col[0].toString(16).padStart(2, "0")}${col[1]
            .toString(16)
            .padStart(2, "0")}${col[2].toString(16).padStart(2, "0")}`
      );

      // Update color controls
      setupColorControls(metadata);

      // Update palette previews
      document
        .querySelectorAll("#color-effects-list .lstIprev")
        .forEach((preview) => {
          const paletteData =
            palettesData[preview.parentElement.dataset.paletteIndex];
          if (paletteData) {
            preview.style = genPalPrevCss(paletteData);
          }
        });

      // Update effect details/options
      renderEffectDetails(effectIndex);

      // Always re-render palettes to update with new state
      renderPalettes();

      // Scroll if we're on the Colors tab and the effect uses palettes
      if (
        metadata.palette !== null &&
        document.getElementById("tab2-content").classList.contains("active")
      ) {
        setTimeout(() => {
          const activePalette = document.querySelector(
            "#color-effects-list .list-item.active"
          );
          if (activePalette) {
            activePalette.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 100);
      }
    }

    // Update pattern list UI and re-render
    renderPatterns();
  } catch (err) {
    console.error("Error changing pattern:", err);
  }
}

// Add these variables near the top with other state variables
let lastSendTime = 0;
let pendingUpdates = new Map(); // Map of LED index to color
let sendGridTimeout = null;

// Add these variables near the top with other state variables
let lastTouchX = null;
let lastTouchY = null;
let isDrawingTouch = false;

// Replace hsvToRgb with hslToRgb
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function onLoad() {
  // Check for Android WebView
  const isAndroidWebView = /Android/i.test(navigator.userAgent) && 
    /wv|WebView/i.test(navigator.userAgent);
  
  if (isAndroidWebView) {
    showWebViewWarning();
  }

  // Initialize WebSocket first
  initWebSocket();
  
  // Then load other data
  loadAllData();

  // Initialize hold-to-navigate for WLED-MM link
  const wledLink = document.getElementById('wled-link');
  if (wledLink) {
    createHoldToDeleteHandler(
      wledLink,
      () => window.location.href = '/settings',
      () => {}, // Do nothing on short press
      true // Prevent default touch behavior
    );
  }
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

let gridInitialized = false;
let ws = null;  // Global WebSocket variable

// Update the WebSocket initialization
function initWebSocket() {
  try {
    // Close existing WebSocket if any
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    const wsUrl = window.location.protocol === "file:" 
      ? "ws://192.168.1.165/ws"
      : (window.location.protocol === "https:" ? "wss://" : "ws://") + 
        window.location.host + 
        "/ws";

    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("WebSocket connected");
      // Request live data
      ws.send('{"lv":true}');
    };

    ws.onclose = () => {
      console.log("WebSocket closed, retrying in 1.5s");
      setTimeout(initWebSocket, 1500);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          // Handle binary LED data
          let leds = new Uint8Array(event.data);
          if (leds[0] != 76) return; //'L'

          // Check if it's 2D data
          const is2D = leds[1] === 2;
          const width = is2D ? leds[2] : leds.length / 3;
          const height = is2D ? leds[3] : 1;
          const start = is2D ? 4 : 2;

          // Process LED data into 2D array, excluding rightmost column
          let segments = [];
          for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width - 1; x++) { // Subtract 1 to exclude rightmost column
              const idx = start + (y * width + x) * 3;
              if (idx + 2 < leds.length) {
                row.push([leds[idx], leds[idx + 1], leds[idx + 2]]);
              }
            }
            segments.push(row);
          }

          // Update both preview canvases
          const updateCanvas = (canvasId) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            const ctx = canvas.getContext("2d");
            const containerWidth = canvas.parentElement.clientWidth;
            const pixelSize = containerWidth / (width - 1); // Adjust for excluded column
            const canvasHeight = pixelSize * height;
            
            // Update canvas dimensions
            canvas.width = containerWidth;
            canvas.height = canvasHeight;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw LED matrix
            segments.forEach((row, y) => {
              row.forEach((color, x) => {
                ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
              });
            });
          };

          // Update both canvases
          updateCanvas("preview-canvas");
          updateCanvas("preview-canvas-mobile");
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    };
  } catch (err) {
    console.error("Error initializing WebSocket:", err);
    setTimeout(initWebSocket, 1500);
  }
}

// Update the updateGridFromSegments function
function updateGridFromSegments(segments) {
  const grid = document.getElementById("drawing-grid");
  const cells = grid.children;
  const width = 10;  // Grid width
  const height = 60; // Grid height

  segments.forEach((color, index) => {
    if (index < cells.length) {
      cells[index].style.backgroundColor = "#" + color;
    }
  });
}

// Update showTab function to handle only 4 tabs
function showTab(tabNumber) {
  currentTab = tabNumber;

  // Remove brightness warning when switching tabs
  const existingWarning = document.querySelector('.brightness-warning');
  if (existingWarning) {
    existingWarning.remove();
  }

  // Update tab content visibility
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  const tabContent = document.getElementById(`tab${tabNumber}-content`);
  if (tabContent) {
    tabContent.classList.add("active");
  }

  // Update tab button states
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  const selectedTab = document.querySelector(`.tab:nth-child(${tabNumber})`);
  if (selectedTab) {
    selectedTab.classList.add("active");
  }

  // Handle specific tab behaviors
  if (tabNumber === 2) {
    // Colors tab
    const colorEffectsList = document.getElementById("color-effects-list");
    if (colorEffectsList) {
      colorEffectsList.classList.add("visible");
      renderPalettes();
    }
  }

  // Handle scrolling for all tabs except Options
  if (tabNumber !== 4) {
    requestAnimationFrame(() => {
      const scrollTargets = {
        2: "#color-effects-list .list-item.active",
        3: "#effects-list .list-item.active"
      };

      const target = document.querySelector(scrollTargets[tabNumber]);
      if (target) {
        target.scrollIntoView({ block: "center" });
      }
    });
  }

  // Reset scroll position for other tabs
  if (tabContent) {
    tabContent.scrollTop = 0;
  }
}

// Update setupColorControls to handle both mobile and desktop layouts
function setupColorControls(metadata) {
  const colorPicker = document.getElementById("color-picker");
  const paletteList = document.getElementById("color-effects-list");
  const topSection = document.querySelector(".colors-top-section");

  // Remove any existing color buttons container
  const existingButtons = document.querySelector(".color-buttons");
  if (existingButtons) {
    existingButtons.remove();
  }

  // Hide palette list if effect doesn't use palettes
  if (paletteList) {
    if (metadata.palette === null) {
      paletteList.style.cssText =
        "display: none !important; visibility: hidden; opacity: 0;";
      paletteList.classList.remove("visible");
    } else {
      paletteList.style.cssText = "";
      paletteList.classList.add("visible");
      // Only render palettes if they haven't been rendered yet
      if (!paletteList.children.length) {
        renderPalettes();
      }
    }
  }

  // Get current palette data
  const currentPaletteIndex = jsonData.currentState?.state?.pal;
  const paletteData = palettesData[currentPaletteIndex] || [];

  // Show color picker if there are colors to set
  if (metadata.colors && metadata.colors.length > 0) {
    if (colorPicker) {
      colorPicker.style.display = "block";

      // Initialize color picker if it hasn't been initialized yet
      if (!window.colorPicker) {
        window.colorPicker = new iro.ColorPicker("#color-picker", {
          width: 200,
          color: "#ff0000",
          layout: [
            {
              component: iro.ui.Wheel,
              options: {
                wheelLightness: false,
                wheelAngle: 0,
                wheelDirection: "anticlockwise",
              },
            },
            {
              component: iro.ui.Slider,
              options: {
                sliderType: "value",
                sliderSize: 30,
              },
            },
          ],
        });
      } else {
        // Remove existing color change listener if it exists
        window.colorPicker.off("color:change");
      }

      // Create color selection buttons
      const colorButtons = document.createElement("div");
      colorButtons.className = "color-buttons";
      colorButtons.style.cssText = `
          display: flex;
          flex-direction: row;
          gap: 10px;
          margin: 20px 0;
          width: 100%;
        `;

      // Track selected color index
      let selectedColorIndex = 0;

      // Use the number of colors from metadata
      const totalColors = metadata.colors.length;

      // Always get current colors from state
      const currentColors =
        jsonData.currentState?.state?.seg?.[0]?.col ||
        Array(totalColors).fill([255, 255, 255]);
      const colorSlots = currentColors.map(
        (col) =>
          `#${col[0].toString(16).padStart(2, "0")}${col[1]
            .toString(16)
            .padStart(2, "0")}${col[2].toString(16).padStart(2, "0")}`
      );

      // Create buttons for each color slot
      for (let i = 0; i < totalColors; i++) {
        const button = document.createElement("button");
        const colorLabel = metadata.colors?.[i] || `Color ${i + 1}`;
        button.textContent = colorLabel === "!" ? `Color ${i + 1}` : colorLabel;

        button.style.cssText = `
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            background-color: ${colorSlots[i]};
            color: ${getContrastColor(colorSlots[i])};
            border: ${i === 0 ? "3px solid #ff00ff" : "none"};
            box-shadow: ${i === 0 ? "0 0 10px rgba(255, 0, 255, 0.7)" : "none"};
            transition: all 0.2s ease;
            flex: 1;
            font-size: 16px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: ${
              getContrastColor(colorSlots[i]) === "#ffffff"
                ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                : "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff"
            };
            font-weight: bold;
          `;

        button.onclick = () => {
          selectedColorIndex = i;

          // Update button styles first
          colorButtons.querySelectorAll("button").forEach((btn, idx) => {
            btn.style.border = idx === i ? "3px solid #ff00ff" : "none";
            btn.style.boxShadow =
              idx === i ? "0 0 10px rgba(255, 0, 255, 0.7)" : "none";
          });

          // Set the color picker value without triggering an update
          window.colorPicker.color.set(colorSlots[i], { silent: true });
        };
        colorButtons.appendChild(button);
      }

      // Add single color change listener
      window.colorPicker.on("color:change", (color) => {
        const hexColor = color.hexString;
        colorSlots[selectedColorIndex] = hexColor;

        // Update button background color and text contrast immediately
        const buttons = colorButtons.querySelectorAll("button");
        const button = buttons[selectedColorIndex];
        button.style.backgroundColor = hexColor;
        const contrastColor = getContrastColor(hexColor);
        button.style.color = contrastColor;
        button.style.textShadow =
          contrastColor === "#ffffff"
            ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
            : "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff";

        // Only send updates to API when dragging ends
        if (!color.isMoving) {
          enqueueRequest(async () => {
            const payload = {
              seg: {
                col: colorSlots.map((color) => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                  return [
                    parseInt(result[1], 16),
                    parseInt(result[2], 16),
                    parseInt(result[3], 16)
                  ];
                })
              }
            };

            await fetch(`${BASE_URL}/json/si`, {
              method: "POST",
              body: JSON.stringify(payload),
              headers: { "Content-Type": "application/json" }
            });

            // Update the current state with the new colors
            if (!jsonData.currentState.state) {
              jsonData.currentState.state = {};
            }
            if (!jsonData.currentState.state.seg) {
              jsonData.currentState.state.seg = [{}];
            }
            jsonData.currentState.state.seg[0].col = payload.seg.col;

            // Update palette previews with a slight delay to ensure state is updated
            setTimeout(() => {
              document.querySelectorAll("#color-effects-list .lstIprev").forEach((preview) => {
                const paletteData = palettesData[preview.parentElement.dataset.paletteIndex];
                if (paletteData && paletteData.some((e) => typeof e === "string" && e.startsWith("c"))) {
                  // Create a copy of the palette data to avoid modifying the original
                  const updatedPaletteData = paletteData.map(e => {
                    if (typeof e === "string" && e.startsWith("c")) {
                      const slotNum = parseInt(e.substring(1)) - 1;
                      return colorSlots[slotNum] ? 
                        [Math.round((slotNum / (colorSlots.length - 1)) * 255), ...hexToRgb(colorSlots[slotNum])] :
                        e;
                    }
                    return e;
                  });
                  preview.style = genPalPrevCss(updatedPaletteData);
                }
              });
            }, 50);
          });
        }
      });

      // Helper function to convert hex to RGB
      function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : [255, 255, 255];
      }

      // Insert color buttons after the color picker in the top section
      topSection.appendChild(colorButtons);
    }
  } else {
    // Hide color picker if no colors are needed
    if (colorPicker) {
      colorPicker.style.display = "none";
    }
  }
}

// Add these functions near the top of the script section
function showToast(text, error = false) {
  // Create modal container if it doesn't exist
  let modal = document.getElementById('alertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alertModal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 2000;
    `;
    document.body.appendChild(modal);
  }

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    position: relative;
    background-color: #1e1e1e;
    margin: 15% auto;
    padding: 20px;
    border: 1px solid #2d2d2d;
    border-radius: 8px;
    width: 80%;
    max-width: 600px;
    color: white;
  `;

  // Add close button
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    position: absolute;
    right: 10px;
    top: 10px;
    color: #aaa;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  // Add message
  const message = document.createElement('p');
  message.textContent = text;
  message.style.cssText = `
    margin: 0;
    padding: 0;
    color: ${error ? '#ff4444' : '#ffffff'};
  `;

  // Assemble modal
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(message);
  modal.innerHTML = '';
  modal.appendChild(modalContent);

  // Show modal
  modal.style.display = 'block';

  // Auto-hide after 5 seconds if not an error
  if (!error) {
    setTimeout(() => {
      modal.style.display = 'none';
    }, 5000);
  }
}

function showErrorToast() {
  console.error("Connection to light failed!");
}

// Add this helper function near the top with the other helper functions
function queuedFetch(url) {
  return enqueueRequest(async () => {
    const response = await fetch(`${BASE_URL}${url}`);
    return response.json();
  });
}

// Add this helper function near the top of the script section
function getContrastColor(hexcolor) {
  // Remove the # if present
  const hex = hexcolor.replace("#", "");

  // Convert hex to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate perceived brightness using the sRGB color space formula
  // See: https://www.w3.org/TR/AERT/#color-contrast
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return white for dark colors, black for light colors
  return brightness < 128 ? "#ffffff" : "#000000";
}

// Update deletePattern to handle Group 3
async function deletePattern(id, name) {
  if (!confirm(`Are you sure you want to delete pattern "${name}"?`)) {
    return;
  }

  try {
    // Create new presets object
    const newPresets = {};

    // Separate patterns into groups and sort by ID
    const group1Patterns = [];
    const group2Patterns = [];
    const group3Patterns = [];

    Object.entries(jsonData.patterns).forEach(([patternId, pattern]) => {
      if (patternId != id) { // Skip the pattern being deleted
        if (patternId < 100) {
          group1Patterns.push([parseInt(patternId), pattern]);
        } else if (patternId < 200) {
          group2Patterns.push([parseInt(patternId), pattern]);
        } else if (patternId < 250) {
          group3Patterns.push([parseInt(patternId), pattern]);
        }
      }
    });

    // Sort patterns by ID within each group
    group1Patterns.sort(([a], [b]) => a - b);
    group2Patterns.sort(([a], [b]) => a - b);
    group3Patterns.sort(([a], [b]) => a - b);

    // Reindex patterns starting from appropriate base IDs
    group1Patterns.forEach(([_, pattern], index) => {
      newPresets[index + 1] = pattern;
    });
    group2Patterns.forEach(([_, pattern], index) => {
      newPresets[index + 100] = pattern;
    });
    group3Patterns.forEach(([_, pattern], index) => {
      newPresets[index + 200] = pattern;
    });

    // Create form data with the updated presets
    const formData = new FormData();
    const presetsBlob = new Blob([JSON.stringify(newPresets)], {
      type: "application/json"
    });
    formData.append("data", presetsBlob, "presets.json");

    // Upload the new presets.json
    const response = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload presets");
    }

    // Update local data
    jsonData.patterns = newPresets;

    // Re-render patterns list
    renderPatterns();

    console.log("Pattern deleted successfully");
  } catch (err) {
    console.error("Error deleting pattern:", err);
    console.error("Failed to delete pattern");
  }
}

// Add this function before setBrightness
function updateBrightnessWarning(value) {
  const warningContainer = document.getElementById('brightness-warning-container');
  if (!warningContainer) return;
  
  // Clear any existing warning
  warningContainer.innerHTML = '';

  // Show warning if brightness is high, regardless of tab visibility
  if (value > 128) {
    const warning = document.createElement('div');
    warning.className = 'brightness-warning';
    warning.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      color: rgb(255, 7, 7);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      text-align: center;
    `;
    warning.textContent = '⚠️ High levels will reduce battery life!';
    warningContainer.appendChild(warning);
  }
}

// Update setBrightness function
async function setBrightness(value) {
  try {
    await enqueueRequest(() =>
      fetch(`${BASE_URL}/json`, {
        method: "POST",
        body: JSON.stringify({
          bri: value
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    
    // Update the brightness slider
    const brightnessSlider = document.getElementById("brightness");
    if (brightnessSlider) {
      brightnessSlider.value = value;
      updateBrightnessWarning(value);
    }
    
    // Update button states
    document.querySelectorAll('[onclick^="setBrightness"]').forEach(button => {
      const buttonValue = parseInt(button.getAttribute('onclick').match(/\d+/)[0]);
      button.style.background = buttonValue === value ? '#007BFF' : '#2d2d2d';
    });
  } catch (err) {
    console.error("Error updating brightness:", err);
  }
}

function showWebViewWarning() {
  // Create modal container if it doesn't exist
  let modal = document.getElementById('alertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alertModal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 2000;
    `;
    document.body.appendChild(modal);
  }

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    position: relative;
    background-color: #1e1e1e;
    margin: 15% auto;
    padding: 20px;
    border: 1px solid #2d2d2d;
    border-radius: 8px;
    width: 80%;
    max-width: 600px;
    color: white;
  `;

  // Add close button
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    position: absolute;
    right: 10px;
    top: 10px;
    color: #aaa;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  // Add message
  const message = document.createElement('p');
  message.innerHTML = "<center><b>Unfortunately, the Android Wi-Fi login browser doesn't support proper scrolling.</b><br><br>To fix this, tap the three-dot menu in the top right corner and select <i>Use this network as is</i>.<br><br>Then, open <a href='http://4.3.2.1/' target='_blank'>http://4.3.2.1/</a> directly in your regular browser.</center>";
  message.style.cssText = `
    margin: 0;
    padding: 0;
    color: #ff4444;
  `;

  // Assemble modal
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(message);
  modal.innerHTML = '';
  modal.appendChild(modalContent);

  // Show modal
  modal.style.display = 'block';
}
