// --- CONFIGURATION ---
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'; // Or your self-hosted endpoint
const APPWRITE_PROJECT_ID = '68f141dd000f83849c21'; // Replace with your Project ID
const APPWRITE_DATABASE_ID = '68f146de0013ba3e183a'; // Replace with your Database ID
const APPWRITE_ALERTS_COLLECTION_ID = 'emptt'; // Replace with your Collection ID

window.onload = async () => {
    // --- APPWRITE INITIALIZATION ---
    const { Client, Databases, ID, Query } = Appwrite;
    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);
    const databases = new Databases(client);

    // --- MAP INITIALIZATION ---
    const map = L.map('map', { zoomControl: false }).setView([24.7136, 46.6753], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }).addTo(map);

    // --- GLOBAL VARIABLES ---
    const routeForm = document.getElementById('route-form');
    const startInput = document.getElementById('start-input');
    const endInput = document.getElementById('end-input');
    let activeRouteLayers = new L.FeatureGroup().addTo(map);
    let stationMarkersLayer = new L.FeatureGroup();
    let allLinesData = null; // NEW
    let allStations = [];
    let currentStationsLatLng = null;
    let stationsDataCache = null;
    let previousView = null; // NEW

    // --- PANEL & VIEW ELEMENTS ---
    const panel = document.getElementById('panel');
    const panelHandle = document.getElementById('panel-handle');
    const panelContent = document.getElementById('panel-content');
    const panelMainView = document.getElementById('panel-main-view');
    const stationDetailView = document.getElementById('station-detail-view');
    const stationDetailBackButton = document.getElementById('station-detail-back-btn');
    const lineDetailView = document.getElementById('line-detail-view'); // NEW
    const lineDetailBackButton = document.getElementById('line-detail-back-btn'); // NEW

    // --- BOTTOM SHEET & OVERLAYS ---
    const locationOverlay = document.getElementById('location-overlay');
    const directionOverlay = document.getElementById('direction-overlay'); // NEW
    let currentState = 'collapsed';
    let startY, startHeight;
    const topMargin = 40;

    function getPanelHeights() {
        const formContainer = document.querySelector('.form-container');
        const tabNav = document.querySelector('.tab-nav');
        const collapsedHeight = panelHandle.offsetHeight + (formContainer && formContainer.style.display !== 'none' ? formContainer.offsetHeight : 0) + (tabNav ? tabNav.offsetHeight : 50) + 40;
        const expandedHeight = window.innerHeight - topMargin;
        return { collapsedHeight, expandedHeight };
    }

    function initializePanel() {
        const { collapsedHeight, expandedHeight } = getPanelHeights();
        panelContent.style.height = `${expandedHeight - panelHandle.offsetHeight}px`;
        panel.style.transform = `translateY(${window.innerHeight - collapsedHeight}px)`;
    }

    function setPanelState(state, animate = true) {
        const { collapsedHeight, expandedHeight } = getPanelHeights();
        let targetY = state === 'expanded' ? topMargin : window.innerHeight - collapsedHeight;
        currentState = state;
        panel.style.transition = animate ? 'transform 0.4s ease-out' : 'none';
        panel.style.transform = `translateY(${targetY}px)`;
    }

    panelHandle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startHeight = panel.getBoundingClientRect().top;
        panel.style.transition = 'none';
    });

    panelHandle.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        let deltaY = currentY - startY;
        let newTop = startHeight + deltaY;
        if (newTop < topMargin) newTop = topMargin;
        panel.style.transform = `translateY(${newTop}px)`;
    });

    panelHandle.addEventListener('touchend', (e) => {
        const endY = e.changedTouches[0].clientY;
        const deltaY = endY - startY;
        if (Math.abs(deltaY) > 50) {
            setPanelState(deltaY < 0 ? 'expanded' : 'collapsed');
        } else {
            const currentPos = panel.getBoundingClientRect().top;
            const halfway = (window.innerHeight - topMargin) / 2;
            setPanelState(currentPos < halfway ? 'expanded' : 'collapsed');
        }
    });

    panelHandle.addEventListener('click', (e) => {
        if (e.detail > 0) setPanelState(currentState === 'collapsed' ? 'expanded' : 'collapsed');
    });

    // --- TAB FUNCTIONALITY ---
    const routeTab = document.getElementById('route-tab');
    const stationsTab = document.getElementById('stations-tab');
    const linesTab = document.getElementById('lines-tab');
    const routeContent = document.getElementById('route-content');
    const stationsContent = document.getElementById('stations-content');
    const linesContent = document.getElementById('lines-content');

    function switchTab(activeTab) {
        [routeTab, stationsTab, linesTab].forEach(tab => tab.classList.remove('active'));
        [routeContent, stationsContent, linesContent].forEach(pane => pane.classList.remove('active'));
        activeTab.classList.add('active');
        document.getElementById(activeTab.id.replace('-tab', '-content')).classList.add('active');

        map.removeLayer(stationMarkersLayer);
        map.removeLayer(activeRouteLayers);

        if (activeTab === stationsTab) {
            map.addLayer(stationMarkersLayer);
            if (stationsDataCache === null) fetchNearbyStations();
        } else if (activeTab === routeTab) {
            map.addLayer(activeRouteLayers);
        } else if (activeTab === linesTab) {
            map.addLayer(stationMarkersLayer); // Reuse station layer for line stations
            if (allLinesData === null) fetchAllLines();
        }
    }
    routeTab.addEventListener('click', () => switchTab(routeTab));
    stationsTab.addEventListener('click', () => switchTab(stationsTab));
    linesTab.addEventListener('click', () => switchTab(linesTab));

        // --- VIEW MANAGEMENT ---
    function hideAllViews() {
        [panelMainView, stationDetailView, lineDetailView].forEach(v => v.classList.add('hidden'));
    }

    function showView(viewToShow) {
        hideAllViews();
        viewToShow.classList.remove('hidden');
        setPanelState('expanded');
    }

    function handleBackNavigation() {
        const viewToGoBackTo = previousView || panelMainView;
        showView(viewToGoBackTo);
        previousView = null;
        if (viewToGoBackTo === panelMainView) {
            stationMarkersLayer.clearLayers();
            map.addLayer(activeRouteLayers);
        }
    }

    stationDetailBackButton.addEventListener('click', handleBackNavigation);
    lineDetailBackButton.addEventListener('click', () => showView(panelMainView));

    // --- NEARBY STATIONS LOGIC ---
    async function fetchNearbyStations() {
        if (!currentStationsLatLng) {
            document.getElementById('stations-list').innerHTML = '<p>Use "My Location" or tap the map to find nearby stations.</p>';
            return;
        }
        document.getElementById('stations-list').innerHTML = `<div class="loader-container"><div class="loader"></div><p>Finding nearby stations...</p></div>`;
        try {
            const response = await fetch(`/nearbystations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentStationsLatLng)
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            stationsDataCache = await response.json();
            displayStations(stationsDataCache);
        } catch (error) {
            console.error("Failed to fetch nearby stations:", error);
            document.getElementById('stations-list').innerHTML = '<p style="color: red;">Error loading stations.</p>';
        }
    }

    // CORRECTED: The displayStations function with the right matching logic
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
            // CORRECTED: Match `station.name` from `/nearbystations` with `fullStation.label` from `/api/stations`
            const fullStation = allStations.find(s => s.label === station.name);
            if (!fullStation) {
                console.warn(`Could not find coordinates for station: ${station.name}`);
                return;
            }
            const { lat, lng } = fullStation;
            stationCoords.push([lat, lng]);
            const stationDiv = document.createElement('div');
            stationDiv.className = 'station-item';
            stationDiv.innerHTML = `<div class="station-icon">${station.type === 'bus' ? '🚌' : '🚇'}</div><div class="station-details"><h4>${station.name}</h4><p>${Math.round(station.distance)} m away</p><p>${Math.round(station.duration / 60)} min walk</p></div>`;
            const marker = L.marker([lat, lng]).addTo(stationMarkersLayer);
            marker.bindPopup(`<b>${station.name}</b>`);
            const handleStationClick = () => {
                document.querySelectorAll('.station-item').forEach(el => el.classList.remove('highlight'));
                stationDiv.classList.add('highlight');
                map.setView([lat, lng], 16);
                marker.openPopup();
                showStationDetails(station, panelMainView);
            };
            stationDiv.addEventListener('click', handleStationClick);
            marker.on('click', handleStationClick);
            stationsList.appendChild(stationDiv);
        });
        if (currentStationsLatLng) stationCoords.push([currentStationsLatLng.lat, currentStationsLatLng.lng]);
        if (stationCoords.length > 0) map.fitBounds(L.latLngBounds(stationCoords), { padding: [40, 40], paddingTop: 100 });
    }

    async function showStationDetails(station, fromView) {
        previousView = fromView;
        showView(stationDetailView);
        const stationDetailName = document.getElementById('station-detail-name');
        const stationDetailContent = document.getElementById('station-detail-content');
        stationDetailName.textContent = station.name;
        stationDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading lines...</p></div>`;
        const cleanedStationName = station.name.replace(/\s*\((Bus|Metro)\)$/, '').trim();
        try {
            const response = await fetch(`/searchstation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: cleanedStationName })
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            renderStationLines(data);
        } catch (error) {
            console.error("Failed to fetch station details:", error);
            stationDetailContent.innerHTML = '<p style="color: red;">Could not load station details.</p>';
        }
    }

    const lineColors = {
        metro: { '1': '#00aee6', '2': '#ef4938', '3': '#f68d39', '4': '#ffd10a', '5': '#37b23f', '6': '#984b9d' },
        bus: '#18a034', default: '#555'
    };

    function renderStationLines(data) {
        const content = document.getElementById('station-detail-content');
        content.innerHTML = '';
        let html = '';
        if (data.metro_lines && data.metro_lines.length > 0) {
            html += `<div class="line-list-container"><h4>🚇 Metro Lines</h4><div class="line-grid">`;
            html += data.metro_lines.map(line => `<div class="line-badge" style="background-color: ${lineColors.metro[line] || lineColors.default};">${line}</div>`).join('');
            html += `</div></div>`;
        }
        if (data.bus_lines && data.bus_lines.length > 0) {
            html += `<div class="line-list-container"><h4>🚌 Bus Lines</h4><div class="line-grid">`;
            html += data.bus_lines.map(line => `<div class="line-badge" style="background-color: ${lineColors.bus};">${line}</div>`).join('');
            html += `</div></div>`;
        }
        if (!html) html = '<p>No lines found for this station.</p>';
        content.innerHTML = html;
    }

    // --- NEW: ALL LINE LOGIC ---
    const lineSearchInput = document.getElementById('line-search-input');

    async function fetchAllLines() {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading all lines...</p></div>`;
        try {
            const [metroLinesRes, busLinesRes] = await Promise.all([
                fetch(`/mtrlines`), fetch(`/buslines`)
            ]);
            const metroLinesData = await metroLinesRes.json();
            const busLinesData = await busLinesRes.json();
            const metroPromises = metroLinesData.lines.split(',').map(line => fetch(`/viewmtr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line }) }).then(res => res.json()).then(data => ({ type: 'metro', line, data })));
            const busPromises = busLinesData.lines.split(',').map(line => fetch(`/viewbus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line }) }).then(res => res.json()).then(data => ({ type: 'bus', line, data })));
            const allLineDetails = await Promise.all([...metroPromises, ...busPromises]);
            allLinesData = allLineDetails.map(({ type, line, data }) => {
                let terminus = 'Unknown';
                if (type === 'metro' && data.stations && data.stations.length > 0) terminus = `${data.stations[0]} - ${data.stations[data.stations.length - 1]}`;
                else if (type === 'bus') {
                    const keys = Object.keys(data);
                    if (keys.length === 1) terminus = `${keys[0]} Ring`;
                    else if (keys.length > 1) terminus = `${keys[1]} - ${keys[0]}`;
                }
                return { type, line, terminus };
            }).sort((a, b) => {
                const aNum = parseInt(a.line.replace(/\D/g, ''), 10);
                const bNum = parseInt(b.line.replace(/\D/g, ''), 10);
                return (a.type === b.type) ? aNum - bNum : (a.type === 'metro' ? -1 : 1);
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
        if (!lines || lines.length === 0) { linesList.innerHTML = '<p>No lines found.</p>'; return; }
        lines.forEach(line => {
            const item = document.createElement('div');
            item.className = 'line-item';
            const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;
            item.innerHTML = `<div class="line-item-badge" style="background-color: ${color};">${line.line}</div><div class="line-item-details"><p class="terminus">${line.terminus}</p><p class="line-type">${line.line.startsWith('BRT') ? 'BRT Bus' : (line.type.charAt(0).toUpperCase() + line.type.slice(1))}</p></div>`;
            item.addEventListener('click', () => handleLineClick(line));
            linesList.appendChild(item);
        });
    }

    lineSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!allLinesData) return;
        const filteredLines = allLinesData.filter(line => line.line.toLowerCase().includes(query) || line.terminus.toLowerCase().includes(query));
        renderLinesList(filteredLines);
    });

    function handleLineClick(line) {
        if (line.terminus.includes(' - ')) {
            showDirectionSelection(line);
        } else {
            showLineDetails(line);
        }
    }

    function showDirectionSelection(line) {
        const directionPanel = document.getElementById('direction-panel');
        directionPanel.innerHTML = '<p>Select Direction</p>'; // Reset
        const [start, end] = line.terminus.split(' - ');
        const forwardKey = line.type === 'bus' ? end : start;
        const backwardKey = line.type === 'bus' ? start : end;

        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'bottom-panel-button';
        forwardBtn.textContent = `${start} → ${end}`;
        forwardBtn.onclick = () => {
            directionOverlay.classList.remove('visible');
            showLineDetails(line, forwardKey);
        };

        const backwardBtn = document.createElement('button');
        backwardBtn.className = 'bottom-panel-button';
        backwardBtn.textContent = `${end} → ${start}`;
        backwardBtn.onclick = () => {
            directionOverlay.classList.remove('visible');
            showLineDetails(line, backwardKey);
        };

        // FIXED: Create the cancel button dynamically instead of cloning it.
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bottom-panel-button cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => directionOverlay.classList.remove('visible');

        directionPanel.appendChild(forwardBtn);
        directionPanel.appendChild(backwardBtn);
        directionPanel.appendChild(cancelBtn);
        directionOverlay.classList.add('visible');
    }

    async function showLineDetails(line, directionKey = null) {
        showView(lineDetailView);
        const lineDetailName = document.getElementById('line-detail-name');
        lineDetailName.innerHTML = ''; // Clear previous
        const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;
        lineDetailName.innerHTML = `<div class="line-detail-badge" style="background-color: ${color};">${line.line}</div><h4 class="line-detail-terminus">${line.terminus}</h4>`;

        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading stations...</p></div>`;

        try {
            const endpoint = line.type === 'metro' ? '/viewmtr' : '/viewbus';
            const response = await fetch(`${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line: line.line }) });
            if (!response.ok) throw new Error('Failed to fetch line data');
            const data = await response.json();
            let stationNames;
            if (line.type === 'metro') {
                stationNames = data.stations;
                if (directionKey && stationNames[0] !== directionKey) stationNames.reverse();
            } else {
                stationNames = data[directionKey || Object.keys(data)[0]];
            }
            renderLineStations(stationNames, line);
        } catch (error) {
            lineDetailContent.innerHTML = '<p style="color: red;">Could not load line details.</p>';
        }
    }

    function renderLineStations(stationNames, line) {
        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = '';
        stationMarkersLayer.clearLayers();
        if (!stationNames || stationNames.length === 0) { lineDetailContent.innerHTML = '<p>No stations found.</p>'; return; }

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
                allCoords.push([lat, lng]);
                const circleMarker = L.circleMarker([lat, lng], { radius: 6, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 1 }).addTo(stationMarkersLayer);
                circleMarker.bindPopup(`<b>${station.label}</b>`);
                stationItem.addEventListener('click', () => {
                    map.setView([lat, lng], 16);
                    circleMarker.openPopup();
                    showStationDetails({ name: station.label, type: station.type }, lineDetailView);
                });
            }
        });
        lineDetailContent.appendChild(stationList);
        if (allCoords.length > 1) L.polyline(allCoords, { color, weight: 5, opacity: 0.8 }).addTo(stationMarkersLayer);
        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], paddingTop: 100 });
    }

    function hideStationDetails() {
        stationDetailView.classList.add('hidden');
        panelMainView.classList.remove('hidden');
        setPanelState('expanded');
    }
    stationDetailBackButton.addEventListener('click', hideStationDetails);

    // --- AUTOCOMPLETE ---
    function formatOsmName(item) {
        const address = item.address || {};
        let mainName = item.name || address.road || address.amenity || address.shop || address.building || address.tourism || address.historic;
        if (!mainName) mainName = item.display_name.split(',')[0];
        const secondaryName = address.suburb || address.neighbourhood || address.quarter || '';
        return { main: mainName, secondary: secondaryName };
    }

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
            document.addEventListener('click', (e) => {
                if (!this.input.contains(e.target) && !this.container.contains(e.target)) this.hide();
            });
        }
        onInput() {
            clearTimeout(this.debounceTimeout);
            const query = this.input.value.trim();
            if (query.length < 3) { this.hide(); return; }
            this.debounceTimeout = setTimeout(() => this.fetchSuggestions(query), 250);
        }
        async fetchSuggestions(query) {
            const thisRequest = ++this.latestRequest;
            const stationPromise = this.getStationSuggestions(query);
            const osmPromise = this.getOSMSuggestions(query);
            const [stationResults, osmResults] = await Promise.all([stationPromise, osmPromise]);
            if (thisRequest !== this.latestRequest) return;
            this.renderSuggestions([...stationResults, ...osmResults]);
        }
        getStationSuggestions(query) {
            const lowerCaseQuery = query.toLowerCase();
            return this.stationList
                .filter(station => station.label.toLowerCase().includes(lowerCaseQuery))
                .slice(0, 3)
                .map(s => ({ type: 'station', name: s.label, lat: s.lat, lng: s.lng }));
        }
        async getOSMSuggestions(query) {
            try {
                const params = new URLSearchParams({ q: `${query}, Riyadh`, format: 'json', addressdetails: 1, limit: 4, viewbox: '46.2,25.2,47.2,24.2', bounded: 1 });
                const response = await fetch(`${OSM_NOMINATIM_URL}?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return data.map(item => ({ type: 'map', name: formatOsmName(item), lat: parseFloat(item.lat), lng: parseFloat(item.lon) }));
            } catch (error) { console.error("OSM search failed:", error); return []; }
        }
        renderSuggestions(suggestions) {
            this.container.innerHTML = '';
            if (suggestions.length === 0) { this.hide(); return; }
            suggestions.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                const prefix = document.createElement('span');
                prefix.className = 'suggestion-prefix';
                prefix.textContent = item.type === 'station' ? '[Station]' : '[Map]';
                prefix.style.color = item.type === 'station' ? '#007bff' : '#28a745';
                div.appendChild(prefix);
                const textContainer = document.createElement('div');
                textContainer.className = 'suggestion-text';
                if (item.type === 'map') {
                    const mainText = document.createElement('div');
                    mainText.className = 'suggestion-main';
                    mainText.textContent = item.name.main;
                    textContainer.appendChild(mainText);
                    if (item.name.secondary) {
                        const secondaryText = document.createElement('div');
                        secondaryText.className = 'suggestion-secondary';
                        secondaryText.textContent = item.name.secondary;
                        textContainer.appendChild(secondaryText);
                    }
                } else {
                    textContainer.textContent = item.name;
                }
                div.appendChild(textContainer);
                div.addEventListener('click', () => {
                    this.input.value = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
                    this.hide();
                });
                this.container.appendChild(div);
            });
            this.show();
        }
        show() { this.container.style.display = 'block'; }
        hide() { this.container.style.display = 'none'; }
    }

    async function initializeAutocomplete() {
        try {
            const response = await fetch(`/api/stations`);
            if (!response.ok) throw new Error(`Failed to fetch stations: ${response.status}`);
            allStations = await response.json();
        } catch (error) { console.error("Could not initialize autocomplete:", error); }
        new CustomAutocomplete(startInput, allStations);
        new CustomAutocomplete(endInput, allStations);
    }

    // --- ROUTE HANDLING ---
    function parseCoordinates(input) {
        const match = input.match(/^\s*(-?\d{1,3}(\.\d+)?)\s*,\s*(-?\d{1,3}(\.\d+)?)\s*$/);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[3]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
        }
        return null;
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        switchTab(routeTab);
        hideStationDetails();
        document.querySelector('.form-container').style.display = 'none';
        document.getElementById('route-details').style.display = 'block';
        setPanelState('expanded');
        await fetchAndDisplayRoute(startInput.value, endInput.value);
    }

    async function fetchAndDisplayRoute(start, end) {
        const detailsContainer = document.getElementById('route-details');
        detailsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Searching for the best route...</p></div>`;
        if (!start || !end) {
            detailsContainer.innerHTML = '<p style="color: orange;">Please enter both start and end locations.</p>';
            document.querySelector('.form-container').style.display = 'block';
            return;
        }
        const startCoords = parseCoordinates(start);
        const endCoords = parseCoordinates(end);
        let endpoint = '', body = {};
        if (startCoords && endCoords) {
            endpoint = `/route_from_coords`;
            body = { start_lat: startCoords.lat, start_lng: startCoords.lng, end_lat: endCoords.lat, end_lng: endCoords.lng };
        } else if (!startCoords && !endCoords) {
            endpoint = `/route`;
            body = { start, end };
        } else {
            detailsContainer.innerHTML = '<p style="color: red;">Error: Mixed inputs are not supported.</p>';
            document.querySelector('.form-container').style.display = 'block';
            return;
        }
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || `An unknown error occurred`);
            displayRoute(data);
        } catch (error) {
            console.error("Failed to fetch route:", error);
            detailsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    function displayRoute(data) {
        const detailsContainer = document.getElementById('route-details');
        activeRouteLayers.clearLayers();
        detailsContainer.innerHTML = '';
        if (data.error || !data.routes || !data.routes.length) {
            detailsContainer.innerHTML = `<p>${data.error || 'No routes found.'}</p>`;
            document.querySelector('.form-container').style.display = 'block';
            return;
        }
        const newRouteButton = document.createElement('button');
        newRouteButton.className = 'new-route-button secondary-button';
        newRouteButton.textContent = 'Search for a new route';
        newRouteButton.addEventListener('click', () => {
            document.querySelector('.form-container').style.display = 'block';
            detailsContainer.style.display = 'none';
            detailsContainer.innerHTML = '';
            activeRouteLayers.clearLayers();
            setPanelState('collapsed');
        });

        detailsContainer.appendChild(newRouteButton);
        const route = data.routes[0];
        const allCoords = [];
        let html = `<div class="route-summary"><p>${Math.round(route.total_time / 60)} min</p><span>Total journey time.</span></div>`;
        // Create a separate div for the route segments to be appended
        const segmentsContainer = document.createElement('div');
        segmentsContainer.innerHTML = `<div class="route-summary"><p>${Math.round(route.total_time / 60)} min</p><span>Total journey time.</span></div>`;

        route.segments.forEach(segment => {
            // ... (rest of the route rendering is unchanged)
            const color = (segment.type === 'metro' ? lineColors.metro[segment.line] : (segment.type === 'bus' ? lineColors.bus : '#6c757d')) || '#555';
            // FIXED: Logic to display metro icon instead of text for metro lines
            let icon;
            if (segment.type === 'metro') {
                icon = `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px;">🚇</span>`;
            } else if (segment.type === 'walk') {
                icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>`;
            } else { // Bus
                icon = `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px;">${segment.line}</span>`;
            }
            const latLngs = segment.coordinates.map(c => [c.lat, c.lng]);
            allCoords.push(...latLngs);
            L.polyline(latLngs, { color, weight: 6, opacity: 0.8, dashArray: segment.type === 'walk' ? '5, 10' : '' }).addTo(activeRouteLayers);
            const durationMins = Math.round(segment.duration / 60);
            let title = segment.type === 'walk' ? `Walk to ${segment.to || "your destination"}` : `Take ${segment.type} Line ${segment.line}`;
            let details = segment.type === 'walk' ? `${durationMins} min (${Math.round(segment.distance || 0)} m)` : `${durationMins} min ${segment.stations && segment.stations.length > 1 ? `&bull; ${segment.stations.length - 1} stops` : ''}`;
            const endPoint = segment.type !== 'walk' ? `<p>Disembark at ${segment.stations && segment.stations.length > 0 ? segment.stations[segment.stations.length - 1] : "next stop"}</p>` : '';
            segmentsContainer.innerHTML += `<div class="instruction"><div class="instruction-icon">${icon}</div><div class="instruction-details"><h3>${title}</h3><p>${details}</p>${endPoint}</div></div>`;
        });
        detailsContainer.appendChild(segmentsContainer);
        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], paddingTop: 100 });
    }

    // --- MAP CLICK & LOCATION OVERLAY ---
    const setOriginBtn = document.getElementById('overlay-set-origin');
    const setDestinationBtn = document.getElementById('overlay-set-destination');
    const setStationsBtn = document.getElementById('overlay-set-stations');
    const cancelBtn = document.getElementById('overlay-cancel');
    let clickedCoords = null;
    map.on('click', function(e) {
        clickedCoords = e.latlng;
        locationOverlay.classList.add('visible');
    });
    function hideLocationOverlay() {
        locationOverlay.classList.remove('visible');
        clickedCoords = null;
    }
    setOriginBtn.addEventListener('click', () => { if (clickedCoords) startInput.value = `${clickedCoords.lat.toFixed(5)}, ${clickedCoords.lng.toFixed(5)}`; hideLocationOverlay(); });
    setDestinationBtn.addEventListener('click', () => { if (clickedCoords) endInput.value = `${clickedCoords.lat.toFixed(5)}, ${clickedCoords.lng.toFixed(5)}`; hideLocationOverlay(); });
    setStationsBtn.addEventListener('click', () => {
        if (clickedCoords) {
            currentStationsLatLng = { lat: clickedCoords.lat, lng: clickedCoords.lng };
            switchTab(stationsTab);
            fetchNearbyStations();
            setPanelState('expanded');
        }
        hideLocationOverlay();
    });
    cancelBtn.addEventListener('click', hideLocationOverlay);
    locationOverlay.addEventListener('click', (e) => { if (e.target === locationOverlay) hideLocationOverlay(); });

    // --- GEOLOCATION BUTTON ---
    const useMyLocationBtn = document.getElementById('use-my-location');
    useMyLocationBtn.addEventListener('click', () => {
        startInput.placeholder = "Finding your location...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentStationsLatLng = { lat: latitude, lng: longitude };
                startInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                startInput.placeholder = "Enter starting point";
                map.setView([latitude, longitude], 13);
                if (stationsTab.classList.contains('active')) {
                    fetchNearbyStations();
                }
            },
            () => { startInput.placeholder = "Could not get your location"; }
        );
    });

    // --- ALERTS LOGIC ---
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
            const response = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_ALERTS_COLLECTION_ID,
                [Query.orderDesc('$createdAt'), Query.limit(10)]
            );
            const alerts = response.documents;

            alertsContent.innerHTML = ''; // Clear previous content

            if (alerts.length === 0) {
                alertsContent.innerHTML = '<p>No active alerts.</p>';
                notificationDot.classList.add('hidden');
                return;
            }

            const latestAlertId = alerts[0].$id;
            const lastSeenAlertId = localStorage.getItem('lastSeenAlertId');

            if (latestAlertId !== lastSeenAlertId) {
                notificationDot.classList.remove('hidden');
            }

            alertsBtn.addEventListener('click', () => {
                alertsOverlay.classList.add('visible');
                notificationDot.classList.add('hidden');
                localStorage.setItem('lastSeenAlertId', latestAlertId);
            });

            alerts.forEach(alert => {
                const alertItem = document.createElement('div');
                alertItem.className = 'alert-item';
                const alertDate = new Date(alert.$createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                alertItem.innerHTML = `<h4>${alert.title}</h4><p>${alert.message.replace(/\n/g, '<br>')}</p><small>${alertDate}</small>`;
                alertsContent.appendChild(alertItem);
            });

        } catch (error) {
            console.error("Failed to fetch alerts:", error);
            alertsContent.innerHTML = '<p style="color: red;">Could not load alerts.</p>';
        }
    }

    // --- SETTINGS LOGIC ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const languageSelect = document.getElementById('language-select');
    const layoutSelect = document.getElementById('layout-select');

    settingsBtn.addEventListener('click', () => settingsOverlay.classList.add('visible'));
    settingsCloseBtn.addEventListener('click', () => settingsOverlay.classList.remove('visible'));
    settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('visible'); });

    languageSelect.addEventListener('change', (e) => {
        if (e.target.value === 'ar') window.location.href = '/ar/mobile.html';
        else if (window.location.pathname.startsWith('/ar/')) window.location.href = '/mobile.html';
    });

    layoutSelect.addEventListener('change', (e) => {
        if (e.target.value === 'desktop') window.location.href = '/index.html';
        else if (e.target.value === 'legacy') window.location.href = '/legacy.html';
    });


    // --- INITIAL PAGE LOAD ---
    routeForm.addEventListener('submit', handleFormSubmit);
    await initializeAutocomplete();
    initializePanel();
    useMyLocationBtn.click();
    map.removeLayer(stationMarkersLayer);
    fetchAndRenderAlerts(); // Fetch alerts on load

    // --- REALTIME ALERTS ---
    client.subscribe(`databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_ALERTS_COLLECTION_ID}.documents`, response => {
        console.log("Realtime event received on mobile:", response);
        fetchAndRenderAlerts();
    });
};
