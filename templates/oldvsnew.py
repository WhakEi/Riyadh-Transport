import os
import json

def compare_bus_routes_detailed():
    """
    Compares bus route JSON files between the current directory and an 'exc' directory,
    reports detailed, per-route changes, and specifies the route key for each change.
    """
    current_dir = '.'
    exc_dir = os.path.join('..', 'exc')
    changes_dir = 'changes'

    # Ensure the 'changes' directory exists
    os.makedirs(changes_dir, exist_ok=True)

    # Check if the 'exc' directory exists
    if not os.path.isdir(exc_dir):
        print(f"Error: The directory '{exc_dir}' does not exist.")
        return

    # Iterate through files in the 'exc' directory
    for filename in os.listdir(exc_dir):
        if filename.startswith('bus_') and filename.endswith('.json'):
            exc_file_path = os.path.join(exc_dir, filename)
            current_file_path = os.path.join(current_dir, filename)

            if not os.path.exists(current_file_path):
                print(f"Ignoring {filename}: Not found in the current directory.")
                continue

            try:
                with open(exc_file_path, 'r') as f:
                    exc_data = json.load(f)
                with open(current_file_path, 'r') as f:
                    current_data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Could not read or parse {filename}. Error: {e}")
                continue

            # Get all route keys from both files
            exc_routes = set(exc_data.keys())
            current_routes = set(current_data.keys())
            all_routes = sorted(list(exc_routes.union(current_routes)))

            diff_content = []

            # Process changes for each route individually
            for route in all_routes:
                old_stops = set(exc_data.get(route, []))
                new_stops = set(current_data.get(route, []))

                # If the stops for this specific route are the same, continue
                if old_stops == new_stops:
                    continue

                removed_stations = old_stops - new_stops
                added_stations = new_stops - old_stops

                for station in sorted(list(removed_stations)):
                    diff_content.append(f"[{route}] Removed station {station}")
                for station in sorted(list(added_stations)):
                    diff_content.append(f"[{route}] Added station {station}")

            # If the list of differences is empty after checking all routes, the files are identical
            if not diff_content:
                print(f"'{filename}' files are identical. No changes detected.")
                continue

            # Create the new file in the 'changes' subdirectory
            file_number = filename.split('_')[1].split('.')[0]
            diff_filename = f"diff_{file_number}.txt"
            diff_filepath = os.path.join(changes_dir, diff_filename)

            with open(diff_filepath, 'w') as f:
                f.write("\n".join(diff_content))

            print(f"Differences found for '{filename}'. Details saved to '{diff_filepath}'.")

if __name__ == '__main__':
    compare_bus_routes_detailed()
