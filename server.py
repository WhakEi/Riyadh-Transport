from flask import Flask, render_template, jsonify, request
from collections import deque
import json
import unicodedata

app = Flask(__name__)

LINE_COLORS = {
    1: "#00ace5",
    2: "#f0493a",
    3: "#f68c39",
    4: "#fed004",
    5: "#43b549",
    6: "#974c9c"
}

# Load metro data with normalization
with open('metro_lines.json', 'r') as f:
    metro_lines = json.load(f)

STATIONS = {}
adjacency = {}
line_stations = {}
station_to_lines = {}

for line in metro_lines:
    line_num = line['line_number']
    with open(f'line_{line_num}_stations.json', 'r') as f:
        stations_data = json.load(f)

        # Normalize station names
        normalized_stations = []
        for s in stations_data:
            name = unicodedata.normalize('NFKC', s['name'].strip())
            normalized_stations.append(name)
            STATIONS[name] = {
                'lat': s['latitude'],
                'lng': s['longitude']
            }
            if name not in station_to_lines:
                station_to_lines[name] = []
            station_to_lines[name].append(line_num)

        line_stations[line_num] = normalized_stations

# Build adjacency list with normalized names
for line_num, stops in line_stations.items():
    for i in range(len(stops) - 1):
        current = stops[i]
        next_st = stops[i + 1]

        adjacency_key = f"{current}_{line_num}"
        adjacency.setdefault(adjacency_key, []).append(f"{next_st}_{line_num}")

        reverse_key = f"{next_st}_{line_num}"
        adjacency.setdefault(reverse_key, []).append(f"{current}_{line_num}")

# Add transfers between lines
for station, lines in station_to_lines.items():
    if len(lines) > 1:
        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                line_a = lines[i]
                line_b = lines[j]

                # Create bidirectional transfer edges
                adjacency[f"{station}_{line_a}"].append(f"{station}_{line_b}")
                adjacency[f"{station}_{line_b}"].append(f"{station}_{line_a}")

@app.route('/route', methods=['POST'])
def get_route():
    data = request.json
    start = unicodedata.normalize('NFKC', data.get('start', '').strip())
    end = unicodedata.normalize('NFKC', data.get('end', '').strip())

    if not start or not end:
        return jsonify({'error': 'Both stations are required'}), 400
    if start == end:
        return jsonify({'error': 'Same station selected'}), 400

    visited = set()
    queue = deque()
    results = []

    # Initialize queue with all possible starting lines
    for line in station_to_lines.get(start, []):
        key = f"{start}_{line}"
        queue.append({'current': key, 'path': [key]})
        visited.add(key)

    while queue:
        current = queue.popleft()
        current_station, current_line = current['current'].split('_')
        current_station = unicodedata.normalize('NFKC', current_station)

        if current_station == end:
            results.append(current['path'])
            continue  # Continue searching for alternative paths

        for neighbor in adjacency.get(current['current'], []):
            if neighbor not in visited:
                visited.add(neighbor)
                new_path = current['path'] + [neighbor]
                queue.append({'current': neighbor, 'path': new_path})

    if not results:
        return jsonify({'error': 'No route found'}), 404

    # Format all valid routes
    formatted_routes = []
    for path in results:
        formatted = format_route(path)
        formatted_routes.append(formatted)

    return jsonify({'routes': formatted_routes})

def format_route(path):
    route = []
    current_line = None
    stations_list = []
    transfer_count = 0

    for step in path:
        station_part, line_part = step.split('_')
        station = unicodedata.normalize('NFKC', station_part)
        line = int(line_part)

        if line != current_line:
            if current_line is not None:
                route.append({
                    'line': current_line,
                    'color': LINE_COLORS.get(current_line, '#000'),
                    'stations': stations_list.copy()
                })
                stations_list = []
                transfer_count += 1
            current_line = line
        stations_list.append(station)

    if stations_list:
        route.append({
            'line': current_line,
            'color': LINE_COLORS.get(current_line, '#000'),
            'stations': stations_list.copy()
        })

    # Build coordinates with numeric conversion
    station_coords = {}
    for step in path:
        station_name = step.split('_')[0]
        station_data = STATIONS.get(station_name, {})
        if station_data.get('lat') and station_data.get('lng'):
            station_coords[station_name] = {
                'lat': float(station_data['lat']),
                'lng': float(station_data['lng'])
            }

    return {
        'segments': route,
        'coordinates': station_coords,
        'transfers': transfer_count
    }

@app.route('/')
def index():
    return render_template('index.html')  # Ensure this line exists

@app.route('/search', methods=['GET'])
def search_stations():
    query = request.args.get('term', '').lower()
    matches = [name for name in STATIONS.keys() if query in name.lower()][:10]
    return jsonify(matches)

def format_route(path):
    route = []
    current_line = None
    stations_list = []
    transfer_count = 0

    for step in path:
        station_part, line_part = step.split('_')
        station = unicodedata.normalize('NFKC', station_part.strip())
        line = int(line_part)

        if line != current_line:
            if current_line is not None:
                route.append({
                    'line': current_line,
                    'color': LINE_COLORS.get(current_line, '#000'),
                    'stations': stations_list.copy()
                })
                stations_list = []
                transfer_count += 1
            current_line = line
        stations_list.append(station)

    if stations_list:
        route.append({
            'line': current_line,
            'color': LINE_COLORS.get(current_line, '#000'),
            'stations': stations_list.copy()
        })

    # Build coordinates with numeric conversion
    station_coords = {}
    for step in path:
        station_name = step.split('_')[0]
        station_data = STATIONS.get(station_name, {})
        if station_data.get('lat') and station_data.get('lng'):
            station_coords[station_name] = {
                'lat': float(station_data['lat']),  # Ensure numeric values
                'lng': float(station_data['lng'])
            }

    return {
        'segments': route,
        'coordinates': station_coords,
        'transfers': transfer_count
    }

if __name__ == '__main__':
    app.run(debug=True)
