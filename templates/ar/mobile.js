// --- CONFIGURATION ---
const BACKEND_URL = '/ar';
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// --- APPWRITE CONFIGURATION ---
const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'; // Or your self-hosted endpoint
const APPWRITE_PROJECT_ID = '68f141dd000f83849c21'; // Replace with your Project ID
const APPWRITE_DATABASE_ID = '68f146de0013ba3e183a'; // Replace with your Database ID
const APPWRITE_ALERTS_COLLECTION_ID = 'arabic'; // Replace with your Collection ID

// --- NEW: Caches and Mappings ---
const lineDataCache = new Map();
const busLineDataCache = new Map();
const lineNameToNumber = {
    'المسار الأزرق': '1',
    'المسار الأحمر': '2',
    'المسار البرتقالي': '3',
    'المسار الأصفر': '4',
    'المسار الأخضر': '5',
    'المسار البنفسجي': '6'
};

window.onload = async () => {
    // --- NEW: Live route update state variables ---
    const arrivalAnimationTimers = new Map();
    const animationFrames = [`${BACKEND_URL}/lt3.png`, `${BACKEND_URL}/lt2.png`, `${BACKEND_URL}/lt1.png`];
    let currentRouteData = null;
    let liveRouteUpdater = null;
    let stationLiveUpdater = null; // <-- ADDED

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
        let timeString = now.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true // Ensure AM/PM is included
        });

        // Replace AM/PM with Arabic equivalents
        timeString = timeString.replace('PM', 'م').replace('AM', 'ص');
        return timeString;
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
    language: "ar",
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
    const lineDetailView = document.getElementById('line-detail-view');
    const lineDetailBackButton = document.getElementById('line-detail-back-btn');

    // --- BOTTOM SHEET & OVERLAYS ---
    const locationOverlay = document.getElementById('location-overlay');
    const directionOverlay = document.getElementById('direction-overlay');
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
        // --- MODIFIED: Clear live updaters ---
        if (stationLiveUpdater) {
            clearInterval(stationLiveUpdater);
            stationLiveUpdater = null;
            // Also clear any animations potentially running in station view
            arrivalAnimationTimers.forEach(timer => clearInterval(timer));
            arrivalAnimationTimers.clear();
        }
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
    lineDetailBackButton.addEventListener('click', () => {
        // --- MODIFIED: Go back to main panel, not a specific view ---
        showView(panelMainView);
        // Clear line markers and show route
        stationMarkersLayer.clearLayers();
        map.addLayer(activeRouteLayers);
    });

    // --- NEARBY STATIONS LOGIC ---
    async function fetchNearbyStations() {
        if (!currentStationsLatLng) {
            document.getElementById('stations-list').innerHTML = '<p>اضغط على زر "إستخدم موقعي" أو إختر موقعاً على الخريطة للحصول على محطات قريبة</p>';
            return;
        }
        document.getElementById('stations-list').innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري البحث على محطات قريبة...</p></div>`;
        try {
            const response = await fetch(`${BACKEND_URL}/nearbystations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentStationsLatLng)
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            stationsDataCache = await response.json();
            displayStations(stationsDataCache);
        } catch (error) {
            console.error("حدث خطأ أثناء تحميل المحطات:", error);
            document.getElementById('stations-list').innerHTML = '<p style="color: red;">Error loading stations.</p>';
        }
    }

    function displayStations(data) {
        const stationsList = document.getElementById('stations-list');
        stationsList.innerHTML = '';
        stationMarkersLayer.clearLayers();
        if (!data || data.length === 0) {
            stationsList.innerHTML = '<p>لا يوجد محطات تبعد أقل من 1.5 كيلومتر</p>';
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
            stationDiv.innerHTML = `<div class="station-icon">${station.type === 'bus' ? '🚌' : '🚇'}</div><div class="station-details"><h4>${station.name}</h4><p>${Math.round(station.distance)} متراً</p><p>${Math.round(station.duration / 60)} دقيقة مشياً</p></div>`;
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
        const currentStationName = station.name; // Store for the updater
        const stationType = station.type; // <-- Get the station type
        stationDetailName.textContent = currentStationName;
        stationDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري تحميل المسارات...</p></div>`;

        const apiStationName = cleanStationName(currentStationName);

        try {
            // --- MODIFIED: Conditional fetching with BACKEND_URL ---
            const linesPromise = fetch(`${BACKEND_URL}/searchstation`, {
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
                console.warn("Unknown station type:", stationType);
                arrivalPromise = Promise.resolve({ arrivals: [] });
            }

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
            if (stationType === 'metro' || stationType === 'bus') {
                 const fetchFunction = stationType === 'metro' ? fetchMetroArrivals : fetchBusArrivals;

                 const updateThisStation = async () => {
                     try {
                         const freshArrivalsData = await fetchFunction(apiStationName);
                         (freshArrivalsData?.arrivals || []).forEach(arrival => {
                             updateSingleStationArrival(arrival);
                         });
                         // Handle case where arrivals might become empty
                         const contentArea = document.getElementById('station-detail-content');
                          if (contentArea && (!freshArrivalsData?.arrivals || freshArrivalsData.arrivals.length === 0) && !contentArea.querySelector('.loader-container') && !contentArea.querySelector('.no-arrivals-message')) {
                              renderStationLinesWithArrivals(currentStationName, lineData, []); // Re-render with no arrivals
                          } else if (contentArea && contentArea.querySelector('.no-arrivals-message') && freshArrivalsData?.arrivals && freshArrivalsData.arrivals.length > 0) {
                               renderStationLinesWithArrivals(currentStationName, lineData, freshArrivalsData.arrivals);
                          }

                     } catch (error) {
                         console.error(`Failed to fetch ${stationType} arrivals during update:`, error);
                     }
                 };

                 updateThisStation(); // Update immediately
                 stationLiveUpdater = setInterval(updateThisStation, 60000); // Update every minute
            }

        } catch (error) {
            console.error("Failed to fetch station details or initial arrivals:", error);
            stationDetailContent.innerHTML = '<p style="color: red;">Could not load station details.</p>';
            if (stationLiveUpdater) clearInterval(stationLiveUpdater);
            stationLiveUpdater = null;
        }
    }

    // --- NEW: Renders the station detail list with arrival placeholders ---
    function renderStationLinesWithArrivals(stationName, lineData, initialArrivalsData) {
        const stationDetailContent = document.getElementById('station-detail-content');
        stationDetailContent.innerHTML = ''; // Clear loader

        const metroArrivals = initialArrivalsData.filter(a => lineData.metro_lines.includes(a.line));
        const busArrivals = initialArrivalsData.filter(a => lineData.bus_lines.includes(a.line));

        metroArrivals.sort((a, b) => a.minutes_until - b.minutes_until);
        busArrivals.sort((a, b) => a.minutes_until - b.minutes_until);

        let contentAdded = false;

        if (metroArrivals.length > 0) {
            contentAdded = true;
            const metroContainer = document.createElement('div');
            metroContainer.className = 'station-line-list-container';
            metroContainer.innerHTML = `<h4>🚇 مسارات قطار</h4>`;
            metroArrivals.forEach(arrival => {
                const item = document.createElement('div');
                item.className = 'station-line-item';
                const color = lineColors.metro[arrival.line] || lineColors.default;
                const arrivalId = getStationArrivalElementId(arrival);

                item.innerHTML = `
                    <div class="station-line-badge" style="background-color: ${color};">${arrival.line}</div>
                    <div class="station-line-details">${arrival.destination}</div>
                    <div class="station-line-arrival" id="${arrivalId}"></div>
                `;
                metroContainer.appendChild(item);
                updateSingleStationArrival(arrival);
            });
            stationDetailContent.appendChild(metroContainer);
        }

        if (busArrivals.length > 0) {
            contentAdded = true;
            const busContainer = document.createElement('div');
            busContainer.className = 'station-line-list-container';
            busContainer.innerHTML = `<h4>🚌 مسارات حافلات</h4>`;
            busArrivals.forEach(arrival => {
                const item = document.createElement('div');
                item.className = 'station-line-item';
                const color = lineColors.bus;
                const arrivalId = getStationArrivalElementId(arrival);

                item.innerHTML = `
                    <div class="station-line-badge" style="background-color: ${color};">${arrival.line}</div>
                    <div class="station-line-details">${arrival.destination}</div>
                    <div class="station-line-arrival" id="${arrivalId}"></div>
                `;
                busContainer.appendChild(item);
                updateSingleStationArrival(arrival);
            });
            stationDetailContent.appendChild(busContainer);
        }

        if (!contentAdded) {
            stationDetailContent.innerHTML = '<p class="no-arrivals-message" style="text-align: center; color: #5f6368; margin-top: 20px;">لم يتم العثور على أي وصول قريب.</p>';
        }
    }

    // --- NEW: Generates unique ID for station arrival elements ---
    function getStationArrivalElementId(arrival) {
        const cleanDest = cleanStationName(arrival.destination).replace(/[^a-zA-Z0-9]/g, '');
        return `station-${arrival.line}-${cleanDest}-${arrival.minutes_until}`;
    }

    // --- NEW: Updates a single station arrival element ---
    function updateSingleStationArrival(arrivalData) {
        const elementId = getStationArrivalElementId(arrivalData);
        const arrivalElement = document.getElementById(elementId);
        if (!arrivalElement) return;

        stopArrivalAnimation(elementId);

        const minutes = arrivalData.minutes_until;
        let htmlContent = '';
        let color = '#5f6368';

        if (minutes > 60) {
            const arrivalTime = getArrivalTime(minutes);
            htmlContent = `<span class="arrival-text">${arrivalTime}</span>`;
            color = '#000';
        } else {
            let arrivalText = '';
            if (minutes <= 0) arrivalText = 'يصل الآن';
            else if (minutes === 1) arrivalText = '1 دقيقة';
            else if (minutes === 2) arrivalText = 'دقيقتان';
            else if (minutes < 10) arrivalText = `${Math.round(minutes)} دقائق`;
            else arrivalText = `${Math.round(minutes)} دقيقة`;

            htmlContent = `
                <img src="${BACKEND_URL}/lt3.png" class="arrival-animation" alt="" />
                <span class="arrival-text">${arrivalText}</span>
            `;
            color = '#18a034';

            arrivalElement.innerHTML = htmlContent;
            arrivalElement.querySelector('.arrival-text').style.color = color;

            const imgElement = arrivalElement.querySelector('.arrival-animation');
            if (imgElement) startArrivalAnimation(elementId, imgElement);
            return;
        }

        arrivalElement.innerHTML = htmlContent;
        const textSpan = arrivalElement.querySelector('.arrival-text');
        if(textSpan) textSpan.style.color = color;
    }

    const lineColors = {
        metro: { 'المسار الأزرق': '#00aee6', 'المسار الأحمر': '#ef4938', 'المسار البرتقالي': '#f68d39', 'المسار الأصفر': '#ffd10a', 'المسار الأخضر': '#37b23f', 'المسار البنفسجي': '#984b9d', '1': '#00aee6', '2': '#ef4938', '3': '#f68d39', '4': '#ffd10a', '5': '#37b23f', '6': '#984b9d'  },
        bus: '#18a034',
        walk: '#6c757d',
        default: '#555'
    };

    // --- DELETED: renderStationLines (replaced by renderStationLinesWithArrivals) ---

    // --- ALL LINE LOGIC ---
    const lineSearchInput = document.getElementById('line-search-input');

    async function fetchAllLines() {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري تحميل جميع المسارات...</p></div>`;
        try {
            const [metroLinesRes, busLinesRes] = await Promise.all([
                fetch(`${BACKEND_URL}/mtrlines`), fetch(`${BACKEND_URL}/buslines`)
            ]);
            const metroLinesData = await metroLinesRes.json();
            const busLinesData = await busLinesRes.json();
            const metroPromises = metroLinesData.lines.split(',').map(line => fetch(`${BACKEND_URL}/viewmtr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line }) }).then(res => res.json()).then(data => ({ type: 'metro', line, data })));
            const busPromises = busLinesData.lines.split(',').map(line => fetch(`${BACKEND_URL}/viewbus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line }) }).then(res => res.json()).then(data => ({ type: 'bus', line, data })));
            const allLineDetails = await Promise.all([...metroPromises, ...busPromises]);
            allLinesData = allLineDetails.map(({ type, line, data }) => {
                let terminus = 'Unknown';
                if (type === 'metro' && data.stations && data.stations.length > 0) terminus = `${data.stations[0]} - ${data.stations[data.stations.length - 1]}`;
                else if (type === 'bus') {
                    const keys = Object.keys(data);
                    if (keys.length === 1) terminus = `المسار الدائري ${keys[0]}`;
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
            linesList.innerHTML = '<p style="color: red;">حدث خطأ أثناء تحميل المسارات.</p>';
        }
    }

    function renderLinesList(lines) {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = '';
        if (!lines || lines.length === 0) { linesList.innerHTML = '<p>فشل الحصول على مسارات.</p>'; return; }

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
            if(line.type === "metro") {
                details.innerHTML = `<p class="terminus">${line.terminus}</p><p class="line-type">قطار</p>`;
            }
            else if(line.line.startsWith('BRT')){ //6t788888uuuuuy
                details.innerHTML = `<p class="terminus">${line.terminus}</p><p class="line-type">حافلة BRT</p>`;
            }
            else {
                details.innerHTML = `<p class="terminus">${line.terminus}</p><p class="line-type">حافلة</p>`;
            }
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
        const filteredLines = allLinesData.filter(line => line.line.toLowerCase().includes(query) || line.terminus.toLowerCase().includes(query));
        renderLinesList(filteredLines);
    });

    function handleLineClick(line) {
        const isRingRoute = line.terminus.startsWith('المسار الدائري ');

        if (!isRingRoute) {
            showDirectionSelection(line);
        }
        else {
            // For metro or ring routes, determine direction
            const directionKey = line.type === 'metro' ? line.terminus.split(' - ')[0] : null;
            showLineDetails(line, directionKey);
        }
    }

    function showDirectionSelection(line) {
        const directionPanel = document.getElementById('direction-panel');
        directionPanel.innerHTML = '<p>إختر إتجاه</p>'; // Reset
        const [start, end] = line.terminus.split(' - ');
        const forwardKey = line.type === 'bus' ? end : start;
        const backwardKey = line.type === 'bus' ? start : end;

        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'bottom-panel-button';
        forwardBtn.textContent = `${start} ← ${end}`;
        forwardBtn.onclick = () => {
            directionOverlay.classList.remove('visible');
            showLineDetails(line, forwardKey);
        };

        const backwardBtn = document.createElement('button');
        backwardBtn.className = 'bottom-panel-button';
        backwardBtn.textContent = `${end} ← ${start}`;
        backwardBtn.onclick = () => {
            directionOverlay.classList.remove('visible');
            showLineDetails(line, backwardKey);
        } //wسييييثثثثثثثثثثثثثثثثعغا
        // Create the cancel button dynamically instead of cloning it. ئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئئِ
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bottom-panel-button cancel';
        cancelBtn.textContent = 'إلغاء';
        cancelBtn.onclick = () => directionOverlay.classList.remove('visible');

        directionPanel.appendChild(forwardBtn);
        directionPanel.appendChild(backwardBtn);
        directionPanel.appendChild(cancelBtn);
        directionOverlay.classList.add('visible');
    }

    async function showLineDetails(line, directionKey = null) {
        showView(lineDetailView);
        const lineDetailName = document.getElementById('line-detail-name');
        const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;

        // --- MODIFIED: Use innerHTML to match mobile.css structure ---
        lineDetailName.innerHTML = `<div class="line-detail-badge" style="background-color: ${color};">${line.line}</div><h4 class="line-detail-terminus">${line.terminus}</h4>`;

        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري تحميل المحطات...</p></div>`;

        try {
            const endpoint = line.type === 'metro' ? '/viewmtr' : '/viewbus';
            const response = await fetch(`${BACKEND_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line: line.line }) });
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
            lineDetailContent.innerHTML = '<p style="color: red;">فشل تحميل معلومات عن المسار.</p>';
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

    // --- DELETED: hideStationDetails (functionality merged into handleBackNavigation) ---

    // --- AUTOCOMPLETE ---
    function formatOsmName(item) {
        const address = item.address || {};
        let mainName = item.name || address.road || address.amenity || address.shop || address.building || address.tourism || address.historic;
        if (!mainName) mainName = item.display_name.split(',')[0];
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
                const params = new URLSearchParams({
                    q: `${query}, Riyadh`,
                    format: 'json',
                    addressdetails: 1,
                    limit: 4,
                    viewbox: '46.2,25.2,47.2,24.2',
                    bounded: 1,
                    'accept-language': 'ar'
                });
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

    async function initializeAutocomplete() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/stations`);
            if (!response.ok) throw new Error(`فشل الحصول على المحطات: ${response.status}`);
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

    async function fetchAndDisplayRoute(startValue, endValue) {
const detailsContainer = document.getElementById('route-details');
        const findRouteBtn = document.querySelector('#route-form button[type="submit"]');
        const useMyLocationBtn = document.getElementById('use-my-location');

        findRouteBtn.style.display = 'none';
        useMyLocationBtn.style.display = 'none';

        // --- FIX: Hide form container and show details container ---
        document.querySelector('.form-container').style.display = 'none';
        detailsContainer.style.display = 'block';
        // --- END FIX ---
        detailsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div><p>نعمل على إيجاد أفضل مسار لك...</p></div>`;

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
             detailsContainer.innerHTML = '<p style="color: orange;">الرجاء إدخال الأصل والوجهة.</p>';
        } else if (startIsCoords && endIsCoords) {
            endpoint = `${BACKEND_URL}/route_from_coords`;
            body = { start_lat: startValue.lat, start_lng: startValue.lng, end_lat: endValue.lat, end_lng: endValue.lng };
        } else if (!startIsCoords && !endIsCoords) {
            endpoint = `/route`;
            body = { start: startValue, end: endValue }; // Send names
        } else {
            // Mixed input types (one is coords, one is name) - currently not supported by backend
            detailsContainer.innerHTML = '<p style="color: red;">خطأ: يرجى استخدام اسمي محطتين أو مجموعتين من الإحداثيات. لا يتم دعم المدخلات المختلطة</p>';
        }

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

    // --- COMPLETELY REPLACED: With live-update-ready version ---
    function displayRoute(data) {
        const detailsContainer = document.getElementById('route-details');
        activeRouteLayers.clearLayers();
        detailsContainer.innerHTML = ''; // Clear loader

        if (data.error || !data.routes || data.routes.length === 0) {
            detailsContainer.innerHTML = `<p>${data.error || 'فشل العثور على طريق.'}</p>`;
            document.querySelector('.form-container').style.display = 'block';
            return;
        }

        // --- MERGED: Keep the mobile "New Route" button ---
        const newRouteButton = document.createElement('button');
        newRouteButton.className = 'new-route-button secondary-button';
        newRouteButton.textContent = 'إنشاء بحث جديد';
        newRouteButton.addEventListener('click', () => {
            document.querySelector('.form-container').style.display = 'block';
            detailsContainer.style.display = 'none';
            detailsContainer.innerHTML = '';
            activeRouteLayers.clearLayers();
            setPanelState('collapsed');
            // --- NEW: Stop updater when searching for new route ---
            if (liveRouteUpdater) {
                clearInterval(liveRouteUpdater);
                liveRouteUpdater = null;
            }
            arrivalAnimationTimers.forEach(timer => clearInterval(timer));
            arrivalAnimationTimers.clear();
            currentRouteData = null;
        });
        detailsContainer.appendChild(newRouteButton);
        // --- End of Merge ---

        currentRouteData = data.routes[0]; // --- NEW: Store route data
        const route = currentRouteData;
        const allCoords = [];

        // --- MODIFIED: Add ID to the total time span ---
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'route-summary';
        summaryDiv.innerHTML = `<p><span id="route-total-time-span">${Math.round(route.total_time / 60)} min</span></p><span>إجمالي مدة الرحلة</span>`;
        detailsContainer.appendChild(summaryDiv);

        // --- MODIFIED: This loop just builds the static HTML skeleton ---
        route.segments.forEach((segment) => {
            let style = {};
            if (segment.type === 'metro') {
                const color = lineColors.metro[segment.line] || lineColors.default;
                // --- MODIFIED: Use mobile metro icon ---
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px;">🚇</span>` };
            } else if (segment.type === 'bus') {
                const color = lineColors.bus;
                style = { color, icon: `<span class="line-icon" style="background-color: ${color}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 14px; font-weight: bold;">${segment.line}</span>` };
            } else if (segment.type === 'walk') {
                const color = lineColors.walk;
                style = { color, icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>` };
            }
            const latLngs = segment.coordinates.map(c => [c.lat, c.lng]);
            allCoords.push(...latLngs);
            L.polyline(latLngs, { color: style.color, weight: 6, opacity: 0.8, dashArray: segment.type === 'walk' ? '5, 10' : '' }).addTo(activeRouteLayers);

            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'instruction';
            const durationMins = Math.round(segment.duration / 60);
            let instructionTitle = '', instructionDetails = '', endPointName = '';

            const { titleId, arrivalId } = getSegmentIds(segment);
            let arrivalHtml = '';

            if (segment.type === 'walk') {
                endPointName = segment.to || "your destination";
                instructionTitle = `إمشي إلى ${endPointName}`;
                instructionDetails = `${durationMins} دقيقة (${Math.round(segment.distance || 0)} متر)`;
            } else {
                 if (segment.type === "metro") {
                    instructionTitle = `إتجه على متن ${segment.line}`;
                }
                else {
                    instructionTitle = `إتجه على متن حافلة رقم ${segment.line}`;
                }
                endPointName = segment.stations && segment.stations.length > 0 ? segment.stations[segment.stations.length - 1] : "next stop";
                const stopsText = segment.stations && segment.stations.length > 1 ? `&bull; ${segment.stations.length - 1} محطة` : '';
                instructionDetails = `${durationMins} دقيقة ${stopsText}`;

                // --- NEW: Add the placeholder div for live data ---
                arrivalHtml = `<div class="instruction-arrival" id="${arrivalId}"></div>`;
            }

            instructionDiv.innerHTML = `
                <div class="instruction-icon">${style.icon}</div>
                <div class="instruction-details">
                    <h3 id="${titleId}">${instructionTitle}</h3>
                    <p>${instructionDetails}</p>
                    ${segment.type !== 'walk' ? `<small>إنزل عند محطة ${endPointName}</small>` : ''}
                </div>
                ${arrivalHtml}`; // <-- Placeholder is added here

            detailsContainer.appendChild(instructionDiv);
        });

        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], paddingTop: 100 });

        // --- NEW: Start the update loop ---
        updateLiveRouteData(); // Run once immediately
        liveRouteUpdater = setInterval(updateLiveRouteData, 60000); // Run every minute
    }

    // --- MAP CLICK & LOCATION OVERLAY ---
    const setOriginBtn = document.getElementById('overlay-set-origin');
    const setDestinationBtn = document.getElementById('overlay-set-destination');
    const setStationsBtn = document.getElementById('overlay-set-stations');
    const cancelBtn = document.getElementById('overlay-cancel');
    let clickedCoords = null;
    map.on('click', function(e) {
        // --- NEW: Stop route updater on map click ---
        if (liveRouteUpdater) {
            clearInterval(liveRouteUpdater);
            liveRouteUpdater = null;
        }
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
        startInput.placeholder = "جاري البحث على موقعك...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentStationsLatLng = { lat: latitude, lng: longitude };
                startInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                startInput.placeholder = "من إين ستغادر؟";
                map.setView([latitude, longitude], 13);
                if (stationsTab.classList.contains('active')) {
                    fetchNearbyStations();
                }
            },
            () => { startInput.placeholder = "فشل الحصول على موقعك"; }
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

    // --- NEW: LIVE ARRIVAL HELPER FUNCTIONS (from app.js) ---
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
            const response = await fetch(`${BACKEND_URL}/viewmtr`, {
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
            const response = await fetch(`${BACKEND_URL}/viewbus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: lineNumber })
            });
            if (!response.ok) throw new Error(`فشل في جلب بيانات مسار الحافلة رقم ${lineNumber}`);
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
            const response = await fetch(`${BACKEND_URL}/metro_arrivals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: stationName })
            });
            if (!response.ok) throw new Error(`فشل في جلب الوصول ل${stationName}`);
            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function fetchBusArrivals(stationName) {
        try {
            const response = await fetch(`${BACKEND_URL}/bus_arrivals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: stationName })
            });
            if (!response.ok) throw new Error(`فشل في جلب الوصول ل${stationName}`);
            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // --- NEW: Helper function to generate unique IDs for segments ---
    function getSegmentIds(segment) {
        const linePart = (segment.type === 'walk') ? 'walk' : segment.line.replace(/\s+/g, '-');
        const stationPart = (segment.stations && segment.stations.length > 0)
            ? segment.stations[0].replace(/[^a-zA-Z0-9]/g, '')
            : 'no-station';

        const uniqueIdBase = `${segment.type}-${linePart}-${stationPart}`;

        return {
            titleId: `title-${uniqueIdBase}`,
            arrivalId: `arrival-${uniqueIdBase}`
        };
    }

    // --- NEW: Helper function to update a segment's UI ---
    function updateSegmentUI(segment, status, data = {}) {
        const { arrivalId } = getSegmentIds(segment);
        const arrivalElement = document.getElementById(arrivalId);

        if (!arrivalElement) return; // Walk segments

        stopArrivalAnimation(arrivalId);

        switch (status) {
            case 'live':
                arrivalElement.style.display = 'flex';
                const minutes = data.waitMinutes;
                if (minutes > 60) {
                    const arrivalTime = getArrivalTime(data.fullMinutesUntil);
                    arrivalElement.innerHTML = `<span class="arrival-text" style="color: #000;">${arrivalTime}</span>`;
                } else {
                    let arrivalText = '';
                    if (minutes <= 0) arrivalText = 'يصل الآن';
                    else if (minutes === 1) arrivalText = '1 دقيقة';
                    else if (minutes === 2) arrivalText = 'دقيقتان';
                    else if (minutes < 10) arrivalText = `${Math.round(minutes)} دقائق`;
                    else arrivalText = `${Math.round(minutes)} دقيقة`;

                    arrivalElement.innerHTML = `
                        <span class="arrival-text" style="color: #18a034;">${arrivalText}</span>
                        <img src="${BACKEND_URL}/lt3.png" class="arrival-animation" alt="" />
                    `;
                    const imgElement = arrivalElement.querySelector('.arrival-animation');
                    if (imgElement) startArrivalAnimation(arrivalId, imgElement);
                }
                break;
            case 'checking':
                arrivalElement.style.display = 'flex';
                arrivalElement.innerHTML = `<span class="arrival-text" style="color: #5f6368;">(جاري التحميل...)</span>`;
                break;
            case 'missed':
            case 'error':
            default:
                arrivalElement.innerHTML = '';
                arrivalElement.style.display = 'none';
                break;
        }
    }

    // --- NEW: Master function to update all live route data ---
    async function updateLiveRouteData() {
        if (!currentRouteData) return;

        let travelTimeElapsed = 0;
        let newTotalJourneyMinutes = 0;
        let liveChainBroken = false;
        const MAX_ACCEPTABLE_WAIT = 45;

        for (const segment of currentRouteData.segments) {
            const segmentRideMinutes = Math.round(segment.duration / 60);

            if (segment.type === 'walk') {
                newTotalJourneyMinutes += segmentRideMinutes;
                travelTimeElapsed += segmentRideMinutes;
                continue;
            }

            const { titleId, arrivalId } = getSegmentIds(segment);
            const arrivalElement = document.getElementById(arrivalId);
            if (!arrivalElement) continue;

            stopArrivalAnimation(arrivalId);
            arrivalElement.style.display = 'flex';
            arrivalElement.innerHTML = `<span class="arrival-text" style="color: #5f6368;">(جاري التحميل...)</span>`;

            try {
                let arrivalsData, lineData, lineNumber, apiStationName;

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

                const titleElement = document.getElementById(titleId);
                if (titleElement && correctTerminus && !isRingRoute) {
                    const cleanTerminus = cleanStationName(correctTerminus);
                    titleElement.textContent = `إتجه على متن ${segment.type === 'metro' ? `${segment.line}` : `حافلة رقم ${segment.line}`} بإتجاه ${cleanTerminus}`;
                }

                if (liveChainBroken) {
                    updateSegmentUI(segment, 'missed');
                    newTotalJourneyMinutes += segmentRideMinutes;
                    travelTimeElapsed += segmentRideMinutes;
                } else {
                    const validArrival = arrivalsData.arrivals.find(arr =>
                        arr.line === lineNumber &&
                        cleanStationName(arr.destination) === cleanStationName(correctTerminus) &&
                        arr.minutes_until >= travelTimeElapsed
                    );

                    if (validArrival) {
                        const waitMinutes = validArrival.minutes_until - travelTimeElapsed;

                        if (waitMinutes > MAX_ACCEPTABLE_WAIT) {
                            liveChainBroken = true;
                            updateSegmentUI(segment, 'missed');
                            newTotalJourneyMinutes += segmentRideMinutes;
                            travelTimeElapsed += segmentRideMinutes;
                        } else {
                            newTotalJourneyMinutes += waitMinutes + segmentRideMinutes;
                            travelTimeElapsed += segmentRideMinutes;
                            updateSegmentUI(segment, 'live', {
                                waitMinutes: waitMinutes,
                                fullMinutesUntil: validArrival.minutes_until
                            });
                        }
                    } else {
                        liveChainBroken = true;
                        updateSegmentUI(segment, 'missed');
                        newTotalJourneyMinutes += segmentRideMinutes;
                        travelTimeElapsed += segmentRideMinutes;
                    }
                }

            } catch (error) {
                console.error('Failed to update live segment:', error);
                liveChainBroken = true;
                updateSegmentUI(segment, 'error');
                newTotalJourneyMinutes += segmentRideMinutes;
                travelTimeElapsed += segmentRideMinutes;
            }
        }

        const totalTimeElement = document.getElementById('route-total-time-span');
        if (totalTimeElement) {
            totalTimeElement.textContent = `${Math.round(newTotalJourneyMinutes)} دقيقة`;
        }
    }


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
