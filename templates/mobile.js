// --- CONFIGURATION ---
const BACKEND_URL = 'http://mainserver.inirl.net:5000';

window.onload = async () => {
    // --- MAP INITIALIZATION ---
    const map = L.map('map', { zoomControl: false }).setView([24.7136, 46.6753], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }).addTo(map);

    const routeForm = document.getElementById('route-form');
    let activeRouteLayers = new L.FeatureGroup().addTo(map);

    // --- ADVANCED BOTTOM SHEET PANEL LOGIC ---
    const panel = document.getElementById('panel');
    const panelHandle = document.getElementById('panel-handle');
    const panelContent = document.getElementById('panel-content');

    // FIX: expandedHeight is now almost the full screen height to ensure all content is visible.
    // A small margin is left for the status bar.
    const expandedHeight = window.innerHeight - 40; // 40px margin from the top
    const collapsedHeight = panelHandle.offsetHeight + document.querySelector('.form-container').offsetHeight + 20;

    let currentState = 'collapsed';
    let startY, startHeight;

    // Set initial panel position to collapsed
    panelContent.style.height = `${expandedHeight - panelHandle.offsetHeight}px`;
    panel.style.transform = `translateY(${window.innerHeight - collapsedHeight}px)`;

    function setPanelState(state) {
        let targetY;
        if (state === 'expanded') {
            targetY = window.innerHeight - expandedHeight;
            currentState = 'expanded';
        } else { // collapsed
            targetY = window.innerHeight - collapsedHeight;
            currentState = 'collapsed';
        }
        panel.style.transition = 'transform 0.4s ease-out';
        panel.style.transform = `translateY(${targetY}px)`;
    }

    panelHandle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startHeight = panel.getBoundingClientRect().top;
        panel.style.transition = 'none'; // Allow smooth dragging
    });

    panelHandle.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        let deltaY = currentY - startY;
        let newTop = startHeight + deltaY;

        // FIX: Update drag constraints to allow moving the panel higher.
        const minTop = window.innerHeight - expandedHeight; // Top limit
        const maxTop = window.innerHeight - collapsedHeight; // Bottom limit
        if (newTop < minTop) newTop = minTop;
        if (newTop > maxTop) newTop = maxTop;

        panel.style.transform = `translateY(${newTop}px)`;
    });

    panelHandle.addEventListener('touchend', (e) => {
        const endY = e.changedTouches[0].clientY;
        const deltaY = endY - startY;

        if (Math.abs(deltaY) > 100) {
            if (deltaY < 0 && currentState === 'collapsed') {
                setPanelState('expanded'); // Swiped up
            } else if (deltaY > 0 && currentState === 'expanded') {
                setPanelState('collapsed'); // Swiped down
            }
        } else {
            setPanelState(currentState);
        }
    });

    panelHandle.addEventListener('click', (e) => {
        if (e.detail > 0) {
             setPanelState(currentState === 'collapsed' ? 'expanded' : 'collapsed');
        }
    });


    // --- The rest of the logic remains largely the same ---

    async function initializeAutocomplete() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/stations`);
            if (!response.ok) throw new Error(`Failed to fetch stations: ${response.status}`);
            const stationList = await response.json();
            new Awesomplete(document.getElementById('start-input'), { list: stationList, minChars: 1 });
            new Awesomplete(document.getElementById('end-input'), { list: stationList, minChars: 1 });
        } catch (error) {
            console.error("Could not initialize autocomplete:", error);
        }
    }

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

    async function handleFormSubmit(event) {
        event.preventDefault();
        const start = document.getElementById('start-input').value;
        const end = document.getElementById('end-input').value;

        setPanelState('expanded');

        await fetchAndDisplayRoute(start, end);
    }

    async function fetchAndDisplayRoute(start, end) {
        const detailsContainer = document.getElementById('route-details');
        detailsContainer.innerHTML = '<p>Searching for the best route...</p>';

        if (!start || !end) {
            detailsContainer.innerHTML = '<p style="color: orange;">Please enter both a start and end location.</p>';
            return;
        }

        const startCoords = parseCoordinates(start);
        const endCoords = parseCoordinates(end);

        let endpoint = '';
        let body = {};

        if (startCoords && endCoords) {
            endpoint = `${BACKEND_URL}/route_by_coords`;
            body = {
                start_lat: parseFloat(startCoords.lat.toFixed(13)),
                start_lng: parseFloat(startCoords.lng.toFixed(13)),
                end_lat: parseFloat(endCoords.lat.toFixed(13)),
                end_lng: parseFloat(endCoords.lng.toFixed(13))
            };
        } else if (!startCoords && !endCoords) {
            endpoint = `${BACKEND_URL}/route`;
            body = { start, end };
        } else {
            detailsContainer.innerHTML = '<p style="color: red;">Error: Mixed inputs are not supported.</p>';
            return;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);

            const data = await response.json();
            displayRoute(data);
        } catch (error) {
            console.error("Failed to fetch route:", error);
            detailsContainer.innerHTML = `<p style="color: red;">Error: Could not retrieve route.</p>`;
        }
    }

    function displayRoute(data) {
        // This function is identical to the one in app.js
        activeRouteLayers.clearLayers();
        const detailsContainer = document.getElementById('route-details');
        detailsContainer.innerHTML = '';
        if (!data.routes || data.routes.length === 0) {
            detailsContainer.innerHTML = '<p>No routes found.</p>';
            return;
        }
        const route = data.routes[0];
        const allCoords = [];
        const lineColors = {
            metro: { '1': '#00aee6', '2': '#ef4938', '3': '#f68d39', '4': '#ffd10a', '5': '#37b23f', '6': '#984b9d' },
            bus: '#18a034', walk: '#6c757d', default: '#555'
        };
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'route-summary';
        const totalMinutes = Math.round(route.total_time / 60);
        summaryDiv.innerHTML = `<p>${totalMinutes} min</p><span>Total journey time.</span>`;
        detailsContainer.appendChild(summaryDiv);
        route.segments.forEach((segment) => {
            let style = {};
            if (segment.type === 'metro') {
                const color = lineColors.metro[segment.line] || lineColors.default;
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold;">${segment.line}</span>`, lineStyle: {} };
            } else if (segment.type === 'bus') {
                const color = lineColors.bus;
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold;">${segment.line}</span>`, lineStyle: {} };
            } else if (segment.type === 'walk') {
                const color = lineColors.walk;
                style = { color, icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`, lineStyle: { dashArray: '5, 10' } };
            } else {
                const color = lineColors.default;
                style = { color, icon: '?', lineStyle: {} };
            }
            const latLngs = segment.coordinates.map(c => [c.lat, c.lng]);
            allCoords.push(...latLngs);
            const polylineOptions = { color: style.color, weight: 6, opacity: 0.8, ...style.lineStyle };
            L.polyline(latLngs, polylineOptions).addTo(activeRouteLayers);
            let instructionTitle = '', instructionDetails = '', endPointName = '';
            const durationMins = Math.round(segment.duration / 60);
            if (segment.type === 'walk') {
                endPointName = segment.to || "your destination";
                instructionTitle = `Walk to ${endPointName}`;
                const distanceMeters = Math.round(segment.distance || 0);
                instructionDetails = `${durationMins} min (${distanceMeters} m)`;
            } else {
                const transportMode = segment.type.charAt(0).toUpperCase() + segment.type.slice(1);
                instructionTitle = `Take ${transportMode} Line ${segment.line}`;
                if (segment.stations && segment.stations.length > 0) {
                    endPointName = segment.stations[segment.stations.length - 1];
                    const stopsText = segment.stations.length > 1 ? `&bull; ${segment.stations.length - 1} stops` : '';
                    instructionDetails = `${durationMins} min ${stopsText}`;
                } else {
                    endPointName = "next stop";
                    instructionDetails = `${durationMins} min`;
                }
            }
            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'instruction';
            instructionDiv.innerHTML = `<div class="instruction-icon">${style.icon}</div><div class="instruction-details"><h3>${instructionTitle}</h3><p>${instructionDetails}</p>${segment.type !== 'walk' ? `<p>Disembark at ${endPointName}</p>` : ''}</div>`;
            detailsContainer.appendChild(instructionDiv);
        });
        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], paddingTop: 100 });
    }

    // --- INITIAL PAGE LOAD ---
    routeForm.addEventListener('submit', handleFormSubmit);
    await initializeAutocomplete();
};
