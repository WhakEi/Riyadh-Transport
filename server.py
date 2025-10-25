from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import unicodedata
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
import heapq
import os
import requests
from datetime import datetime, timezone
import re
import pytz

app = Flask(__name__)
CORS(app)

# Configuration
METRO_LINES_FILE = 'metro_lines.json'
EXC_DIR = 'exc'
GEOCODED_DIR = 'geocoded_stops'
WALKING_DISTANCE = 500  # meters

# Defined metro transfer stations (normalized names)
METRO_TRANSFER_STATIONS = {
    "Kafd": ["1", "4", "6"],
    "Sabic": ["4", "6"],
    "Uthman Bin Affan Road": ["4", "6"],
    "Ar Rabi": ["4", "6"],
    "Stc": ["1", "2"],
    "An Naseem": ["3", "6"],
    "Ministry Of Education": ["2", "5"],
    "National Museum": ["1", "5"],
    "Qasr Al Hokm": ["1", "3"],
}


# Data storage
STATIONS = {}
adjacency = {}
line_stations = {}
station_to_lines = {}
LINE_ENGLISH_NAMES = {}

# Helper functions
def normalize_name(name):
    return unicodedata.normalize('NFKC', name.strip()).title()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    φ1 = radians(lat1)
    φ2 = radians(lat2)
    Δφ = radians(lat2 - lat1)
    Δλ = radians(lon2 - lon1)
    a = sin(Δφ/2)**2 + cos(φ1)*cos(φ2)*sin(Δλ/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

def clean_line_name(line):
    """Remove direction suffixes and line type prefixes."""
    if '_dir' in line:
        line = line.split('_dir')[0]
    return line.replace('bus_', '').replace('metro_', '')

def strip_numbers_and_trim(name):
    """Removes all digits from a string and trims whitespace."""
    if not isinstance(name, str):
        return ""
    # Use regex to substitute any digit with an empty string, then strip whitespace
    return re.sub(r'\d+', '', name).strip()

def resolve_bus_destination(line_number, api_destination):
    """
    Translates an API destination (e.g., "Station 01") to the actual
    final destination of the bus line (e.g., "Downtown").
    Appends "Ring" if it's a ring route.
    """
    try:
        bus_file_path = Path(EXC_DIR) / f"bus_{line_number}.json"
        if not bus_file_path.exists():
            return api_destination

        with open(bus_file_path, 'r', encoding='utf-8') as f:
            line_data = json.load(f)

        direction_keys = list(line_data.keys())

        # Case 1: Ring route (only one direction/key in the file)
        if len(direction_keys) == 1:
            # Use an f-string to combine the direction name and the word "Ring"
            return f"{direction_keys[0]} Ring"

        # Case 2: Directional route
        base_api_dest = strip_numbers_and_trim(api_destination)

        for direction_key in direction_keys:
            stations_in_direction = line_data.get(direction_key, [])
            if not stations_in_direction:
                continue

            last_station_in_list = stations_in_direction[-1]
            base_last_station = strip_numbers_and_trim(last_station_in_list)

            if base_api_dest == base_last_station:
                return direction_key

        return api_destination
    except Exception as e:
        print(f"Error resolving destination for line {line_number}: {e}")
        return api_destination

def load_metro_data():
    try:
        with open(METRO_LINES_FILE) as f:
            metro_config = json.load(f)

        for line_info in metro_config:
            line_num = line_info['line_number']
            line_key = f"metro_{line_num}"

            if 'name' in line_info:
                LINE_ENGLISH_NAMES[line_key] = line_info['name']

            stations_file = f"line_{line_num}_stations.json"
            if not os.path.exists(stations_file):
                print(f"⚠ Missing metro file: {stations_file}")
                continue

            with open(stations_file, 'r', encoding='utf-8') as f:
                stations = json.load(f)

            normalized_stations_in_line = []
            for s in stations:
                name = normalize_name(s['name'])
                if "Transportation Center" in name:
                    name += " (Metro)"
                elif not name.endswith("(Metro)"):
                    name += " (Metro)"

                lat = float(s['latitude'])
                lng = float(s['longitude'])

                # Extract the station ID from the URL
                station_id = None
                station_url = s.get('station_details_url')
                if station_url:
                    try:
                        # The ID is the last part of the URL path
                        station_id = station_url.strip().split('/')[-1]
                    except IndexError:
                        print(f"Could not parse station ID from URL: {station_url}")

                if not (24.0 < lat < 25.5 and 46.0 < lng < 47.5):
                    print(f"Invalid coordinates for {name}: {lat},{lng}")
                    continue

                normalized_stations_in_line.append(name)
                # Store the station_id along with other data
                STATIONS[name] = {'lat': lat, 'lng': lng, 'type': 'metro', 'station_id': station_id}
                station_to_lines.setdefault(name, []).append(line_key)

            line_stations[line_key] = normalized_stations_in_line
            print(f"Loaded Metro Line {line_num} with {len(normalized_stations_in_line)} stations")

    except Exception as e:
        print(f"Error loading metro data: {str(e)}")

def load_bus_data():
    for bus_file in Path(EXC_DIR).glob('bus_*.json'):
        try:
            line_num = bus_file.stem.split('_')[1]
            line_key_base = f"bus_{line_num}"

            with open(bus_file) as f:
                bus_stops = json.load(f)

            # Load geocoded data and create a version with normalized keys for reliable lookups
            geo_file = Path(GEOCODED_DIR) / f"{line_num}.json"
            normalized_geo_data = {}
            if geo_file.exists():
                with open(geo_file, 'r', encoding='utf-8') as f:
                    original_geo_data = json.load(f)
                    for key, value in original_geo_data.items():
                        # Normalize the key from the geocoded file
                        normalized_key = normalize_name(key)
                        normalized_geo_data[normalized_key] = value

            # We'll do the same for the 'missing' file just in case
            missing_file = Path(GEOCODED_DIR) / 'missing.json'
            normalized_missing_data = {}
            if missing_file.exists():
                with open(missing_file, 'r', encoding='utf-8') as f:
                    original_missing_data = json.load(f)
                    for key, value in original_missing_data.items():
                        normalized_key = normalize_name(key)
                        normalized_missing_data[normalized_key] = value

            for direction_idx, (direction_name, stations_in_dir) in enumerate(bus_stops.items()):
                line_key = f"{line_key_base}_dir{direction_idx}"
                normalized_station_list = []
                for raw_name in stations_in_dir:
                    # This is the final name, e.g., "Station Name (Bus)"
                    full_normalized_name = normalize_name(raw_name)
                    if "Transportation Center" in full_normalized_name:
                        full_normalized_name += " (Bus)"
                    elif not full_normalized_name.endswith("(Bus)"):
                        full_normalized_name += " (Bus)"

                    # Use a normalized version of the raw name for the lookup key
                    lookup_key = normalize_name(raw_name)
                    coords = normalized_geo_data.get(lookup_key, normalized_missing_data.get(lookup_key, {}))

                    lat = float(coords.get('lat', 0))
                    lng = float(coords.get('lng', 0))
                    station_id = coords.get('id')

                    if not (24.0 < lat < 25.5 and 46.0 < lng < 47.5):
                        print(f"Invalid coordinates for {full_normalized_name} in bus {line_num}, direction {direction_name}")
                        continue

                    # Use the full name with suffix for the main STATIONS dictionary key
                    if full_normalized_name not in STATIONS:
                        STATIONS[full_normalized_name] = {
                            'lat': lat,
                            'lng': lng,
                            'type': 'bus',
                            'source': 'geo' if lat + lng != 0 else 'missing',
                            'station_id': station_id
                        }
                    else:
                        # Update existing entry if it's missing an ID and we just found one
                        if not STATIONS[full_normalized_name].get('station_id') and station_id:
                            STATIONS[full_normalized_name]['station_id'] = station_id

                    normalized_station_list.append(full_normalized_name)
                    station_to_lines.setdefault(full_normalized_name, []).append(line_key)

                line_stations[line_key] = normalized_station_list
                print(f"Loaded Bus Line {line_num} direction {direction_name} with {len(normalized_station_list)} stops")

        except Exception as e:
            print(f"Error loading {bus_file}: {str(e)}")

# Graph building
def build_connections():
    # Metro connections (bidirectional)
    for line, stations in line_stations.items():
        if line.startswith('metro_'):
            for i in range(len(stations)-1):
                a, b = stations[i], stations[i+1]
                key = f"{a}|{line}"
                next_key = f"{b}|{line}"
                adjacency.setdefault(key, []).append(next_key)
                adjacency.setdefault(next_key, []).append(key)

    # Bus connections (unidirectional)
    for line, stations in line_stations.items():
        if line.startswith('bus_'):
            for i in range(len(stations)-1):
                a, b = stations[i], stations[i+1]
                key = f"{a}|{line}"
                adjacency.setdefault(key, []).append(f"{b}|{line}")

    # Transfers between lines at the same station
    for station_name_full, lines in station_to_lines.items():
        station_name_base = station_name_full.replace(" (Metro)", "").replace(" (Bus)", "")

        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                line_a = lines[i]
                line_b = lines[j]

                is_metro_a = line_a.startswith('metro_')
                is_metro_b = line_b.startswith('metro_')

                # Logic for allowing transfers:
                allow_transfer = False
                if is_metro_a and is_metro_b:
                    # Metro-to-Metro: Only at designated transfer stations
                    if station_name_base in METRO_TRANSFER_STATIONS:
                        allowed_lines = METRO_TRANSFER_STATIONS[station_name_base]
                        line_num_a = clean_line_name(line_a)
                        line_num_b = clean_line_name(line_b)
                        if line_num_a in allowed_lines and line_num_b in allowed_lines:
                            allow_transfer = True
                else:
                    # Bus-to-Bus, Bus-to-Metro, Metro-to-Bus: Always allowed at the same station
                    allow_transfer = True

                if allow_transfer:
                    node_a = f"{station_name_full}|{line_a}"
                    node_b = f"{station_name_full}|{line_b}"
                    adjacency.setdefault(node_a, []).append(node_b)
                    adjacency.setdefault(node_b, []).append(node_a)

    # Walking connections
    connection_count = 0
    all_stations = list(STATIONS.items())
    WALKING_DISTANCE = 500

    stations = [(name, data) for name, data in STATIONS.items()]

    for i, (name1, data1) in enumerate(stations):
        for j, (name2, data2) in enumerate(stations[i+1:], start=i+1):
            # Don't create walking connections between two metro stations
            if data1['type'] == 'metro' and data2['type'] == 'metro':
                continue

            distance = haversine(data1['lat'], data1['lng'], data2['lat'], data2['lng'])

            if distance <= WALKING_DISTANCE:
                for line in station_to_lines.get(name1, []):
                    adjacency.setdefault(f"{name1}|{line}", []).append(f"walk|{name2}")
                for line in station_to_lines.get(name2, []):
                    adjacency.setdefault(f"{name2}|{line}", []).append(f"walk|{name1}")
                connection_count += 1

    print(f"Total walking connections: {connection_count}")

def fetch_metro_api_data(station_id):
    """
    Fetches arrival data from the external API for a given metro station ID.
    This function mimics the request sent by the official website.
    """
    try:
        api_url = 'https://sitprd.rpt.sa/en/stationdetails'
        # These parameters are part of the API's URL query string
        params = {
            'p_p_id': 'com_rcrc_stations_RcrcStationDetailsPortlet_INSTANCE_53WVbOYPfpUF',
            'p_p_lifecycle': '2',
            'p_p_resource_id': '/departure-monitor'
        }
        # This is the data sent in the POST request body
        payload = {
            '_com_rcrc_stations_RcrcStationDetailsPortlet_INSTANCE_53WVbOYPfpUF_busStopId': station_id
        }
        # These headers make our request look like it's coming from a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://sitprd.rpt.sa',
            'Referer': f'https://sitprd.rpt.sa/en/stationdetails/tags/{station_id}'
        }

        response = requests.post(api_url, params=params, headers=headers, data=payload, timeout=10)
        response.raise_for_status()  # This will raise an error for bad status codes (like 404 or 500)
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"Error fetching arrival times for station ID {station_id}: {e}")
        return None

def fetch_bus_api_data(station_id):
    """
    Fetches arrival data from the external API for a given bus stop ID.
    This function mimics the request for bus route details.
    """
    try:
        api_url = 'https://sitprd.rpt.sa/en/routedetails'
        # These parameters are part of the API's URL query string
        params = {
            'p_p_id': 'com_rcrc_routes_RcrcRoutesPortlet_INSTANCE_eT4Qu3MnTe35',
            'p_p_lifecycle': '2',
            'p_p_resource_id': '/departure-monitor'
        }
        # This is the data sent in the POST request body
        payload = {
            '_com_rcrc_routes_RcrcRoutesPortlet_INSTANCE_eT4Qu3MnTe35_busStopId': station_id
        }
        # These headers make our request look like it's coming from a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://sitprd.rpt.sa',
            'Referer': 'https://sitprd.rpt.sa/en/routedetails' # A generic Referer is usually sufficient
        }

        response = requests.post(api_url, params=params, headers=headers, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"Error fetching arrival times for bus stop ID {station_id}: {e}")
        return None

@app.route('/metro_arrivals', methods=['POST'])
def get_metro_arrivals():
    """Endpoint to get real-time metro arrival information for a station."""
    try:
        data = request.get_json()
        station_name = data.get('station_name')

        if not station_name:
            return jsonify({'error': 'Missing station_name'}), 400

        # Check if public transport is closed for the night
        try:
            ast_tz = pytz.timezone('Asia/Riyadh')
            now_ast = datetime.now(ast_tz).time() # We only need the time part

            # Define the start and end of the closing period
            # From 2:30 AM up to (but not including) 4:50 AM
            closed_start = datetime.strptime("02:30", "%H:%M").time()
            closed_end = datetime.strptime("04:50", "%H:%M").time()

            if closed_start <= now_ast < closed_end:
                return jsonify({'arrivals': 'closed', 'station_name': station_name})
        except Exception as e:
            # If timezone logic fails for any reason, log it but continue
            print(f"Timezone check failed: {e}")

        normalized_lookup_name = f"{normalize_name(station_name)} (Metro)"
        station_info = STATIONS.get(normalized_lookup_name)

        if not station_info or station_info.get('type') != 'metro':
            return jsonify({'error': f'Metro station "{station_name}" not found'}), 404

        station_id = station_info.get('station_id')
        if not station_id:
            # If the station exists but has no ID, return null for arrivals.
            return jsonify({'arrivals': None, 'station_name': station_name})

        api_data = fetch_metro_api_data(station_id)

        if api_data is None:
            return jsonify({'error': 'Failed to fetch arrival times from external service'}), 502

        arrivals = []
        now_utc = datetime.now(timezone.utc)

        for item in api_data:
            time_str = item.get('actualDepartureTimePlanned')
            if not time_str:
                continue

            try:
                arrival_time = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                time_diff_seconds = (arrival_time - now_utc).total_seconds()

                if time_diff_seconds >= 0:
                    arrivals.append({
                        'line': item.get('number'),
                        'destination': item.get('destination'),
                        'minutes_until': round(time_diff_seconds / 60)
                    })
            except (ValueError, TypeError):
                print(f"Could not parse time: {time_str}")
                continue

        arrivals.sort(key=lambda x: x['minutes_until'])

        return jsonify({'station_name': station_name, 'arrivals': arrivals})

    except Exception as e:
        print(f"Error in /metro_arrivals endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/bus_arrivals', methods=['POST'])
def get_bus_arrivals():
    """Endpoint to get real-time bus arrival information for a station."""
    try:
        data = request.get_json()
        station_name = data.get('station_name')

        if not station_name:
            return jsonify({'error': 'Missing station_name'}), 400

        # Check if public transport is closed for the night
        try:
            ast_tz = pytz.timezone('Asia/Riyadh')
            now_ast = datetime.now(ast_tz).time() # We only need the time part
            closed_start = datetime.strptime("02:30", "%H:%M").time()
            closed_end = datetime.strptime("04:50", "%H:%M").time()

            if closed_start <= now_ast < closed_end:
                return jsonify({'arrivals': 'closed', 'station_name': station_name})
        except Exception as e:
            # If timezone logic fails for any reason, log it but continue
            print(f"Timezone check failed: {e}")

        normalized_lookup_name = f"{normalize_name(station_name)} (Bus)"
        station_info = STATIONS.get(normalized_lookup_name)

        if not station_info or station_info.get('type') != 'bus':
            return jsonify({'error': f'Bus stop "{station_name}" not found'}), 404

        station_id = station_info.get('station_id')
        if not station_id:
            return jsonify({'arrivals': None, 'station_name': station_name})

        api_data = fetch_bus_api_data(station_id)

        if api_data is None:
            return jsonify({'error': 'Failed to fetch arrival times from external service'}), 502

        arrivals = []
        now_utc = datetime.now(timezone.utc)

        for item in api_data:
            time_str = item.get('actualDepartureTimePlanned')
            if not time_str:
                continue

            try:
                arrival_time = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                time_diff_seconds = (arrival_time - now_utc).total_seconds()

                if time_diff_seconds >= 0:
                    # Get the line number and the destination from the API
                    line_number = item.get('number')
                    api_destination = item.get('destination')

                    # Resolve the true destination using our new logic
                    correct_destination = resolve_bus_destination(line_number, api_destination)

                    arrivals.append({
                        'line': line_number,
                        # Use the corrected destination in the final output
                        'destination': correct_destination,
                        'minutes_until': round(time_diff_seconds / 60)
                    })
            except (ValueError, TypeError):
                print(f"Could not parse time: {time_str}")
                continue

        arrivals.sort(key=lambda x: x['minutes_until'])

        return jsonify({'station_name': station_name, 'arrivals': arrivals})

    except Exception as e:
        print(f"Error in /bus_arrivals endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/nearbystations', methods=['POST'])
def nearby_stations_endpoint():
    try:
        data = request.get_json()
        lat = data.get('lat')
        lng = data.get('lng')

        if None in (lat, lng):
            return jsonify({'error': 'Missing lat/lng coordinates'}), 400

        nearby = find_nearby_stations(float(lat), float(lng), max_distance=1500)

        # Enhance with station type
        for station in nearby:
            station_data = STATIONS.get(station['name'], {})
            station['type'] = station_data.get('type')

        return jsonify(nearby)

    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid coordinate format'}), 400
    except Exception as e:
        print(f"Nearby stations error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/searchstation', methods=['POST'])
def search_station_endpoint():
    try:
        data = request.get_json()
        station_name = data.get('station_name')

        if not station_name:
            return jsonify({'error': 'Missing station_name'}), 400

        normalized_name = normalize_name(station_name)

        # Check for both metro and bus versions of the name
        metro_name = f"{normalized_name} (Metro)"
        bus_name = f"{normalized_name} (Bus)"

        metro_lines = station_to_lines.get(metro_name, [])
        bus_lines = station_to_lines.get(bus_name, [])

        # Clean up line numbers
        cleaned_metro_lines = sorted(list(set([clean_line_name(line) for line in metro_lines])))
        cleaned_bus_lines = sorted(list(set([clean_line_name(line) for line in bus_lines])))

        if not cleaned_metro_lines and not cleaned_bus_lines:
            return jsonify({'error': f'Station "{station_name}" not found'}), 404

        return jsonify({
            'station_name': station_name,
            'metro_lines': cleaned_metro_lines,
            'bus_lines': cleaned_bus_lines
        })

    except Exception as e:
        print(f"Search station error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/viewbus', methods=['POST'])
def view_line_endpoint():
    try:
        data = request.get_json()
        reqline = data.get('line')

        if not reqline:
            return jsonify({'error': 'Missing line number in request'}), 400

        # Construct the file path safely
        bus_file_path = Path(EXC_DIR) / f"bus_{reqline}.json"

        # Check if the file exists
        if not bus_file_path.exists():
            return jsonify({'error': f'Line {reqline} not found'}), 404

        # Open the file and load the JSON data
        with open(bus_file_path, 'r', encoding='utf-8') as f:
            line_data = json.load(f)

        # Return the contents of the file
        return jsonify(line_data)

    except Exception as e:
        print(f"View line error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500



@app.route('/viewmtr', methods=['POST'])
def view_mtr_endpoint():
    try:
        data = request.get_json()
        reqline = data.get('line')

        if not reqline:
            return jsonify({'error': 'Missing line number in request'}), 400

        # Construct the file path using Path for safety and consistency
        metro_file_path = Path(f"line_{reqline}_stations.json")

        # Check if the file exists
        if not metro_file_path.exists():
            return jsonify({'error': f'Metro line {reqline} not found'}), 404

        # Open the file and load the JSON data
        with open(metro_file_path, 'r', encoding='utf-8') as f:
            line_data = json.load(f)

        # Extract only the "name" value from each station dictionary in the list
        station_names = [station.get('name') for station in line_data if 'name' in station]

        # Return the list of station names
        return jsonify({'stations': station_names})

    except Exception as e:
        print(f"View metro line error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Route finding endpoint with optimizations
@app.route('/route', methods=['POST'])
def find_route():
    try:
        data = request.get_json()
        start = normalize_name(data.get('start', ''))
        end = normalize_name(data.get('end', ''))

        print(f"Route request: {start} -> {end}")

        # Validate stations exist
        if start not in STATIONS or end not in STATIONS:
            return jsonify({'error': 'Invalid stations'}), 400

        # Initialize priority queue with all possible start lines
        heap = []
        start_lines = station_to_lines.get(start, [])
        if not start_lines:
            return jsonify({'خطأ': 'فشل توصيل نقطة الأصل'}), 400

        for line in start_lines:
            heapq.heappush(heap, (0, 0, [f"{start}|{line}"]))

        visited = set()
        max_iterations = 100000  # Increased to allow complex routes
        found = False

        while heap and not found and len(visited) < max_iterations:
            cost, transfers, path = heapq.heappop(heap)
            current_node = path[-1]

            # Parse current node
            if '|' in current_node:
                current_station, current_line = current_node.split('|')
            else:  # Walking node
                current_station = current_node.replace('walk|', '')
                current_line = 'walk'

            if current_station == end:
                print(f"Route found: {path}")
                return jsonify({'routes': [format_route(path)],
                                'warning': 'This API is deprecated and may be disabled in the future'})

            if current_node in visited:
                continue
            visited.add(current_node)

            # Get all possible next steps
            for neighbor in adjacency.get(current_node, []):
                # Handle walking connections
                if neighbor.startswith('walk|'):
                    target_station = neighbor.split('|')[1]
                    new_cost = cost + 50  # Low walking cost
                    new_transfers = transfers
                    new_path = path + [neighbor]

                    # After walking, consider all lines at target station
                    for target_line in station_to_lines.get(target_station, []):
                        transition_node = f"{target_station}|{target_line}"
                        heapq.heappush(
                            heap,
                            (new_cost + 10, new_transfers, new_path + [transition_node])
                        )

                # Handle regular line connections
                else:
                    neighbor_station, neighbor_line = neighbor.split('|')
                    transfer_occurred = current_line != neighbor_line
                    new_cost = cost + (100 if transfer_occurred else 10)
                    new_transfers = transfers + (1 if transfer_occurred else 0)
                    heapq.heappush(heap, (new_cost, new_transfers, path + [neighbor]))

        return jsonify({'error': 'Internal server error'}), 500

    except Exception as e:
        print(f"Route error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Add new helper functions
def find_route_path(start, end):
    """Core route finding between two stations, returns path if exists."""
    heap = []
    start_lines = station_to_lines.get(start, [])
    if not start_lines:
        return None

    for line in start_lines:
        heapq.heappush(heap, (0, 0, [f"{start}|{line}"]))

    visited = set()
    max_iterations = 100000
    found = False
    best_path = None

    while heap and not found and len(visited) < max_iterations:
        cost, transfers, path = heapq.heappop(heap)
        current_node = path[-1]

        # Parse current node
        if '|' in current_node:
            current_station, current_line = current_node.split('|')
        else:
            current_station = current_node.replace('walk|', '')
            current_line = 'walk'

        if current_station == end:
            best_path = path
            found = True
            break

        if current_node in visited:
            continue
        visited.add(current_node)

        for neighbor in adjacency.get(current_node, []):
            if neighbor.startswith('walk|'):
                target_station = neighbor.split('|')[1]
                new_cost = cost + 50
                new_transfers = transfers
                new_path = path + [neighbor]

                for target_line in station_to_lines.get(target_station, []):
                    transition_node = f"{target_station}|{target_line}"
                    heapq.heappush(heap, (new_cost + 10, new_transfers, new_path + [transition_node]))
            else:
                neighbor_station, neighbor_line = neighbor.split('|')
                transfer_occurred = current_line != neighbor_line
                new_cost = cost + (100 if transfer_occurred else 10)
                new_transfers = transfers + (1 if transfer_occurred else 0)
                heapq.heappush(heap, (new_cost, new_transfers, path + [neighbor]))

    return best_path

def find_nearby_stations(lat, lng, max_distance=1000):
    """Find stations within max_distance meters from given coordinates."""
    nearby = []
    for name, data in STATIONS.items():
        station_lat = data['lat']
        station_lng = data['lng']
        distance = haversine(lat, lng, station_lat, station_lng)
        if distance <= max_distance:
            duration = distance / 1.3  # Walking time in seconds (1.4 m/s)
            nearby.append({
                'name': name,
                'distance': distance,
                'duration': duration
            })
    # Sort by ascending distance
    nearby.sort(key=lambda x: x['distance'])
    return nearby

# Add new endpoint for coordinate-based routing
@app.route('/route_from_coords', methods=['POST'])
def route_from_coordinates():
    try:
        data = request.get_json()
        start_lat = data.get('start_lat')
        start_lng = data.get('start_lng')
        end_lat = data.get('end_lat')
        end_lng = data.get('end_lng')

        # Validate coordinates
        if None in (start_lat, start_lng, end_lat, end_lng):
            return jsonify({'error': 'Missing coordinates'}), 400

        start_lat = float(start_lat)
        start_lng = float(start_lng)
        end_lat = float(end_lat)
        end_lng = float(end_lng)

        # Iteratively find nearby stations, expanding search radius
        start_stations, end_stations = [], []
        for radius in [250, 500, 1000, 2000]:
            if not start_stations:
                start_stations = find_nearby_stations(start_lat, start_lng, radius)
            if not end_stations:
                end_stations = find_nearby_stations(end_lat, end_lng, radius)
            if start_stations and end_stations:
                break

        if not start_stations:
            return jsonify({'error': 'No stations within 2km of start point'}), 404
        if not end_stations:
            return jsonify({'error': 'No stations within 2km of end point'}), 404

        best_route = None
        min_total_time = float('inf')

        # Try top 3 nearest stations for efficiency
        for start_info in start_stations[:3]:
            for end_info in end_stations[:3]:
                start_name = start_info['name']
                end_name = end_info['name']

                # Find path between stations
                path = find_route_path(start_name, end_name)
                if not path:
                    continue

                # Format the base route
                formatted_route = format_route(path)
                if not formatted_route:
                    continue

                # Create walking segments
                walk_start = {
                    'type': 'walk',
                    'from': {'lat': start_lat, 'lng': start_lng},
                    'to': start_name,
                    'distance': start_info['distance'],
                    'duration': start_info['duration'],
                    'coordinates': [
                        {'lat': start_lat, 'lng': start_lng},
                        {'lat': STATIONS[start_name]['lat'], 'lng': STATIONS[start_name]['lng']}
                    ]
                }
                walk_end = {
                    'type': 'walk',
                    'from': end_name,
                    'to': {'lat': end_lat, 'lng': end_lng},
                    'distance': end_info['distance'],
                    'duration': end_info['duration'],
                    'coordinates': [
                        {'lat': STATIONS[end_name]['lat'], 'lng': STATIONS[end_name]['lng']},
                        {'lat': end_lat, 'lng': end_lng}
                    ]
                }

                # Combine segments
                total_time = formatted_route['total_time'] + walk_start['duration'] + walk_end['duration']
                combined_segments = [walk_start] + formatted_route['segments'] + [walk_end]

                if total_time < min_total_time:
                    min_total_time = total_time
                    best_route = {
                        'segments': combined_segments,
                        'total_time': total_time
                    }

        if best_route:
            return jsonify({'routes': [best_route]})
        else:
            return jsonify({'error': 'No route found between nearby stations'}), 404

    except ValueError:
        return jsonify({'error': 'Invalid coordinate values'}), 400
    except Exception as e:
        print(f"Coordinate route error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Route formatting
def format_route(path):
    # Pass 1: Generate initial segments
    segments = []
    current_segment = None

    def append_valid_segment(segment):
        if not segment:
            return
        is_valid_trip = (len(segment['stations']) > 1 and
                         segment['stations'][0] != segment['stations'][-1])
        if is_valid_trip:
            segments.append(segment)

    for i, node in enumerate(path):
        if node.startswith('walk|'):
            append_valid_segment(current_segment)
            current_segment = None

            if i == 0: continue # Should not happen, but for safety

            from_station = path[i-1].split('|')[0]
            to_station = node.split('|')[1]

            if from_station == to_station: continue

            segments.append({
                'type': 'walk',
                'from': from_station,
                'to': to_station,
                'distance': haversine(STATIONS[from_station]['lat'], STATIONS[from_station]['lng'], STATIONS[to_station]['lat'], STATIONS[to_station]['lng']),
                'duration': 0, # Will be recalculated
                'coordinates': [STATIONS[from_station], STATIONS[to_station]]
            })
        else:
            station, line_key = node.split('|')
            line_type = 'metro' if 'metro' in line_key else 'bus'

            if line_type == 'metro':
                display_line_name = LINE_ENGLISH_NAMES.get(line_key, clean_line_name(line_key))
            else:
                display_line_name = clean_line_name(line_key)

            if not current_segment or current_segment['line'] != display_line_name or current_segment['type'] != line_type:
                append_valid_segment(current_segment)
                current_segment = {
                    'type': line_type, 'line': display_line_name,
                    'stations': [station], 'coordinates': [STATIONS[station]]
                }
            else:
                current_segment['stations'].append(station)
                current_segment['coordinates'].append(STATIONS[station])

    append_valid_segment(current_segment)

    # Pass 2: Merge consecutive walk segments
    if not segments:
        return {'segments': [], 'total_time': 0}

    merged_segments = [segments[0]]
    for i in range(1, len(segments)):
        prev_segment = merged_segments[-1]
        current_segment = segments[i]

        if prev_segment['type'] == 'walk' and current_segment['type'] == 'walk':
            prev_segment['to'] = current_segment['to']
            prev_segment['distance'] += current_segment['distance']
            if prev_segment['coordinates'][-1] != current_segment['coordinates'][0]:
                 prev_segment['coordinates'].extend(current_segment['coordinates'])
            else:
                 prev_segment['coordinates'].extend(current_segment['coordinates'][1:])
        else:
            merged_segments.append(current_segment)

    # Pass 3: Translate names and calculate durations
    for seg in merged_segments:
        if seg['type'] == 'walk':
            seg['from'] = seg['from']
            seg['to'] = seg['to']
            seg['duration'] = seg['distance'] / 1.3
        else:
            seg['stations'] = [s for s in seg['stations']]
            seg['duration'] = len(seg['stations']) * 120

    return {
        'segments': merged_segments,
        'total_time': sum(seg.get('duration', 0) for seg in merged_segments)
    }

# Debug endpoints
@app.route('/api/stations')
def get_stations():
    stations = []
    for name, data in STATIONS.items():
        clean_name = name.replace(" (Metro)", "").replace(" (Bus)", "")
        stations.append({
            'value': name,
            'label': name, # Use translated name for the label
            'type': data['type'],
            'lat': data['lat'],
            'lng': data['lng']
        })
    return jsonify(sorted(stations, key=lambda x: x['label']))

@app.route('/debug/stations')
def debug_stations():
    return jsonify({
        'adjacency': adjacency,
        'stations': STATIONS,
        'warning': 'THIS API IS DEPRECATED AND WILL BE REMOVED IN THE FUTURE, PLEASE USE /api/stations INSTEAD'
    })

@app.route('/buslines', methods=['GET'])
def get_bus_lines():
    """Endpoint to get all available bus line numbers."""
    try:
        bus_identifiers = []
        for bus_file in Path(EXC_DIR).glob('bus_*.json'):
            # The stem is the filename without the extension, e.g., "bus_BRT11"
            stem = bus_file.stem
            # Replace "bus_" prefix once to get the identifier
            identifier = stem.replace('bus_', '', 1)
            if identifier:
                bus_identifiers.append(identifier)

        # Sort the identifiers lexicographically (alphabetically)
        bus_identifiers.sort()

        # Join the identifiers into a comma-separated string
        lines_string = ",".join(bus_identifiers)

        return jsonify({'lines': lines_string})

    except Exception as e:
        print(f"Get bus lines error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/mtrlines', methods=['GET'])
def get_mtr_lines():
    """Endpoint to get all available metro line numbers."""
    try:
        metro_numbers = []
        # Search in the root directory for metro line station files
        for metro_file in Path('.').glob('line_*_stations.json'):
            stem = metro_file.stem  # e.g., "line_1_stations"
            # Remove prefix and suffix to isolate the number
            identifier = stem.replace('line_', '', 1).replace('_stations', '', 1)
            if identifier:
                metro_numbers.append(identifier)

        # Sort the numbers numerically for a consistent order
        metro_numbers.sort(key=int)

        # Join the numbers into a comma-separated string
        lines_string = ",".join(metro_numbers)

        return jsonify({'lines': lines_string})

    except Exception as e:
        print(f"Get metro lines error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Frontend serving
@app.route('/')
def serve_frontend():
    return send_from_directory('templates', 'index.html')

# --- Main Frontend Route ---
# This serves the main index.html file when someone visits /ar/
@app.route('/ar/')
def serve_index():
    """Serves the main index.html file for the frontend application."""
    return send_from_directory(FRONTEND_DIR, 'index.html')


# --- Combined Proxy and Static File Server ---
@app.route('/ar/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def universal_handler(subpath):
    """
    This function intelligently handles all requests under /ar/.

    1. It checks if the requested path ends with a file extension.
    2. If it's a file, it serves it from the FRONTEND_DIR.
    3. If it's NOT a file, it assumes it's an API call and proxies it
       to the backend service on port 5001.
    """
    # Check if the requested path looks like a static file.
    # We check if there's a dot and if the part after the dot is in our set.
    if '.' in subpath and subpath.rsplit('.', 1)[1].lower() in STATIC_FILE_EXTENSIONS:
        # This is a request for a static file (e.g., app.js, style.css)
        # Serve it directly from the frontend directory.
        return send_from_directory(FRONTEND_DIR, subpath)
    else:
        # This is an API call. Proxy it to the backend.
        return proxy_api_request(subpath)

def proxy_api_request(path):
    """
    This function acts as a proxy. It forwards requests from the frontend
    to the internal backend API service.
    """
    backend_url = f"{BACKEND_API_URL}/{path}"
    headers = {key: value for (key, value) in request.headers if key.lower() != 'host'}

    try:
        backend_resp = requests.request(
            method=request.method,
            url=backend_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            params=request.args,
            allow_redirects=False,
            timeout=10
        )

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        response_headers = {
            key: value for (key, value) in backend_resp.raw.headers.items()
            if key.lower() not in excluded_headers
        }

        return Response(backend_resp.content, backend_resp.status_code, response_headers)

    except requests.exceptions.RequestException as e:
        print(f"Error connecting to backend API: {e}")
        return Response("API Gateway Error: Could not connect to the backend service.", status=502)
    """
    This function acts as a proxy. It forwards requests from the frontend
    to the internal backend API service.
    """
    # Construct the full URL for the backend service by appending the subpath
    backend_url = f"{BACKEND_API_URL}/{subpath}"

    # Copy headers from the incoming request, but remove the 'Host' header
    # as the requests library will set its own.
    headers = {key: value for (key, value) in request.headers if key.lower() != 'host'}

    try:
        # Forward the request to the backend API using the 'requests' library
        # This mirrors the original request's method, URL, headers, and data.
        backend_resp = requests.request(
            method=request.method,
            url=backend_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            params=request.args,
            allow_redirects=False,
            timeout=10 # 10-second timeout
        )

        # These are headers that should not be directly copied from the backend
        # response to the new response, as they are controlled by the WSGI server.
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']

        # Copy headers from the backend response to our new response
        response_headers = {
            key: value for (key, value) in backend_resp.raw.headers.items()
            if key.lower() not in excluded_headers
        }

        # Create a new Flask response object to send back to the original client
        # This response contains the content, status code, and headers from the backend API.
        return Response(backend_resp.content, backend_resp.status_code, response_headers)

    except requests.exceptions.RequestException as e:
        # Handle connection errors to the backend service
        print(f"Error connecting to backend API: {e}")
        return Response("API Gateway Error: Could not connect to the backend service.", status=502)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('templates', path)

# Main
if __name__ == '__main__':
    print("Loading transport data...")
    load_metro_data()
    load_bus_data()
    print("Building connections...")
    build_connections()
    print(f"Loaded {len(STATIONS)} stations")
    print(f"Loaded {len(line_stations)} lines")
    app.run(host='0.0.0.0', port=5000, debug=True)
