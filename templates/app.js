// --- CONFIGURATION ---
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const lhosst = ''

// --- NEW: APPWRITE CONFIGURATION ---
const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'; // Or your self-hosted endpoint
const APPWRITE_PROJECT_ID = '68f141dd000f83849c21'; // Replace with your Project ID
const APPWRITE_DATABASE_ID = '68f146de0013ba3e183a'; // Replace with your Database ID
const APPWRITE_ALERTS_COLLECTION_ID = 'emptt'; // Replace with your Collection ID

// --- Caches and Mappings ---
const lineDataCache = new Map();
const busLineDataCache = new Map(); // --- Added this
const lineNameToNumber = {
    'Blue Line': '1',
    'Red Line': '2',
    'Orange Line': '3',
    'Yellow Line': '4',
    'Green Line': '5',
    'Purple Line': '6'
};

window.onload = async () => {
    // --- NEW: Live route update state variables ---
    const arrivalAnimationTimers = new Map();
    const animationFrames = [`${lhosst}/lt3.png`, `${lhosst}/lt2.png`, `${lhosst}/lt1.png`];
    let currentRouteData = null;
    let liveRouteUpdater = null;
    let stationLiveUpdater = null;

    // --- NEW: Animation helper ---
    function startArrivalAnimation(elementId, imgElement) {
        if (arrivalAnimationTimers.has(elementId)) {
            clearInterval(arrivalAnimationTimers.get(elementId));
        }
        let frame = 0;
        imgElement.src = animationFrames[frame];
        const intervalId = setInterval(() => {
            frame = (frame + 1) % animationFrames.length;
            imgElement.src = animationFrames[frame];
        }, 500);
        arrivalAnimationTimers.set(elementId, intervalId);
    }

    // --- NEW: Animation helper ---
    function stopArrivalAnimation(elementId) {
        if (arrivalAnimationTimers.has(elementId)) {
            clearInterval(arrivalAnimationTimers.get(elementId));
            arrivalAnimationTimers.delete(elementId);
        }
    }

    // --- NEW: Time formatting helper ---
    function getArrivalTime(minutesUntil) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + minutesUntil);
        return now.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    // --- APPWRITE INITIALIZATION ---
    const { Client, Databases, ID, Query } = Appwrite;
    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);
    const databases = new Databases(client);

// --- MAP INITIALIZATION ---
const map = L.map('map', { zoomControl: false }).setView([24.7136, 46.6753], 11);
const apiKey = "exlDzvn29auMMJLNeP23";

// Use the new v4 syntax: L.maptiler.maptilerLayer
L.maptiler.maptilerLayer({
    apiKey: apiKey,
    style: L.maptiler.MapStyle.STREETS, // Use the official MapStyle object
    language: "en",
}).addTo(map);

    // --- PANEL AND VIEW ELEMENTS ---
    const panelMainView = document.getElementById('panel-main-view');
    const stationDetailView = document.getElementById('station-detail-view');
    const stationDetailBackButton = document.getElementById('station-detail-back-btn');
    const lineDetailView = document.getElementById('line-detail-view');
    const lineDetailBackButton = document.getElementById('line-detail-back-btn');
    const directionSelectionView = document.getElementById('direction-selection-view');
    const directionSelectionBackButton = document.getElementById('direction-selection-back-btn');

    const routeForm = document.getElementById('route-form');
    const startInput = document.getElementById('start-input');
    const endInput = document.getElementById('end-input');
    let activeRouteLayers = new L.FeatureGroup().addTo(map);
    let stationMarkersLayer = new L.FeatureGroup();
    let currentStationsLatLng = null;
    let stationsData = null;
    let allStations = [];
    let allLinesData = null;
    let previousView = null;

    // --- TAB FUNCTIONALITY ---
    const routeTab = document.getElementById('route-tab');
    const stationsTab = document.getElementById('stations-tab');
    const routeContent = document.getElementById('route-content');
    const linesTab = document.getElementById('lines-tab');
    const stationsContent = document.getElementById('stations-content');

    const linesContent = document.getElementById('lines-content');
    const lineSearchInput = document.getElementById('line-search-input');

    function switchTab(activeTab) {
        [routeTab, stationsTab, linesTab].forEach(tab => tab.classList.remove('active'));
        [routeContent, stationsContent, linesContent].forEach(pane => pane.classList.remove('active'));
        activeTab.classList.add('active');
        document.getElementById(activeTab.id.replace('-tab', '-content')).classList.add('active');


        // Handle layer visibility and data fetching
        if (activeTab === stationsTab) {
            map.addLayer(stationMarkersLayer);
            if (stationsData === null) fetchNearbyStations();
        } else if (activeTab === routeTab) {
            map.addLayer(activeRouteLayers);
        } else if (activeTab === linesTab) {
            if (allLinesData === null) fetchAllLines(); // Fetch lines data if not already loaded
        }
    }

    routeTab.addEventListener('click', () => switchTab(routeTab, stationsTab, routeContent, stationsContent));
    stationsTab.addEventListener('click', () => switchTab(stationsTab, routeTab, stationsContent, routeContent));
    linesTab.addEventListener('click', () => switchTab(linesTab));

    // --- GEOLOCATION FUNCTIONALITY ---
    const useMyLocationBtn = document.getElementById('use-my-location');

    function setLocationFromGPS() {
        if (!navigator.geolocation) {
            startInput.placeholder = "Geolocation is not supported";
            return;
        }
        startInput.placeholder = "Finding your location...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const coordString = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                startInput.value = coordString;
                startInput.placeholder = "Enter starting point";
                map.setView([latitude, longitude], 13);
                currentStationsLatLng = { lat: latitude, lng: longitude };
                if (stationsTab.classList.contains('active')) {
                    fetchNearbyStations();
                }
            },
            () => {
                startInput.placeholder = "Could not get your location";
                console.warn("Unable to retrieve location.");
            }
        );
    }

    useMyLocationBtn.addEventListener('click', setLocationFromGPS);

    // --- FETCH NEARBY STATIONS ---
    async function fetchNearbyStations() {
        if (!currentStationsLatLng) {
            const stationsList = document.getElementById('stations-list');
            stationsList.innerHTML = '<p>Use the "My Location" button or click on the map to set a point to search for nearby stations.</p>';
            return;
        }

        const stationsList = document.getElementById('stations-list');
        stationsList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Finding nearby stations...</p></div>`;

        try {
            const response = await fetch(`${lhosst}/nearbystations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentStationsLatLng)
            });
            if (!response.ok) throw new Error(`Failed to fetch stations: ${response.status}`);
            stationsData = await response.json();
            displayStations(stationsData);
        } catch (error) {
            console.error("Failed to fetch nearby stations:", error);
            stationsList.innerHTML = '<p style="color: red;">Error loading nearby stations.</p>';
        }
    }

    // --- DISPLAY STATIONS ---
    function displayStations(data) {
        const stationsList = document.getElementById('stations-list');
        stationsList.innerHTML = '';
        stationMarkersLayer.clearLayers();

        if (!data || data.length === 0) {
            stationsList.innerHTML = '<p>No nearby stations found within 1.5 km.</p>';
            return;
        }

        const stationCoords = [];

        data.forEach(station => {
            // --- FIX: Trim whitespace for robust comparison ---
            const fullStation = allStations.find(s => s.label.trim() === station.name.trim());
            if (!fullStation) {
                console.warn(`Could not find station "${station.name}" in allStations list.`);
                return;
            }

            const { lat, lng } = fullStation;
            stationCoords.push([lat, lng]);

            const stationDiv = document.createElement('div');
            stationDiv.className = 'station-item';
            stationDiv.innerHTML = `
                <div class="station-icon">${station.type === 'bus' ? '🚌' : '🚇'}</div>
                <div class="station-details">
                    <h4>${station.name}</h4>
                    <p>${Math.round(station.distance)} m away</p>
                    <p>${Math.round(station.duration / 60)} min walk</p>
                </div>
            `;

            const marker = L.marker([lat, lng]).addTo(stationMarkersLayer);
            marker.bindPopup(`<b>${station.name}</b><br>${Math.round(station.distance)}m away`);

            const handleStationClick = () => {
                document.querySelectorAll('.station-item').forEach(el => el.classList.remove('highlight'));
                stationDiv.classList.add('highlight');
                stationDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                map.setView([lat, lng], 16);
                marker.openPopup();
                showStationDetails(station, panelMainView);
            };

            stationDiv.addEventListener('click', handleStationClick);
            marker.on('click', handleStationClick);
            stationsList.appendChild(stationDiv);
        });

        if (currentStationsLatLng) stationCoords.push([currentStationsLatLng.lat, currentStationsLatLng.lng]);
        if (stationCoords.length > 0) map.fitBounds(L.latLngBounds(stationCoords), { padding: [50, 50] });
    }

    async function showStationDetails(station, fromView) {
        previousView = fromView;
        hideAllViews(); // This will clear any existing station timer
        stationDetailView.classList.remove('hidden');

        const stationDetailName = document.getElementById('station-detail-name');
        const stationDetailContent = document.getElementById('station-detail-content');

        const currentStationName = station.name; // Store for the updater
        const stationType = station.type; // <-- Get the station type
        stationDetailName.textContent = currentStationName;
        stationDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading lines and arrivals...</p></div>`;

        const apiStationName = cleanStationName(currentStationName);

        try {
            // --- MODIFIED: Conditional fetching ---
            const linesPromise = fetch(`${lhosst}/searchstation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: apiStationName })
            });

            let arrivalPromise;
            if (stationType === 'metro') {
                arrivalPromise = fetchMetroArrivals(apiStationName)
                                    .catch(e => { console.error("Metro arrivals fetch failed:", e); return { arrivals: [] }; });
            } else if (stationType === 'bus') {
                arrivalPromise = fetchBusArrivals(apiStationName)
                                    .catch(e => { console.error("Bus arrivals fetch failed:", e); return { arrivals: [] }; });
            } else {
                // Should not happen, but handle gracefully
                console.warn("Unknown station type:", stationType);
                arrivalPromise = Promise.resolve({ arrivals: [] }); // Resolve with empty data
            }

            // Wait for lines and the relevant arrivals
            const [linesResponse, arrivalsData] = await Promise.all([
                linesPromise,
                arrivalPromise
            ]);

            if (!linesResponse.ok) throw new Error(`API error fetching station lines: ${linesResponse.status}`);
            const lineData = await linesResponse.json();

            const initialArrivalsData = arrivalsData?.arrivals || [];

            // Render using the new function
            renderStationLinesWithArrivals(currentStationName, lineData, initialArrivalsData);

            // Start the live update interval (only if arrivals were fetched)
            if (stationLiveUpdater) clearInterval(stationLiveUpdater);
            if (stationType === 'metro' || stationType === 'bus') { // Only update if it's a type we fetch
                 // --- MODIFIED: Pass station type to fetch function ---
                 const fetchFunction = stationType === 'metro' ? fetchMetroArrivals : fetchBusArrivals;

                 // Create a dedicated function to fetch and update for *this* station type
                 const updateThisStation = async () => {
                     try {
                         const freshArrivalsData = await fetchFunction(apiStationName);
                         (freshArrivalsData?.arrivals || []).forEach(arrival => {
                             updateSingleStationArrival(arrival);
                         });
                         // Handle case where arrivals might become empty after update
                         const contentArea = document.getElementById('station-detail-content');
                          if (contentArea && (!freshArrivalsData?.arrivals || freshArrivalsData.arrivals.length === 0) && !contentArea.querySelector('.loader-container') && !contentArea.querySelector('.no-arrivals-message')) {
                              renderStationLinesWithArrivals(currentStationName, lineData, []); // Re-render with no arrivals message
                          } else if (contentArea && contentArea.querySelector('.no-arrivals-message') && freshArrivalsData?.arrivals && freshArrivalsData.arrivals.length > 0) {
                              // If message is showing but we now have arrivals, re-render
                               renderStationLinesWithArrivals(currentStationName, lineData, freshArrivalsData.arrivals);
                          }

                     } catch (error) {
                         console.error(`Failed to fetch ${stationType} arrivals during update:`, error);
                         // Optionally show error in UI, but might be noisy
                     }
                 };

                 updateThisStation(); // Update immediately
                 stationLiveUpdater = setInterval(updateThisStation, 60000); // Update every minute
            }

        } catch (error) {
            console.error("Failed to fetch station details or initial arrivals:", error);
            stationDetailContent.innerHTML = '<p style="color: red;">Could not load station details.</p>';
            if (stationLiveUpdater) clearInterval(stationLiveUpdater); // Clear timer on error too
            stationLiveUpdater = null;
        }
    }

    function renderStationLinesFallback(data) {
        const stationDetailContent = document.getElementById('station-detail-content');
        stationDetailContent.innerHTML = '';

        if (data.metro_lines && data.metro_lines.length > 0) {
            const metroContainer = document.createElement('div');
            metroContainer.className = 'line-list-container';
            metroContainer.innerHTML = `<h4>🚇 Metro Lines</h4>`;
            const metroGrid = document.createElement('div');
            metroGrid.className = 'line-grid';
            data.metro_lines.forEach(line => {
                const badge = document.createElement('div');
                badge.className = 'line-badge';
                badge.textContent = line;
                badge.style.backgroundColor = lineColors.metro[line] || lineColors.default;
                metroGrid.appendChild(badge);
            });
            metroContainer.appendChild(metroGrid);
            stationDetailContent.appendChild(metroContainer);
        }

        if (data.bus_lines && data.bus_lines.length > 0) {
            const busContainer = document.createElement('div');
            busContainer.className = 'line-list-container';
            busContainer.innerHTML = `<h4>🚌 Bus Lines</h4>`;
            const busGrid = document.createElement('div');
            busGrid.className = 'line-grid';
            data.bus_lines.forEach(line => {
                const badge = document.createElement('div');
                badge.className = 'line-badge';
                badge.textContent = line;
                badge.style.backgroundColor = lineColors.bus;
                busGrid.appendChild(badge);
            });
            busContainer.appendChild(busGrid);
            stationDetailContent.appendChild(busContainer);
        }

        if ((!data.metro_lines || data.metro_lines.length === 0) && (!data.bus_lines || data.bus_lines.length === 0)) {
            stationDetailContent.innerHTML = '<p>No lines found for this station.</p>';
        }
    }

    // --- NEW: Renders the station detail list with arrival placeholders ---
    function renderStationLinesWithArrivals(stationName, lineData, initialArrivalsData) {
        const stationDetailContent = document.getElementById('station-detail-content');
        stationDetailContent.innerHTML = ''; // Clear loader

        // Separate into Metro and Bus based on lineData
        const metroArrivals = initialArrivalsData.filter(a => lineData.metro_lines.includes(a.line));
        const busArrivals = initialArrivalsData.filter(a => lineData.bus_lines.includes(a.line));

        // Sort arrivals within each type
        metroArrivals.sort((a, b) => a.minutes_until - b.minutes_until);
        busArrivals.sort((a, b) => a.minutes_until - b.minutes_until);

        let contentAdded = false;

        // Render Metro Arrivals
        if (metroArrivals.length > 0) {
            contentAdded = true;
            const metroContainer = document.createElement('div');
            metroContainer.className = 'station-line-list-container';
            metroContainer.innerHTML = `<h4>🚇 Metro Lines</h4>`;
            metroArrivals.forEach(arrival => {
                const item = document.createElement('div');
                item.className = 'station-line-item';
                const color = lineColors.metro[arrival.line] || lineColors.default;
                const arrivalId = getStationArrivalElementId(arrival);

                item.innerHTML = `
                    <div class="station-line-badge" style="background-color: ${color};">${arrival.line}</div>
                    <div class="station-line-details">${arrival.destination}</div>
                    <div class="station-line-arrival" id="${arrivalId}">
                        <!-- Placeholder - updated by JS -->
                    </div>
                `;
                metroContainer.appendChild(item);
                // Immediately update with initial data
                updateSingleStationArrival(arrival);
            });
            stationDetailContent.appendChild(metroContainer);
        }

        // Render Bus Arrivals
        if (busArrivals.length > 0) {
            contentAdded = true;
            const busContainer = document.createElement('div');
            busContainer.className = 'station-line-list-container';
            busContainer.innerHTML = `<h4>🚌 Bus Lines</h4>`;
            busArrivals.forEach(arrival => {
                const item = document.createElement('div');
                item.className = 'station-line-item';
                const color = lineColors.bus;
                const arrivalId = getStationArrivalElementId(arrival);

                item.innerHTML = `
                    <div class="station-line-badge" style="background-color: ${color};">${arrival.line}</div>
                    <div class="station-line-details">${arrival.destination}</div>
                    <div class="station-line-arrival" id="${arrivalId}">
                        <!-- Placeholder - updated by JS -->
                    </div>
                `;
                busContainer.appendChild(item);
                // Immediately update with initial data
                updateSingleStationArrival(arrival);
            });
            stationDetailContent.appendChild(busContainer);
        }

        if (!contentAdded) {
            stationDetailContent.innerHTML = '<p class="no-arrivals-message" style="text-align: center; color: #5f6368; margin-top: 20px;">No upcoming arrivals found.</p>';
        }
    }

    // --- LINES TAB LOGIC ---
    async function fetchAllLines() {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading all lines...</p></div>`;

        try {
            const [metroLinesRes, busLinesRes] = await Promise.all([
                fetch(`${lhosst}/mtrlines`),
                fetch(`${lhosst}/buslines`)
            ]);
            const metroLinesData = await metroLinesRes.json();
            const busLinesData = await busLinesRes.json();
            const metroLineNumbers = metroLinesData.lines.split(',');
            const busLineNumbers = busLinesData.lines.split(',');

            const metroPromises = metroLineNumbers.map(line =>
                fetch(`${lhosst}/viewmtr`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line })
                }).then(res => res.json()).then(data => ({ type: 'metro', line, data }))
            );

            const busPromises = busLineNumbers.map(line =>
                fetch(`${lhosst}/viewbus`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line })
                }).then(res => res.json()).then(data => ({ type: 'bus', line, data }))
            );

            const allLineDetails = await Promise.all([...metroPromises, ...busPromises]);

            allLinesData = allLineDetails.map(({ type, line, data }) => {
                let terminus = 'Unknown';
                if (type === 'metro' && data.stations && data.stations.length > 0) {
                    terminus = `${data.stations[0]} - ${data.stations[data.stations.length - 1]}`;
                } else if (type === 'bus') {
                    const keys = Object.keys(data);
                    if (keys.length === 1) terminus = `${keys[0]} Ring`;
                    else if (keys.length > 1) terminus = `${keys[1]} - ${keys[0]}`;
                }
                return { type, line, terminus };
            });

            allLinesData.sort((a, b) => {
                const aIsMetro = a.type === 'metro';
                const bIsMetro = b.type === 'metro';
                if (aIsMetro !== bIsMetro) return aIsMetro ? -1 : 1;
                const aNum = parseInt(a.line.replace(/\D/g, ''), 10);
                const bNum = parseInt(b.line.replace(/\D/g, ''), 10);
                return aNum - bNum;
            });

            renderLinesList(allLinesData);
        } catch (error) {
            console.error("Failed to fetch all lines:", error);
            linesList.innerHTML = '<p style="color: red;">Error loading lines.</p>';
        }
    }

    function renderLinesList(lines) {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = '';
        if (!lines || lines.length === 0) {
            linesList.innerHTML = '<p>No lines found.</p>';
            return;
        }

        lines.forEach(line => {
            const item = document.createElement('div');
            item.className = 'line-item';

            const badge = document.createElement('div');
            badge.className = 'line-item-badge';
            badge.textContent = line.line;
            let color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;
            badge.style.backgroundColor = color;

            const details = document.createElement('div');
            details.className = 'line-item-details';
            details.innerHTML = `<p class="terminus">${line.terminus}</p><p class="line-type">${line.line.startsWith('BRT') ? 'BRT Bus' : (line.type.charAt(0).toUpperCase() + line.type.slice(1))}</p>`;

            item.appendChild(badge);
            item.appendChild(details);
            linesList.appendChild(item);

            // UPDATED: Add click listener to the whole item
            item.addEventListener('click', () => handleLineClick(line));
        });
    }

    lineSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!allLinesData) return;
        const filteredLines = allLinesData.filter(line =>
            line.line.toLowerCase().includes(query) ||
            line.terminus.toLowerCase().includes(query)
        );
        renderLinesList(filteredLines);
    });
    const lineColors = {
        metro: { 'Blue Line': '#00aee6', 'Red Line': '#ef4938', 'Orange Line': '#f68d39', 'Yellow Line': '#ffd10a', 'Green Line': '#37b23f', 'Purple Line': '#984b9d', '1': '#00aee6', '2': '#ef4938', '3': '#f68d39', '4': '#ffd10a', '5': '#37b23f', '6': '#984b9d' },
        bus: '#18a034',
        walk: '#6c757d',
        default: '#555'
    };

    // --- VIEW MANAGEMENT ---
    function hideAllViews() {
        [panelMainView, stationDetailView, lineDetailView, directionSelectionView].forEach(v => v.classList.add('hidden'));
        if (stationLiveUpdater) {
            clearInterval(stationLiveUpdater);
            stationLiveUpdater = null;
            // Also clear any animations potentially running in station view
            arrivalAnimationTimers.forEach(timer => clearInterval(timer));
            arrivalAnimationTimers.clear();
        }
    }

    function showMainPanel() {
        hideAllViews(); // This already clears the timer now
        stationMarkersLayer.clearLayers();
        map.addLayer(activeRouteLayers);
        panelMainView.classList.remove('hidden');
    }

    stationDetailBackButton.addEventListener('click', showMainPanel);
    lineDetailBackButton.addEventListener('click', showMainPanel);
    directionSelectionBackButton.addEventListener('click', showMainPanel);

    function handleLineClick(line) {
        const isRingRoute = line.terminus.endsWith('Ring');

        if (!isRingRoute) {
            showDirectionSelection(line);
        }
        else {
            // For metro or ring routes, determine direction from the label
            const directionKey = line.type === 'metro' ? line.terminus.split(' - ')[0] : null;
            showLineDetails(line, directionKey);
        }
    }

// --- MODIFIED: Generates unique ID for station arrival elements including time ---
    function getStationArrivalElementId(arrival) {
        const cleanDest = cleanStationName(arrival.destination).replace(/[^a-zA-Z0-9]/g, '');
        // Add minutes_until to make the ID unique per arrival instance
        return `station-${arrival.line}-${cleanDest}-${arrival.minutes_until}`;
    }

    function updateSingleStationArrival(arrivalData) {
        const elementId = getStationArrivalElementId(arrivalData);
        const arrivalElement = document.getElementById(elementId);
        if (!arrivalElement) return; // Element might not exist if data changed rapidly

        stopArrivalAnimation(elementId); // Stop previous animation

        const minutes = arrivalData.minutes_until;
        let htmlContent = '';
        let color = '#5f6368'; // Default grey

        if (minutes > 60) {
            const arrivalTime = getArrivalTime(minutes);
            htmlContent = `<span class="arrival-text">${arrivalTime}</span>`;
            color = '#000'; // Black for future time
        } else {
            let arrivalText = '';
            if (minutes <= 0) arrivalText = 'Arriving now';
            else if (minutes === 1) arrivalText = '1 min';
            else arrivalText = `${Math.round(minutes)} mins`;

            htmlContent = `
                <img src="/lt3.png" class="arrival-animation" alt="" />
                <span class="arrival-text">${arrivalText}</span>
            `;
            color = '#18a034'; // Green for arriving soon

            // Set color immediately for text
            arrivalElement.innerHTML = htmlContent; // Add content first
            arrivalElement.querySelector('.arrival-text').style.color = color; // Style text

            // Start animation if needed
            const imgElement = arrivalElement.querySelector('.arrival-animation');
            if (imgElement) startArrivalAnimation(elementId, imgElement);
            return; // Skip final color setting as it's done
        }

        // Set content and color for >60 mins or error states
        arrivalElement.innerHTML = htmlContent;
        const textSpan = arrivalElement.querySelector('.arrival-text');
        if(textSpan) textSpan.style.color = color;
    }

// --- MODIFIED: Fetches and updates all individual arrival elements ---
    async function fetchAndUpdateStationArrivals(stationName, stationType, lineDataForStation) {
        const apiStationName = cleanStationNameForApi(stationName);
        try {
            let arrivalsData;
            if (stationType === 'metro') {
                 arrivalsData = await fetchMetroArrivals(apiStationName).catch(e => { console.error("Metro arrivals fetch failed:", e); return { arrivals: [] }; });
            } else if (stationType === 'bus') {
                 arrivalsData = await fetchBusArrivals(apiStationName).catch(e => { console.error("Bus arrivals fetch failed:", e); return { arrivals: [] }; });
            } else {
                 arrivalsData = { arrivals: [] };
            }

            const allArrivals = arrivalsData?.arrivals || [];

            // --- REMOVED Grouping ---

            // --- Update UI for each arrival using its unique ID ---
            allArrivals.forEach(arrival => {
                updateSingleStationArrival(arrival); // This function uses the unique ID now
            });
            // --- End update UI ---

            // --- REMOVED Stale Entry Handling ---
            // Elements for arrivals that no longer exist won't be updated and
            // will be removed entirely the next time showStationDetails -> renderStationLinesWithArrivals runs.

            // --- Update "No arrivals" message status ---
            const stationDetailContent = document.getElementById('station-detail-content');
            const noArrivalsMsg = stationDetailContent ? stationDetailContent.querySelector('.no-arrivals-message') : null;
            const hasArrivals = allArrivals.length > 0;

            if (stationDetailContent && !hasArrivals && !stationDetailContent.querySelector('.loader-container') && !noArrivalsMsg) {
                 // Add "No arrivals" message if it's not there and shouldn't be
                 stationDetailContent.innerHTML = '<p class="no-arrivals-message" style="text-align: center; color: #5f6368; margin-top: 20px;">No upcoming arrivals found.</p>';
            } else if (noArrivalsMsg && hasArrivals) {
                 // Remove "No arrivals" message if it's there and shouldn't be
                 noArrivalsMsg.remove();
                 // We might need to re-render the list if the message was the *only* content.
                 // Fetching initial line data again might be needed, or rely on the next full refresh.
                 // For now, just removing the message might leave a blank space until next refresh.
            }
            // --- End "No arrivals" message update ---


        } catch (error) {
            console.error("Failed to fetch station arrivals:", error);
            const contentArea = document.getElementById('station-detail-content');
             if (contentArea && !contentArea.querySelector('.loader-container')) {
                 if (!contentArea.querySelector('.no-arrivals-message')) {
                    contentArea.innerHTML = '<p style="color: red; text-align: center; margin-top: 20px;">Could not load live arrival data.</p>';
                 }
             }
        }
    }

    function showDirectionSelection(line) {
        hideAllViews();
        directionSelectionView.classList.remove('hidden');
        const content = document.getElementById('direction-selection-content');
        const [start, end] = line.terminus.split(' - ');
        // For buses, the key is the destination. For metro, it's the start.
        const forwardKey = line.type === 'bus' ? end : start;
        const backwardKey = line.type === 'bus' ? start : end;


        content.innerHTML = `
            <button class="direction-option" data-direction-key="${forwardKey}">${start} → ${end}</button>
            <button class="direction-option" data-direction-key="${backwardKey}">${end} → ${start}</button>
        `;

        content.querySelectorAll('.direction-option').forEach(button => {
            button.addEventListener('click', (e) => {
                showLineDetails(line, e.target.dataset.directionKey);
            });
        });
    }

    async function showLineDetails(line, directionKey = null) {
        showView(lineDetailView);
        const lineDetailName = document.getElementById('line-detail-name');
        lineDetailName.innerHTML = '';
        lineDetailName.removeAttribute('style');

        const badge = document.createElement('div');
        badge.className = 'line-detail-badge';
        badge.textContent = line.line;
        const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;
        badge.style.backgroundColor = color;

        const terminus = document.createElement('h4');
        terminus.className = 'line-detail-terminus';
        terminus.textContent = line.terminus;

        lineDetailName.appendChild(badge);
        lineDetailName.appendChild(terminus);

        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading stations...</p></div>`;

        try {
            const endpoint = line.type === 'metro' ? '/viewmtr' : '/viewbus';
            const response = await fetch(`${lhosst}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: line.line })
            });
            if (!response.ok) throw new Error('Failed to fetch line data');
            const data = await response.json();

            let stationNames;
            if (line.type === 'metro') {
                stationNames = data.stations;
                if (directionKey && stationNames[0] !== directionKey) {
                    stationNames.reverse();
                }
            } else {
                const key = directionKey || Object.keys(data)[0];
                stationNames = data[key];
            }

            renderLineStations(stationNames, line);

        } catch (error) {
            console.error("Failed to load line details:", error);
            lineDetailContent.innerHTML = '<p style="color: red;">Could not load line details.</p>';
        }
    }

    function showView(viewToShow) {
        hideAllViews();
        viewToShow.classList.remove('hidden');
    }

function renderLineStations(stationNames, line) {
        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = '';
        stationMarkersLayer.clearLayers();
        map.removeLayer(activeRouteLayers);
        map.addLayer(stationMarkersLayer);

        if (!stationNames || stationNames.length === 0) {
            lineDetailContent.innerHTML = '<p>No stations found for this line.</p>';
            return;
        }

        const stationList = document.createElement('div');
        stationList.className = 'detail-station-list';
        const allCoords = [];
        const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;

        stationNames.forEach(name => {
            const station = allStations.find(s => s.label.includes(name));

            const stationItem = document.createElement('div');
            stationItem.className = 'detail-station-item';
            stationItem.textContent = name;
            stationList.appendChild(stationItem);

            if (station) {
                const { lat, lng } = station;
                const latLng = [lat, lng];
                allCoords.push(latLng);

                const circleMarker = L.circleMarker(latLng, {
                    radius: 6,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(stationMarkersLayer);

                circleMarker.bindPopup(`<b>${station.label}</b>`);
                stationItem.addEventListener('click', () => {
                    // Create a "mock" station object to pass to the details function
                    const mockStation = { name: station.label, type: station.type };
                    showStationDetails(mockStation, lineDetailView); // Pass current view
                });
            }
        });

        lineDetailContent.appendChild(stationList);

        if (allCoords.length > 1) {
            L.polyline(allCoords, {
                color: color,
                weight: 5,
                opacity: 0.8
            }).addTo(stationMarkersLayer);
        }

        if (allCoords.length > 0) {
            map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
        }
    }

    function hideStationDetails() {
        stationDetailView.classList.add('hidden');
        panelMainView.classList.remove('hidden');
    }

    stationDetailBackButton.addEventListener('click', hideStationDetails);

    // --- OSM Address Formatting ---
    function formatOsmName(item) {
        const address = item.address || {};
        let mainName = item.name || address.road || address.amenity || address.shop || address.building || address.tourism || address.historic;
        if (!mainName) {
            mainName = item.display_name.split(',')[0];
        }
        const secondaryName = address.suburb || address.neighbourhood || address.quarter || '';
        return { main: mainName, secondary: secondaryName };
    }

// --- MODIFIED: CUSTOM AUTOCOMPLETE IMPLEMENTATION ---
    class CustomAutocomplete {
        constructor(input, stationList) {
            this.input = input;
            this.stationList = stationList;
            this.container = document.createElement('div');
            this.container.className = 'autocomplete-suggestions';
            this.input.parentNode.appendChild(this.container);

            this.debounceTimeout = null;
            this.latestRequest = 0;

            this.input.addEventListener('input', this.onInput.bind(this));
            this.input.addEventListener('keydown', this.onKeyDown.bind(this));
            document.addEventListener('click', this.onDocumentClick.bind(this));

            // --- NEW: Clear stored coords on manual input ---
            this.input.addEventListener('input', () => {
                // If user types manually after selecting, clear the stored coords
                if (this.input.dataset.coordinates) {
                    delete this.input.dataset.coordinates;
                     // Optional: maybe add a visual cue that it's no longer linked?
                }
            });
            // --- END NEW ---

            this.currentSelection = -1;
            this.currentSuggestions = [];
        }

        onInput() {
            clearTimeout(this.debounceTimeout);
            const query = this.input.value.trim();
            if (query.length < 3) {
                this.hide();
                return;
            }
            // --- MODIFIED: Don't fetch if input looks like coords already ---
            if (parseCoordinates(query)) {
                this.hide();
                return;
            }
            // --- END MODIFIED ---
            this.debounceTimeout = setTimeout(() => this.fetchSuggestions(query), 250);
        }

        async fetchSuggestions(query) {
            const thisRequest = ++this.latestRequest;
            const stationPromise = this.getStationSuggestions(query);
            const osmPromise = this.getOSMSuggestions(query);
            const [stationResults, osmResults] = await Promise.all([stationPromise, osmPromise]);
            if (thisRequest !== this.latestRequest) return;
            this.currentSuggestions = [...stationResults, ...osmResults];
            this.renderSuggestions();
        }

        getStationSuggestions(query) {
            const lowerCaseQuery = query.toLowerCase();
            return this.stationList
                .filter(station => station.label.toLowerCase().includes(lowerCaseQuery))
                .slice(0, 3)
                .map(station => ({
                    type: 'station',
                    name: station.label, // Store the clean name
                    displayName: station.label, // Use full label for display
                    lat: station.lat,
                    lng: station.lng
                 }));
        }

        async getOSMSuggestions(query) {
            try {
                const params = new URLSearchParams({ q: `${query}, Riyadh`, format: 'json', addressdetails: 1, limit: 4, viewbox: '46.2,25.2,47.2,24.2', bounded: 1 });
                const response = await fetch(`${OSM_NOMINATIM_URL}?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return data.map(item => {
                     const formattedName = formatOsmName(item);
                     // Construct a display name (Main, Secondary if available)
                     let displayName = formattedName.main;
                     if (formattedName.secondary) {
                         displayName += `, ${formattedName.secondary}`;
                     }
                     return {
                         type: 'map',
                         name: formattedName.main, // Store just the main name? Or full? Let's use main for simplicity
                         displayName: displayName, // For display in input
                         lat: parseFloat(item.lat),
                         lng: parseFloat(item.lon)
                     };
                 });
            } catch (error) {
                console.error("OSM search failed:", error);
                return [];
            }
        }

        renderSuggestions() {
            if (this.currentSuggestions.length === 0) {
                this.hide();
                return;
            }
            this.container.innerHTML = '';
            this.currentSuggestions.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.dataset.index = index;
                const prefix = item.type === 'station' ? 'Station' : 'Map';
                const prefixColor = item.type === 'station' ? '#007bff' : '#28a745';

                // Use displayName for rendering
                let contentHtml = `<div class="suggestion-text">${item.displayName}</div>`;
                // Simplified rendering, adjust if you want main/secondary lines again
                 if (item.type === 'map') {
                     const formatted = formatOsmName({ name: item.name, address: { suburb: item.displayName.split(', ')[1] } }); // Reconstruct for formatting function if needed
                     contentHtml = `<div class="suggestion-text"><div class="suggestion-main">${formatted.main}</div>${formatted.secondary ? `<div class="suggestion-secondary">${formatted.secondary}</div>` : ''}</div>`;
                 }

                div.innerHTML = `<span class="suggestion-prefix" style="color: ${prefixColor};">[${prefix}]</span>${contentHtml}`;
                div.addEventListener('click', () => this.selectItem(index));
                this.container.appendChild(div);
            });
            this.currentSelection = -1;
            this.show();
        }

        onKeyDown(e) {
            if (!this.container.offsetParent) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.currentSelection = Math.min(this.currentSelection + 1, this.currentSuggestions.length - 1);
                this.updateSelectionHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.currentSelection = Math.max(this.currentSelection - 1, 0);
                this.updateSelectionHighlight();
            } else if (e.key === 'Enter' && this.currentSelection > -1) {
                e.preventDefault();
                this.selectItem(this.currentSelection);
            } else if (e.key === 'Escape') {
                this.hide();
            }
        }

        updateSelectionHighlight() {
            Array.from(this.container.children).forEach((el, i) => {
                el.style.backgroundColor = i === this.currentSelection ? '#f0f0f0' : '';
            });
        }

        // --- MODIFIED: selectItem ---
        selectItem(index) {
            const item = this.currentSuggestions[index];
            if (!item) return;
            // Set input value to the display name
            this.input.value = item.displayName;
            // Store coordinates in data attribute
            this.input.dataset.coordinates = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
            this.hide();
        }
        // --- END MODIFIED ---

        onDocumentClick(e) {
            if (!this.input.contains(e.target) && !this.container.contains(e.target)) this.hide();
        }
        show() { this.container.style.display = 'block'; }
        hide() { this.container.style.display = 'none'; }
    }

    // --- LIVE ARRIVAL HELPER FUNCTIONS ---
    function cleanStationName(name) {
        if (typeof name !== 'string') return '';
        return name.replace(/\s*\((Bus|Metro)\)$/i, '').trim().toLowerCase();
    }

    function getLineNumberFromName(lineName) {
        return lineNameToNumber[lineName] || null;
    }

    async function fetchMetroLineData(lineNumber) {
        if (lineDataCache.has(lineNumber)) {
            return lineDataCache.get(lineNumber);
        }
        try {
            const response = await fetch(`${lhosst}/viewmtr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: lineNumber })
            });
            if (!response.ok) throw new Error(`Failed to fetch line data for ${lineNumber}`);
            const data = await response.json();
            lineDataCache.set(lineNumber, data);
            return data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function fetchBusLineData(lineNumber) {
        if (busLineDataCache.has(lineNumber)) {
            return busLineDataCache.get(lineNumber);
        }
        try {
            const response = await fetch(`${lhosst}/viewbus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: lineNumber })
            });
            if (!response.ok) throw new Error(`Failed to fetch bus line data for ${lineNumber}`);
            const data = await response.json();
            busLineDataCache.set(lineNumber, data);
            return data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function fetchMetroArrivals(stationName) {
        try {
            const response = await fetch(`${lhosst}/metro_arrivals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: stationName })
            });
            if (!response.ok) throw new Error(`Failed to fetch arrivals for ${stationName}`);
            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function fetchBusArrivals(stationName) {
        try {
            const response = await fetch(`${lhosst}/bus_arrivals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: stationName })
            });
            if (!response.ok) throw new Error(`Failed to fetch bus arrivals for ${stationName}`);
            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // --- NEW: Helper function to generate unique IDs for segments ---
    function getSegmentIds(segment) {
        // --- FIX: Handle 'walk' segments which don't have a 'line' ---
        const linePart = (segment.type === 'walk') ? 'walk' : segment.line.replace(/\s+/g, '-');

        const stationPart = (segment.stations && segment.stations.length > 0)
            ? segment.stations[0].replace(/[^a-zA-Z0-9]/g, '')
            : 'no-station'; // Use a fallback for walk segments

        const uniqueIdBase = `${segment.type}-${linePart}-${stationPart}`;
        // --- END FIX ---

        return {
            titleId: `title-${uniqueIdBase}`,
            arrivalId: `arrival-${uniqueIdBase}`
        };
    }

    // --- NEW: Helper function to update a segment's UI ---
function updateSegmentUI(segment, status, data = {}) {
        const { arrivalId } = getSegmentIds(segment);
        const arrivalElement = document.getElementById(arrivalId);

        if (!arrivalElement) return; // Walk segments won't have an arrivalElement

        // Always stop animation before changing content
        stopArrivalAnimation(arrivalId);

        // Update Arrival Div
        switch (status) {
            case 'live':
                arrivalElement.style.display = 'flex'; // Make sure it's visible
                const minutes = data.waitMinutes;
                if (minutes > 60) {
                    const arrivalTime = getArrivalTime(data.fullMinutesUntil);
                    arrivalElement.innerHTML = `<span class="arrival-text" style="color: #000;">${arrivalTime}</span>`;
                } else {
                    let arrivalText = '';
                    if (minutes <= 0) arrivalText = 'Arriving now';
                    else if (minutes === 1) arrivalText = '1 min';
                    else arrivalText = `${Math.round(minutes)} mins`;

                    arrivalElement.innerHTML = `
                        <img src="/lt3.png" class="arrival-animation" alt="" />
                        <span class="arrival-text" style="color: #18a034;">${arrivalText}</span>
                    `;
                    const imgElement = arrivalElement.querySelector('.arrival-animation');
                    if (imgElement) startArrivalAnimation(arrivalId, imgElement);
                }
                break;
            case 'checking':
                arrivalElement.style.display = 'flex'; // Keep visible
                arrivalElement.innerHTML = `<span class="arrival-text" style="color: #5f6368;">(Checking...)</span>`;
                break;
            case 'missed': // Set for segments *after* a break
            case 'error':  // Set for the segment that *caused* the break
            default:
                // --- NEW: Hide the element ---
                arrivalElement.innerHTML = '';
                arrivalElement.style.display = 'none';
                break;
        }
    }

// --- MODIFIED: Master function to update all live route data ---
    async function updateLiveRouteData() {
        if (!currentRouteData) return;

        // --- NEW: Split time variables for correct calculation ---
        let travelTimeElapsed = 0;   // Tracks ONLY ride + walk time
        let newTotalJourneyMinutes = 0;  // Tracks total journey time including waits
        let liveChainBroken = false;

        const MAX_ACCEPTABLE_WAIT = 45; // 45 minutes

        for (const segment of currentRouteData.segments) {
            const segmentRideMinutes = Math.round(segment.duration / 60);

            if (segment.type === 'walk') {
                newTotalJourneyMinutes += segmentRideMinutes;
                travelTimeElapsed += segmentRideMinutes; // Add walk time to both
                continue;
            }

            const { titleId, arrivalId } = getSegmentIds(segment);
            const arrivalElement = document.getElementById(arrivalId);
            if (!arrivalElement) continue;

            stopArrivalAnimation(arrivalId);
            arrivalElement.style.display = 'flex';
            arrivalElement.innerHTML = `<span class="arrival-text" style="color: #5f6368;">(Checking...)</span>`;

            try {
                let arrivalsData, lineData, lineNumber, apiStationName;

                // 1. Fetch data
                if (segment.type === 'metro') {
                    lineNumber = getLineNumberFromName(segment.line);
                    if (!lineNumber) throw new Error('Unknown metro line');
                    apiStationName = cleanStationName(segment.stations[0]);

                    [lineData, arrivalsData] = await Promise.all([
                        fetchMetroLineData(lineNumber),
                        fetchMetroArrivals(apiStationName)
                    ]);
                } else { // 'bus'
                    lineNumber = segment.line;
                    apiStationName = cleanStationName(segment.stations[0]);

                    [lineData, arrivalsData] = await Promise.all([
                        fetchBusLineData(lineNumber),
                        fetchBusArrivals(apiStationName)
                    ]);
                }

                if (!arrivalsData || !arrivalsData.arrivals || arrivalsData.arrivals.length === 0) {
                    throw new Error('No arrivals data found');
                }

                // 2. Determine correct terminus
                let correctTerminus = null;
                let isRingRoute = false;

                if (segment.type === 'metro') {
                    const cleanStart = cleanStationName(segment.stations[0]);
                    const cleanSecond = cleanStationName(segment.stations[1]);
                    const fullLineStations = lineData.stations;
                    const startIndex = fullLineStations.findIndex(s => cleanStationName(s) === cleanStart);
                    const secondIndex = fullLineStations.findIndex(s => cleanStationName(s) === cleanSecond);
                    if (startIndex === -1 || secondIndex === -1) throw new Error('Station mismatch');
                    correctTerminus = (secondIndex > startIndex) ? fullLineStations[fullLineStations.length - 1] : fullLineStations[0];

                } else { // 'bus'
                    const ringArrival = arrivalsData.arrivals.find(arr => arr.line === lineNumber && arr.destination.endsWith(' Ring'));
                    if (ringArrival) {
                        correctTerminus = ringArrival.destination;
                        isRingRoute = true;
                    } else {
                        const lineDirections = Object.keys(lineData);
                        if (lineDirections.length === 0) throw new Error('No bus directions');
                        const cleanSegmentStations = segment.stations.map(cleanStationName);
                        for (const directionKey of lineDirections) {
                            const fullLineStations = lineData[directionKey].map(cleanStationName);
                            const firstStationIndex = fullLineStations.indexOf(cleanSegmentStations[0]);
                            if (firstStationIndex !== -1 && firstStationIndex + 1 < fullLineStations.length && fullLineStations[firstStationIndex + 1] === cleanSegmentStations[1]) {
                                correctTerminus = directionKey;
                                break;
                            }
                        }
                        if (!correctTerminus) throw new Error('Could not align bus segment');
                    }
                }

                // 3. Update Title Element Immediately
                const titleElement = document.getElementById(titleId);
                if (titleElement && correctTerminus && !isRingRoute) {
                    const cleanTerminus = cleanStationName(correctTerminus);
                    titleElement.textContent = `Take ${segment.type === 'metro' ? `the ${segment.line}` : `Bus Line ${segment.line}`} towards ${correctTerminus}`;
                }

                // 4. Conditional Live Logic
                if (liveChainBroken) {
                    // A previous segment failed.
                    updateSegmentUI(segment, 'missed');
                    newTotalJourneyMinutes += segmentRideMinutes; // Add static ride time
                    travelTimeElapsed += segmentRideMinutes;    // Add static ride time
                } else {
                    // Chain is still valid. Find the *next valid arrival*
                    const validArrival = arrivalsData.arrivals.find(arr =>
                        arr.line === lineNumber &&
                        cleanStationName(arr.destination) === cleanStationName(correctTerminus) &&
                        arr.minutes_until >= travelTimeElapsed // <-- CHECK AGAINST TRAVEL TIME
                    );

                    if (validArrival) {
                        // We found a *potential* arrival
                        const waitMinutes = validArrival.minutes_until - travelTimeElapsed; // <-- This is the *real* wait

                        if (waitMinutes > MAX_ACCEPTABLE_WAIT) {
                            // The wait is too long, treat it as a missed connection
                            console.warn(`Next arrival for ${segment.type} ${segment.line} is in ${waitMinutes} mins (arrival in ${validArrival.minutes_until} vs travel time ${travelTimeElapsed}), which is > ${MAX_ACCEPTABLE_WAIT} min threshold. Breaking chain.`);
                            liveChainBroken = true;
                            updateSegmentUI(segment, 'missed');
                            newTotalJourneyMinutes += segmentRideMinutes; // Add static ride time
                            travelTimeElapsed += segmentRideMinutes;
                        } else {
                            // The wait is acceptable.
                            newTotalJourneyMinutes += waitMinutes + segmentRideMinutes; // Add wait + ride
                            travelTimeElapsed += segmentRideMinutes; // Add *only* ride

                            updateSegmentUI(segment, 'live', {
                                waitMinutes: waitMinutes,
                                fullMinutesUntil: validArrival.minutes_until
                            });
                        }
                    } else {
                        // We missed the last one. Break the chain.
                        console.warn(`Missed last connection for ${segment.type} ${segment.line} (travel time ${travelTimeElapsed} was greater than last arrival)`);
                        liveChainBroken = true;
                        updateSegmentUI(segment, 'missed');
                        newTotalJourneyMinutes += segmentRideMinutes;
                        travelTimeElapsed += segmentRideMinutes;
                    }
                }

            } catch (error) {
                // This catch block handles failures in fetching data or determining terminus
                console.error('Failed to update live segment:', error);
                liveChainBroken = true;
                updateSegmentUI(segment, 'error');
                newTotalJourneyMinutes += segmentRideMinutes;
                travelTimeElapsed += segmentRideMinutes; // <-- Add ride time even on error
            }
        }

        // 5. Update the total time
        const totalTimeElement = document.getElementById('route-total-time-span');
        if (totalTimeElement) {
            totalTimeElement.textContent = `${Math.round(newTotalJourneyMinutes)} min`;
        }
    }


async function initializeAutocomplete() {
        try {
            const response = await fetch(`${lhosst}/api/stations`);
            if (!response.ok) throw new Error(`Failed to fetch stations: ${response.status}`);
            const stations = await response.json(); // Fetch into a local variable first
            allStations = stations; // Assign to the global variable
            // Initialize autocomplete widgets *after* data is fetched
            new CustomAutocomplete(startInput, allStations);
            new CustomAutocomplete(endInput, allStations);
            return stations; // Return the fetched data
        } catch (error) {
            console.error("Could not initialize autocomplete:", error);
            allStations = []; // Ensure it's an empty array on error
            // Initialize with empty lists if fetch failed
            new CustomAutocomplete(startInput, []);
            new CustomAutocomplete(endInput, []);
            return []; // Return empty array on error
        }
    }

    // --- COORDINATE PARSING ---
    function parseCoordinates(input) {
        const coordRegex = /^\s*(-?\d{1,3}(\.\d+)?)\s*,\s*(-?\d{1,3}(\.\d+)?)\s*$/;
        const match = input.match(coordRegex);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[3]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
        }
        return null;
    }

    function handleBackNavigation() {
        // If there's a previous view, go to it. Otherwise, go to main panel.
        const viewToGoBackTo = previousView || panelMainView;
        showView(viewToGoBackTo);
        // Reset previousView state
        previousView = null;
        // Potentially clear markers or fit map bounds if needed
        if (viewToGoBackTo === panelMainView) {
            stationMarkersLayer.clearLayers();
            map.addLayer(activeRouteLayers);
        }
    }

    // --- MODIFIED: ROUTE HANDLING ---
    async function handleFormSubmit(event) {
        event.preventDefault();

        // --- NEW: Logic to get coordinates or name ---
        const getSendValue = (inputElement) => {
            const value = inputElement.value.trim();
            const storedCoords = inputElement.dataset.coordinates;

            // Priority 1: Check if the current value is valid coordinates
            const parsedValue = parseCoordinates(value);
            if (parsedValue) {
                return parsedValue; // It's coordinates
            }

            // Priority 2: Check if there are stored coordinates from autocomplete
            if (storedCoords) {
                const parsedStored = parseCoordinates(storedCoords);
                if (parsedStored) {
                    return parsedStored; // Use stored coordinates
                }
            }

            // Priority 3: Fallback to sending the raw text value
            return value;
        };

        const startSendValue = getSendValue(startInput);
        const endSendValue = getSendValue(endInput);

        await fetchAndDisplayRoute(startSendValue, endSendValue); // Pass potentially mixed values
    }

    // --- MODIFIED: fetchAndDisplayRoute to handle mixed input types ---
    async function fetchAndDisplayRoute(startValue, endValue) {
        const detailsContainer = document.getElementById('route-details');
        const findRouteBtn = document.querySelector('#route-form button[type="submit"]');
        const useMyLocationBtn = document.getElementById('use-my-location');

        findRouteBtn.style.display = 'none';
        useMyLocationBtn.style.display = 'none';
        detailsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Searching for the best route...</p></div>`;

        // Stop previous timers
        if (liveRouteUpdater) { clearInterval(liveRouteUpdater); liveRouteUpdater = null; }
        arrivalAnimationTimers.forEach(timer => clearInterval(timer));
        arrivalAnimationTimers.clear();
        currentRouteData = null;

        // --- NEW: Determine endpoint based on value types ---
        let endpoint = '';
        let body = {};
        const startIsCoords = typeof startValue === 'object' && startValue.lat !== undefined;
        const endIsCoords = typeof endValue === 'object' && endValue.lat !== undefined;

        if (!startValue || !endValue) { // Check if either input is empty string or null
             detailsContainer.innerHTML = '<p style="color: orange;">Please enter both a start and end location.</p>';
        } else if (startIsCoords && endIsCoords) {
            endpoint = `${lhosst}/route_from_coords`;
            body = { start_lat: startValue.lat, start_lng: startValue.lng, end_lat: endValue.lat, end_lng: endValue.lng };
        } else if (!startIsCoords && !endIsCoords) {
            endpoint = `/route`;
            body = { start: startValue, end: endValue }; // Send names
        } else {
            // Mixed input types (one is coords, one is name) - currently not supported by backend
            detailsContainer.innerHTML = '<p style="color: red;">Error: Mixed location types (name and coordinates) are not supported. Please use either two names/places or two sets of coordinates.</p>';
        }
        // --- END NEW ---

        // Only proceed if an endpoint was determined
        if (endpoint) {
            try {
                const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const data = await response.json();
                if (!response.ok || data.error) throw new Error(data.error || `An unknown error occurred (Status: ${response.status}).`);

                displayRoute(data);

            } catch (error) {
                console.error("Failed to fetch route:", error);
                detailsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
                // Clear route data on error
                currentRouteData = null;
                if (liveRouteUpdater) { clearInterval(liveRouteUpdater); liveRouteUpdater = null; }
            }
        }

        // Always show buttons again unless still loading (though loading message is replaced on error/success)
         findRouteBtn.style.display = 'block';
         useMyLocationBtn.style.display = 'block';
    }

    // --- HEAVILY MODIFIED: This function now just builds the UI skeleton ---
    function displayRoute(data) {
        activeRouteLayers.clearLayers();
        const detailsContainer = document.getElementById('route-details');
        detailsContainer.innerHTML = '';

        if (data.error || !data.routes || data.routes.length === 0) {
            detailsContainer.innerHTML = `<p>${data.error || 'No routes found.'}</p>`;
            return;
        }

        currentRouteData = data.routes[0]; // --- NEW: Store route data globally
        const route = currentRouteData;
        const allCoords = [];

        // --- MODIFIED: Add ID to the total time span ---
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'route-summary';
        summaryDiv.innerHTML = `<p><span id="route-total-time-span">${Math.round(route.total_time / 60)} min</span></p><span>Total journey time.</span>`;
        detailsContainer.appendChild(summaryDiv);

        // --- MODIFIED: This loop just builds the static HTML skeleton ---
        route.segments.forEach((segment) => {
            let style = {};
            if (segment.type === 'metro') {
                const color = lineColors.metro[segment.line] || lineColors.default;
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold;">${segment.line}</span>` };
            } else if (segment.type === 'bus') {
                const color = lineColors.bus;
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold;">${segment.line}</span>` };
            } else if (segment.type === 'walk') {
                const color = lineColors.walk;
                style = { color, icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>` };
            }
            const latLngs = segment.coordinates.map(c => [c.lat, c.lng]);
            allCoords.push(...latLngs);
            L.polyline(latLngs, { color: style.color, weight: 6, opacity: 0.8, ...style.lineStyle }).addTo(activeRouteLayers);

            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'instruction';
            const durationMins = Math.round(segment.duration / 60);
            let instructionTitle = '', instructionDetails = '', endPointName = '';

            const { titleId, arrivalId } = getSegmentIds(segment);
            let arrivalHtml = '';

            if (segment.type === 'walk') {
                endPointName = segment.to || "your destination";
                instructionTitle = `Walk to ${endPointName}`;
                instructionDetails = `${durationMins} min (${Math.round(segment.distance || 0)} m)`;
            } else {
                if (segment.type === "metro") {
                    instructionTitle = `Take the ${segment.line}`;
                }
                else {
                    instructionTitle = `Take ${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)} Line ${segment.line}`;
                }
                endPointName = segment.stations && segment.stations.length > 0 ? segment.stations[segment.stations.length - 1] : "next stop";
                const stopsText = segment.stations && segment.stations.length > 1 ? `&bull; ${segment.stations.length - 1} stops` : '';
                instructionDetails = `${durationMins} min ${stopsText}`;

                // Add the placeholder div for live data
                arrivalHtml = `<div class="instruction-arrival" id="${arrivalId}"></div>`;
            }

            instructionDiv.innerHTML = `
                <div class="instruction-icon">${style.icon}</div>
                <div class="instruction-details">
                    <h3 id="${titleId}">${instructionTitle}</h3>
                    <p>${instructionDetails}</p>
                    ${segment.type !== 'walk' ? `<small>Disembark at ${endPointName}</small>` : ''}
                </div>
                ${arrivalHtml}`;

            detailsContainer.appendChild(instructionDiv);
        });

        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });

        // --- NEW: Start the update loop ---
        updateLiveRouteData(); // Run once immediately
        liveRouteUpdater = setInterval(updateLiveRouteData, 60000); // Run every minute
    }

    // --- ALERTS MENU LOGIC ---
    const alertsBtn = document.getElementById('alerts-btn');
    const alertsOverlay = document.getElementById('alerts-overlay');
    const alertsCloseBtn = document.getElementById('alerts-close-btn');
    const alertsContent = document.getElementById('alerts-content');
    const notificationDot = document.getElementById('alerts-notification-dot');

    alertsBtn.addEventListener('click', () => {
        alertsOverlay.classList.add('visible');
        notificationDot.classList.add('hidden'); // Hide dot when panel is opened
    });
    alertsCloseBtn.addEventListener('click', () => alertsOverlay.classList.remove('visible'));
    alertsOverlay.addEventListener('click', (e) => { if (e.target === alertsOverlay) alertsOverlay.classList.remove('visible'); });

    async function fetchAndRenderAlerts() {
        try {
            // Fetch documents sorted by creation date, newest first, limit 10
            const response = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_ALERTS_COLLECTION_ID,
                [Query.orderDesc('$createdAt'), Query.limit(10)]
            );
            const alerts = response.documents;

            alertsContent.innerHTML = ''; // Clear previous content

            if (alerts.length === 0) {
                alertsContent.innerHTML = '<p>No active alerts.</p>';
                notificationDot.classList.add('hidden'); // Ensure dot is hidden if no alerts
                return;
            }

            // --- Notification Dot Logic ---
            const latestAlertId = alerts[0].$id;
            const lastSeenAlertId = localStorage.getItem('lastSeenAlertId');

            if (latestAlertId !== lastSeenAlertId) {
                notificationDot.classList.remove('hidden');
            }

            alertsBtn.addEventListener('click', () => {
                alertsOverlay.classList.add('visible');
                notificationDot.classList.add('hidden'); // Hide dot when panel is opened
                localStorage.setItem('lastSeenAlertId', latestAlertId); // Mark latest alert as "seen"
            });
            // --- End Notification Dot Logic ---


            alerts.forEach(alert => {
                const alertItem = document.createElement('div');
                alertItem.className = 'alert-item';

                const alertDate = new Date(alert.$createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                });

                alertItem.innerHTML = `
                    <h4>${alert.title}</h4>
                    <p>${alert.message.replace(/\n/g, '<br>')}</p>
                    <small>${alertDate}</small>
                `;
                alertsContent.appendChild(alertItem);
            });

        } catch (error) {
            console.error("Failed to fetch alerts:", error);
            alertsContent.innerHTML = '<p style="color: red;">Could not load alerts.</p>';
        }
    }


    // --- SETTINGS MENU LOGIC ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    settingsBtn.addEventListener('click', () => settingsOverlay.classList.add('visible'));
    settingsCloseBtn.addEventListener('click', () => settingsOverlay.classList.remove('visible'));
    settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('visible'); });

    // --- Redirection Logic ---
    document.getElementById('language-select').addEventListener('change', (e) => {
        if (e.target.value === 'ar') window.location.href = '/ar/';
        else if (window.location.pathname.startsWith('/ar/')) window.location.href = '/';
    });
    document.getElementById('layout-select').addEventListener('change', (e) => {
        const path = window.location.pathname;
        if (e.target.value === 'desktop' && (path.endsWith('/mobile.html') || path.endsWith('/legacy.html'))) window.location.href = '/index.html';
        else if (e.target.value === 'mobile') window.location.href = '/mobile.html';
        else if (e.target.value === 'legacy') window.location.href = '/legacy.html';
    });

    // --- MAP CLICK HANDLER ---
    map.on('click', function(e) {
        // --- NEW: Stop route updater on map click ---
        if (liveRouteUpdater) {
            clearInterval(liveRouteUpdater);
            liveRouteUpdater = null;
        }
        const coordString = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `<div style="text-align: center;"><strong>Set Location</strong><br><small>${coordString}</small><div style="margin-top: 8px;"><button id="popup-set-origin" class="popup-button">Set as Origin</button><button id="popup-set-destination" class="popup-button" style="margin-left: 5px;">Set as Destination</button><button id="popup-set-stations" class="popup-button" style="margin-top: 5px; width: 100%;">Find Nearby Stations</button></div></div>`;
        L.DomEvent.on(popupContent.querySelector('#popup-set-origin'), 'click', () => { startInput.value = coordString; map.closePopup(); });
        L.DomEvent.on(popupContent.querySelector('#popup-set-destination'), 'click', () => { endInput.value = coordString; map.closePopup(); });
        L.DomEvent.on(popupContent.querySelector('#popup-set-stations'), 'click', () => {
            currentStationsLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
            switchTab(stationsTab, routeTab, stationsContent, routeContent);
            fetchNearbyStations();
            map.closePopup();
        });
        L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
    });

    // --- INITIAL PAGE LOAD ---
    routeForm.addEventListener('submit', handleFormSubmit);
    await initializeAutocomplete(); // Wait for stations to load
    setLocationFromGPS();         // Now it's safe to potentially trigger fetchNearbyStations
    map.removeLayer(stationMarkersLayer);
    fetchAndRenderAlerts();

    // --- REALTIME ALERTS ---
    client.subscribe(`databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_ALERTS_COLLECTION_ID}.documents`, response => {
        console.log("Realtime event received:", response);
        // A document was created, updated, or deleted. Just refetch all.
        fetchAndRenderAlerts();
    });
};
