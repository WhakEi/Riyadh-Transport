// --- CONFIGURATION ---
const BACKEND_URL = 'http://mainserver.inirl.net:5001';
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

window.onload = async () => {
    // --- MAP INITIALIZATION ---
    const map = L.map('map', { zoomControl: false }).setView([24.7136, 46.6753], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }).addTo(map);

    // --- PANEL AND VIEW ELEMENTS ---
    const panelMainView = document.getElementById('panel-main-view');
    const stationDetailView = document.getElementById('station-detail-view');
    const stationDetailBackButton = document.getElementById('station-detail-back-btn');
    const lineDetailView = document.getElementById('line-detail-view'); // New
    const lineDetailBackButton = document.getElementById('line-detail-back-btn'); // New
    const directionSelectionView = document.getElementById('direction-selection-view'); // New
    const directionSelectionBackButton = document.getElementById('direction-selection-back-btn'); // New

    const routeForm = document.getElementById('route-form');
    const startInput = document.getElementById('start-input');
    const endInput = document.getElementById('end-input');
    let activeRouteLayers = new L.FeatureGroup().addTo(map);
    let stationMarkersLayer = new L.FeatureGroup();
    let currentStationsLatLng = null;
    let stationsData = null;
    let allStations = [];
    let allLinesData = null; // Cache for the new lines data
    let previousView = null; // NEW: State to manage back navigation

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
            startInput.placeholder = "تقنية GPS ليست مدعومة على هذا النظام";
            return;
        }
        startInput.placeholder = "جاري البحث على موقعك...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const coordString = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                startInput.value = coordString;
                startInput.placeholder = "من إين ستغادر؟";
                map.setView([latitude, longitude], 13);
                currentStationsLatLng = { lat: latitude, lng: longitude };
                if (stationsTab.classList.contains('active')) {
                    fetchNearbyStations();
                }
            },
            () => {
                startInput.placeholder = "فشل الحصول على موقعك";
                console.warn("Unable to retrieve location.");
            }
        );
    }

    useMyLocationBtn.addEventListener('click', setLocationFromGPS);

    // --- FETCH NEARBY STATIONS ---
    async function fetchNearbyStations() {
        if (!currentStationsLatLng) {
            const stationsList = document.getElementById('stations-list');
            stationsList.innerHTML = '<p>اضغط على زر "إستخدم موقعي" أو إختر موقعاً على الخريطة للحصول على محطات قريبة.</p>';
            return;
        }

        const stationsList = document.getElementById('stations-list');
        stationsList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري البحث على محطات قريبة...</p></div>`;

        try {
            const response = await fetch(`${BACKEND_URL}/nearbystations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentStationsLatLng)
            });
            if (!response.ok) throw new Error(`تعذر الحصول على محطات: ${response.status}`);
            stationsData = await response.json();
            displayStations(stationsData);
        } catch (error) {
            console.error("Failed to fetch nearby stations:", error);
            stationsList.innerHTML = '<p style="color: red;">حدث خطأ أثناء تحميل المحطات.</p>';
        }
    }

    // --- COMPLETELY REVISED AND CORRECTED: Display Stations in List and on Map ---
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
            // CORRECTED: Match `station.name` from `/nearbystations` with `s.name` from `/api/stations`
            const fullStation = allStations.find(s => s.label === station.name);
            if (!fullStation) {
                console.warn(`Could not find coordinates for station: ${station.name}`);
                return; // Skip if no coords found
            }

            const { lat, lng } = fullStation;
            stationCoords.push([lat, lng]);

            const stationDiv = document.createElement('div');
            stationDiv.className = 'station-item';
            // CORRECTED: Use Math.round on duration, not duration/60, as API gives seconds.
            stationDiv.innerHTML = `
                <div class="station-icon">${station.type === 'bus' ? '🚌' : '🚇'}</div>
                <div class="station-details">
                    <h4>${station.name}</h4>
                    <p>تبعد ${Math.round(station.distance)} متراً</p>
                    <p>${Math.round(station.duration / 60)} دقيقة مشياً</p>
                </div>
            `;

            const marker = L.marker([lat, lng]).addTo(stationMarkersLayer);
            marker.bindPopup(`<b>${station.name}</b><br>تبعد ${Math.round(station.distance)} متراً`);

            // CORRECTED: A single, clean handler for both list items and markers.
            const handleStationClick = () => {
                // Highlight the corresponding item in the list
                document.querySelectorAll('.station-item').forEach(el => el.classList.remove('highlight'));
                stationDiv.classList.add('highlight');
                stationDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Pan map and open popup
                map.setView([lat, lng], 16);
                marker.openPopup();

                // Show the station detail view, which triggers the API call
                showStationDetails(station);
            };

            // Assign the single, correct handler to both elements
            stationDiv.addEventListener('click', handleStationClick);
            marker.on('click', handleStationClick);

            stationsList.appendChild(stationDiv);
        });

        if (currentStationsLatLng) {
            stationCoords.push([currentStationsLatLng.lat, currentStationsLatLng.lng]);
        }

        if (stationCoords.length > 0) {
            map.fitBounds(L.latLngBounds(stationCoords), { padding: [50, 50] });
        }
    }

    // --- STATION DETAIL VIEW LOGIC ---
    async function showStationDetails(station, fromView) {
        previousView = fromView; // Set where we came from
        showView(stationDetailView); // Use showView to hide others

        const stationDetailName = document.getElementById('station-detail-name');
        const stationDetailContent = document.getElementById('station-detail-content');

        stationDetailName.textContent = station.name;
        stationDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>جاري تحميل المسارات...</p></div>`;

        const cleanedStationName = station.name.replace(/\s*\((Bus|Metro)\)$/, '').trim();

        try {
            const response = await fetch(`${BACKEND_URL}/searchstation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_name: cleanedStationName })
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            renderStationLines(data);
        } catch (error) {
            console.error("Failed to fetch station details:", error);
            stationDetailContent.innerHTML = '<p style="color: red;">فشل تحميل معلومات عن المحطات.</p>';
        }
    }

     // --- NEW/UPDATED: LINES TAB LOGIC ---
    async function fetchAllLines() {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading all lines...</p></div>`;

        try {
            const [metroLinesRes, busLinesRes] = await Promise.all([
                fetch(`${BACKEND_URL}/mtrlines`),
                fetch(`${BACKEND_URL}/buslines`)
            ]);
            const metroLinesData = await metroLinesRes.json();
            const busLinesData = await busLinesRes.json();
            const metroLineNumbers = metroLinesData.lines.split(',');
            const busLineNumbers = busLinesData.lines.split(',');

            const metroPromises = metroLineNumbers.map(line =>
                fetch(`${BACKEND_URL}/viewmtr`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line })
                }).then(res => res.json()).then(data => ({ type: 'metro', line, data }))
            );

            const busPromises = busLineNumbers.map(line =>
                fetch(`${BACKEND_URL}/viewbus`, {
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
                    if (keys.length === 1) terminus = `المسار الدائري ${keys[0]}`;
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
            linesList.innerHTML = '<p style="color: red;">حدث خطأ أثناء تحميل المسارات.</p>';
        }
    }

    function renderLinesList(lines) {
        const linesList = document.getElementById('lines-list');
        linesList.innerHTML = '';
        if (!lines || lines.length === 0) {
            linesList.innerHTML = '<p>فشل الحصول على مسارات.</p>';
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
        metro: { 'المسار الأزرق': '#00aee6', 'المسار الأحمر': '#ef4938', 'المسار البرتقالي': '#f68d39', 'المسار الأصفر': '#ffd10a', 'المسار الأخضر': '#37b23f', 'المسار البتفسجي': '#984b9d', '1': '#00aee6', '2': '#ef4938', '3': '#f68d39', '4': '#ffd10a', '5': '#37b23f', '6': '#984b9d'  },
        bus: '#18a034',
        walk: '#6c757d',
        default: '#555'
    };

    // --- BACK BUTTONS AND VIEW MANAGEMENT ---
    function hideAllViews() {
        [panelMainView, stationDetailView, lineDetailView, directionSelectionView].forEach(v => v.classList.add('hidden'));
    }
    function showView(viewToShow) {
        hideAllViews();
        viewToShow.classList.remove('hidden');
    }

    function showMainPanel() {
        hideAllViews();
        stationMarkersLayer.clearLayers();
        map.addLayer(activeRouteLayers);
        panelMainView.classList.remove('hidden');
        // Fit map to a default view or last known bounds if necessary
    }

    stationDetailBackButton.addEventListener('click', showMainPanel);
    lineDetailBackButton.addEventListener('click', showMainPanel);
    directionSelectionBackButton.addEventListener('click', showMainPanel);

    // --- NEW: LINE DETAIL LOGIC ---
    function handleLineClick(line) {
        const isRingRoute = line.terminus.startsWith('المسار الدائري ');

        if (!isRingRoute) {
            showDirectionSelection(line);
        }
        else {
            // For metro or ring routes, determine direction from the label
            const directionKey = line.type === 'metro' ? line.terminus.split(' - ')[0] : null;
            showLineDetails(line, directionKey);
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
            <button class="direction-option" data-direction-key="${forwardKey}">${start} ← ${end}</button>
            <button class="direction-option" data-direction-key="${backwardKey}">${end} ← ${start}</button>
        `;

        content.querySelectorAll('.direction-option').forEach(button => {
            button.addEventListener('click', (e) => {
                showLineDetails(line, e.target.dataset.directionKey);
            });
        });
    }

    async function showLineDetails(line, directionKey = null) {
        showView(lineDetailView);

        // Find the title element once.
        const lineDetailName = document.getElementById('line-detail-name');

        // Clear its previous contents to prevent stacking elements.
        lineDetailName.innerHTML = '';
        lineDetailName.removeAttribute('style'); // Remove inline styles if any

        // Recreate the badge and terminus inside the title element.
        const badge = document.createElement('div');
        badge.className = 'line-detail-badge';
        badge.textContent = line.line;
        const color = line.type === 'metro' ? (lineColors.metro[line.line] || lineColors.default) : lineColors.bus;
        badge.style.backgroundColor = color;

        const terminus = document.createElement('h4');
        terminus.className = 'line-detail-terminus';
        terminus.textContent = line.terminus;

        // Append the new elements.
        lineDetailName.appendChild(badge);
        lineDetailName.appendChild(terminus);

        const lineDetailContent = document.getElementById('line-detail-content');
        lineDetailContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading stations...</p></div>`;

        try {
            const endpoint = line.type === 'metro' ? '/viewmtr' : '/viewbus';
            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: line.line })
            });
            if (!response.ok) throw new Error('فشل الحصول على بيانات المسار');
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
            lineDetailContent.innerHTML = '<p style="color: red;">فشل تحميل تفاصيل المسار.</p>';
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
                    const mockStation = { name: station.label, type: station.type };
                    showStationDetails(mockStation, lineDetailView);
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

    function renderStationLines(data) {
        const stationDetailContent = document.getElementById('station-detail-content');
        stationDetailContent.innerHTML = '';

        if (data.metro_lines && data.metro_lines.length > 0) {
            const metroContainer = document.createElement('div');
            metroContainer.className = 'line-list-container';
            metroContainer.innerHTML = `<h4>🚇 مسارات قطار</h4>`;
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
            busContainer.innerHTML = `<h4>🚌 مسارات حافلات</h4>`;
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
            stationDetailContent.innerHTML = '<p>لا يوجد مسارات لهذه المحطة.</p>';
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

    // --- CUSTOM AUTOCOMPLETE IMPLEMENTATION ---
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
                .map(station => ({ type: 'station', name: station.label, lat: station.lat, lng: station.lng }));
        }

        async getOSMSuggestions(query) {
            try {
                const params = new URLSearchParams({ q: `${query}, Riyadh`, format: 'json', addressdetails: 1, limit: 4, viewbox: '46.2,25.2,47.2,24.2', bounded: 1 });
                const response = await fetch(`${OSM_NOMINATIM_URL}?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return data.map(item => ({ type: 'map', name: formatOsmName(item), lat: parseFloat(item.lat), lng: parseFloat(item.lon) }));
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
                let contentHtml = item.type === 'map' ? `<div class="suggestion-text"><div class="suggestion-main">${item.name.main}</div>${item.name.secondary ? `<div class="suggestion-secondary">${item.name.secondary}</div>` : ''}</div>` : `<div class="suggestion-text">${item.name}</div>`;
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

        selectItem(index) {
            const item = this.currentSuggestions[index];
            if (!item) return;
            this.input.value = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
            this.hide();
        }

        onDocumentClick(e) {
            if (!this.input.contains(e.target) && !this.container.contains(e.target)) this.hide();
        }
        show() { this.container.style.display = 'block'; }
        hide() { this.container.style.display = 'none'; }
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

                // UPDATED: Add click listener to show station details
                stationItem.addEventListener('click', () => {
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

    async function initializeAutocomplete() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/stations`);
            if (!response.ok) throw new Error(`فشل الحصول على المحطات: ${response.status}`);
            allStations = await response.json();
        } catch (error) {
            console.error("Could not initialize autocomplete:", error);
        }
        new CustomAutocomplete(startInput, allStations);
        new CustomAutocomplete(endInput, allStations);
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

    // --- ROUTE HANDLING ---
    async function handleFormSubmit(event) {
        event.preventDefault();
        await fetchAndDisplayRoute(startInput.value, endInput.value);
    }

    async function fetchAndDisplayRoute(start, end) {
        const detailsContainer = document.getElementById('route-details');
        const findRouteBtn = document.querySelector('#route-form button[type="submit"]');
        const useMyLocationBtn = document.getElementById('use-my-location');

        findRouteBtn.style.display = 'none';
        useMyLocationBtn.style.display = 'none';
        detailsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div><p>نعمل على إيجاد أفضل مسار لك...</p></div>`;

        if (!start || !end) {
            detailsContainer.innerHTML = '<p style="color: orange;">الرجاء إدخال الأصل والوجهة.</p>';
            findRouteBtn.style.display = 'block';
            useMyLocationBtn.style.display = 'block';
            return;
        }

        const startCoords = parseCoordinates(start);
        const endCoords = parseCoordinates(end);
        let endpoint = '', body = {};

        if (startCoords && endCoords) {
            endpoint = `${BACKEND_URL}/route_from_coords`;
            body = { start_lat: startCoords.lat, start_lng: startCoords.lng, end_lat: endCoords.lat, end_lng: endCoords.lng };
        } else if (!startCoords && !endCoords) {
            endpoint = `${BACKEND_URL}/route`;
            body = { start, end };
        } else {
            detailsContainer.innerHTML = '<p style="color: red;">خطأ: يرجى استخدام اسمي محطتين أو مجموعتين من الإحداثيات. لا يتم دعم المدخلات المختلطة.</p>';
            findRouteBtn.style.display = 'block';
            useMyLocationBtn.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || `An unknown error occurred (Status: ${response.status}).`);
            displayRoute(data);
        } catch (error) {
            console.error("فشل العثور على طريق:", error);
            detailsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        } finally {
            findRouteBtn.style.display = 'block';
            useMyLocationBtn.style.display = 'block';
        }
    }

    function displayRoute(data) {
        activeRouteLayers.clearLayers();
        const detailsContainer = document.getElementById('route-details');
        detailsContainer.innerHTML = '';

        if (data.error || !data.routes || data.routes.length === 0) {
            detailsContainer.innerHTML = `<p>${data.error || 'No routes found.'}</p>`;
            return;
        }

        const route = data.routes[0];
        const allCoords = [];
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'route-summary';
        summaryDiv.innerHTML = `<p>${Math.round(route.total_time / 60)} دقيقة</p><span>إجمالي مدة الرحلة</span>`;
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
            }
            const latLngs = segment.coordinates.map(c => [c.lat, c.lng]);
            allCoords.push(...latLngs);
            L.polyline(latLngs, { color: style.color, weight: 6, opacity: 0.8, ...style.lineStyle }).addTo(activeRouteLayers);

            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'instruction';
            const durationMins = Math.round(segment.duration / 60);
            let instructionTitle = '', instructionDetails = '', endPointName = '';

            if (segment.type === 'walk') {
                endPointName = segment.to || "وجهتك";
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
            }
            instructionDiv.innerHTML = `<div class="instruction-icon">${style.icon}</div><div class="instruction-details"><h3>${instructionTitle}</h3><p>${instructionDetails}</p>${segment.type !== 'walk' ? `<p>إنزل عند محطة ${endPointName}</p>` : ''}</div>`;
            detailsContainer.appendChild(instructionDiv);
        });

        if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
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
        const coordString = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `<div style="text-align: center;"><strong>موقع على الخريطة</strong><br><small>${coordString}</small><div style="margin-top: 8px;"><button id="popup-set-origin" class="popup-button">تعيين كأصل</button><button id="popup-set-destination" class="popup-button">تعيين كوجهة</button><button id="popup-set-stations" class="popup-button">محطات قريبة</button></div></div>`;
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
    await initializeAutocomplete();
    setLocationFromGPS();
    map.removeLayer(stationMarkersLayer);
};
