from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import unicodedata
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
import heapq
import os

app = Flask(__name__)
CORS(app)

# Configuration
METRO_LINES_FILE = 'metro_lines.json'
EXC_DIR = 'exc'
GEOCODED_DIR = 'geocoded_stops'
WALKING_DISTANCE = 500  # meters

# Data storage
STATIONS = {}
adjacency = {}
line_stations = {}
station_to_lines = {}

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

# Data loading
def load_metro_data():
    try:
        with open(METRO_LINES_FILE) as f:
            metro_config = json.load(f)

        for line_info in metro_config:
            line_num = line_info['line_number']
            line_key = f"metro_{line_num}"
            stations_file = f"line_{line_num}_stations.json"

            if not os.path.exists(stations_file):
                print(f"⚠ Missing metro file: {stations_file}")
                continue

            with open(stations_file) as f:
                stations = json.load(f)

            normalized = []
            for s in stations:
                name = normalize_name(s['name'])
                if "Transportation Center" in name:
                    name += " (Metro)"
                elif not name.endswith("(Metro)"):
                    name += " (Metro)"

                lat = float(s['latitude'])
                lng = float(s['longitude'])

                if not (24.0 < lat < 25.5 and 46.0 < lng < 47.5):
                    print(f"Invalid coordinates for {name}: {lat},{lng}")
                    continue

                normalized.append(name)
                STATIONS[name] = {
                    'lat': lat,
                    'lng': lng,
                    'type': 'metro'
                }
                station_to_lines.setdefault(name, []).append(line_key)

            line_stations[line_key] = normalized
            print(f"Loaded Metro Line {line_num} with {len(normalized)} stations")

    except Exception as e:
        print(f"Error loading metro data: {str(e)}")

def load_bus_data():
    for bus_file in Path(EXC_DIR).glob('bus_*.json'):
        try:
            line_num = bus_file.stem.split('_')[1]
            line_key_base = f"bus_{line_num}"

            with open(bus_file) as f:
                bus_stops = json.load(f)

            geo_file = Path(GEOCODED_DIR) / f"{line_num}.json"
            geo_data = {}
            if geo_file.exists():
                with open(geo_file) as f:
                    geo_data = json.load(f)

            missing_file = Path(GEOCODED_DIR) / 'missing.json'
            missing_data = {}
            if missing_file.exists():
                with open(missing_file) as f:
                    missing_data = json.load(f)

            for direction_idx, (direction_name, stations_in_dir) in enumerate(bus_stops.items()):
                line_key = f"{line_key_base}_dir{direction_idx}"
                normalized = []
                for raw_name in stations_in_dir:
                    name = normalize_name(raw_name)
                    if "Transportation Center" in name:
                        name += " (Bus)"
                    elif not name.endswith("(Bus)"):
                        name += " (Bus)"

                    raw_name_stripped = raw_name.strip()
                    coords = geo_data.get(raw_name_stripped, missing_data.get(raw_name_stripped, {}))
                    lat = float(coords.get('lat', 0))
                    lng = float(coords.get('lng', 0))

                    if not (24.0 < lat < 25.5 and 46.0 < lng < 47.5):
                        print(f"Invalid coordinates for {name} in bus {line_num}, direction {direction_name}")
                        continue

                    if name not in STATIONS:
                        STATIONS[name] = {
                            'lat': lat,
                            'lng': lng,
                            'type': 'bus',
                            'source': 'geo' if lat + lng != 0 else 'missing'
                        }

                    normalized.append(name)
                    station_to_lines.setdefault(name, []).append(line_key)

                line_stations[line_key] = normalized
                print(f"Loaded Bus Line {line_num} direction {direction_name} with {len(normalized)} stops")

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
    for station, lines in station_to_lines.items():
        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                line_a = lines[i]
                line_b = lines[j]
                node_a = f"{station}|{line_a}"
                node_b = f"{station}|{line_b}"
                adjacency.setdefault(node_a, []).append(node_b)
                adjacency.setdefault(node_b, []).append(node_a)

    # Walking connections
    connection_count = 0
    all_stations = list(STATIONS.items())
    WALKING_DISTANCE = 1000  # Increased from 500 meters

    # Create a list of all stations with their coordinates
    stations = [(name, data) for name, data in STATIONS.items()]

    # Compare every pair of stations
    for i, (name1, data1) in enumerate(stations):
        for j, (name2, data2) in enumerate(stations[i+1:], start=i+1):
            distance = haversine(
                data1['lat'], data1['lng'],
                data2['lat'], data2['lng']
            )

            if distance <= WALKING_DISTANCE:
                # Add bidirectional walking connections
                for line in station_to_lines.get(name1, []):
                    adjacency.setdefault(f"{name1}|{line}", []).append(f"walk|{name2}")
                for line in station_to_lines.get(name2, []):
                    adjacency.setdefault(f"{name2}|{line}", []).append(f"walk|{name1}")
                connection_count += 1

    print(f"Total walking connections: {connection_count}")

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
            return jsonify({'error': 'Start station has no connections'}), 400

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
                return jsonify({'routes': [format_route(path)]})

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

        return jsonify({'error': 'No route found'}), 404

    except Exception as e:
        print(f"Route error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Route formatting
def format_route(path):
    segments = []
    current_segment = None

    for node in path:
        if node.startswith('walk|'):
            # Handle walking segment
            if current_segment:
                segments.append(current_segment)
                current_segment = None

            from_station = path[path.index(node)-1].split('|')[0]
            to_station = node.split('|')[1]

            segments.append({
                'type': 'walk',
                'from': from_station,
                'to': to_station,
                'distance': haversine(
                    STATIONS[from_station]['lat'], STATIONS[from_station]['lng'],
                    STATIONS[to_station]['lat'], STATIONS[to_station]['lng']
                ),
                'duration': 180,
                'coordinates': [
                    STATIONS[from_station],
                    STATIONS[to_station]
                ]
            })
        else:
            # Handle transportation segment
            station, line = node.split('|')
            cleaned_line = clean_line_name(line)
            line_type = 'metro' if 'metro' in line else 'bus'

            if not current_segment or current_segment['line'] != cleaned_line or current_segment['type'] != line_type:
                if current_segment:
                    segments.append(current_segment)
                current_segment = {
                    'type': line_type,
                    'line': cleaned_line,
                    'stations': [station],
                    'coordinates': [STATIONS[station]]
                }
            else:
                current_segment['stations'].append(station)
                current_segment['coordinates'].append(STATIONS[station])

    if current_segment:
        segments.append(current_segment)

    # Calculate durations
    for seg in segments:
        if seg['type'] != 'walk':
            seg['duration'] = len(seg['stations']) * 120  # 2 minutes per station

    return {
        'segments': segments,
        'total_time': sum(seg.get('duration', 0) for seg in segments)
    }

# Debug endpoints
@app.route('/api/stations')
def get_stations():
    stations = []
    for name, data in STATIONS.items():
        clean_name = name.replace(" (Metro)", "").replace(" (Bus)", "")
        stations.append({
            'value': name,
            'label': clean_name,
            'type': data['type']
        })
    return jsonify(sorted(stations, key=lambda x: x['label']))

@app.route('/debug/stations')
def debug_stations():
    return jsonify({
        'stations': STATIONS,
        'adjacency': adjacency,
        'line_stations': line_stations
    })

@app.route('/debug/metro')
def debug_metro():
    return jsonify({
        'stations': STATIONS,
        'lines': line_stations,
        'adjacency': adjacency
    })

# Frontend serving
@app.route('/')
def serve_frontend():
    return send_from_directory('templates', 'index.html')

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
