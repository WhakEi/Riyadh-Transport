import os
import json
import requests
import re
import time
from bs4 import BeautifulSoup

# --- Configuration ---
DIRECTORY_NAME = "../geocoded_stops"
BASE_URL = "https://sitprd.rpt.sa/en/routedetails/tags/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Referer': 'https://sitprd.rpt.sa/en/plan',
}

# --- Helper Functions ---

def parse_route_from_filename(filename):
    """Extracts the numerical part of a route from a filename."""
    # Find all numbers in the filename string
    numbers = re.findall(r'\d+', filename)
    if numbers:
        # Join them together (for cases like BRT-1-1 becomes 11)
        return "".join(numbers)
    return None

def find_valid_route_url(route_str):
    """Tries different prefixes (01-09) to find a working URL for a route."""
    padded_route = route_str.zfill(3) # e.g., '7' -> '007', '11' -> '011', '150' -> '150'

    for i in range(1, 10):
        prefix = f"0{i}"
        route_code = f"{prefix}{padded_route}"
        url_to_check = f"{BASE_URL}{route_code}?dir=H"
        try:
            # We use a HEAD request because it's faster; we only need to check if the page exists.
            response = requests.head(url_to_check, headers=HEADERS, timeout=10, allow_redirects=True)
            if response.status_code == 200:
                print(f"    Found valid route code: {route_code}")
                return f"{BASE_URL}{route_code}"
        except requests.exceptions.RequestException as e:
            print(f"    Network error while checking prefix {prefix}: {e}")
            continue # Try next prefix

    print(f"    ⚠️ Could not find a valid URL for route {route_str}.")
    return None

def scrape_stations_from_url(url):
    """
    Fetches the HTML from a URL and scrapes the station names and IDs.
    Returns a dictionary mapping {station_name: station_id}.
    """
    print(f"    Scraping: {url}")
    stations_map = {}
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'lxml')
        # Find all buttons with an onclick attribute containing 'getStationArrivals'
        station_buttons = soup.find_all('button', onclick=re.compile(r'getStationArrivals'))

        for button in station_buttons:
            onclick_attr = button['onclick']
            # Regex to capture the ID (digits) and the name (inside quotes)
            match = re.search(r"getStationArrivals\((\d+),\s*'(.*?)'", onclick_attr)
            if match:
                station_id = match.group(1)
                station_name = match.group(2).strip()
                stations_map[station_name] = station_id

        print(f"    Found {len(stations_map)} stations on this page.")
        return stations_map

    except requests.exceptions.RequestException as e:
        print(f"    ❌ Error fetching {url}: {e}")
        return {}
    except Exception as e:
        print(f"    ❌ Error parsing the page: {e}")
        return {}


# --- Main Script Logic ---

def scrape_missing_ids():
    """
    Finds JSON files and scrapes the RPT website to fill in missing station IDs.
    """
    if not os.path.isdir(DIRECTORY_NAME):
        print(f"❌ Error: Directory '{DIRECTORY_NAME}' not found.")
        return

    json_files = [f for f in os.listdir(DIRECTORY_NAME) if f.endswith('.json')]
    if not json_files:
        print(f"🤷 No JSON files found in '{DIRECTORY_NAME}'.")
        return

    print(f"Found {len(json_files)} JSON file(s) to process for missing IDs.")

    for filename in json_files:
        filepath = os.path.join(DIRECTORY_NAME, filename)
        print(f"\n--- Checking file: {filename} ---")

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                stops_data = json.load(f)
        except json.JSONDecodeError:
            print(f"  ❗️ Invalid JSON in {filename}. Skipping.")
            continue

        # Find which stations are missing an ID
        missing_id_stations = {name: info for name, info in stops_data.items() if isinstance(info, dict) and not info.get('id')}

        if not missing_id_stations:
            print("  ✅ All stations already have IDs. Skipping file.")
            continue

        print(f"  Found {len(missing_id_stations)} stations missing an ID. Starting scrape.")

        route_str = parse_route_from_filename(filename)
        if not route_str:
            print(f"  ❗️ Could not determine route number from filename '{filename}'. Skipping.")
            continue

        # Get the correct base URL for the route (e.g., .../tags/01954)
        route_base_url = find_valid_route_url(route_str)
        if not route_base_url:
            continue

        # Scrape both directions to build a complete map of stations
        all_scraped_stations = {}

        # Scrape first direction (H)
        stations_h = scrape_stations_from_url(f"{route_base_url}?dir=H")
        all_scraped_stations.update(stations_h)

        time.sleep(1) # Be respectful to the server

        # If we still haven't found all our missing stations, try the other direction (R)
        found_names = set(all_scraped_stations.keys())
        still_missing = any(name not in found_names for name in missing_id_stations)

        if still_missing:
            print("  Some stations still missing, trying reverse direction...")
            stations_r = scrape_stations_from_url(f"{route_base_url}?dir=R")
            all_scraped_stations.update(stations_r)
        else:
            print("  All missing stations found in first direction (likely a ring route).")

        # Now, update the JSON data with the scraped IDs
        was_updated = False
        for stop_name, stop_info in stops_data.items():
            if stop_name in missing_id_stations: # Check if this was one we were looking for
                if stop_name in all_scraped_stations:
                    found_id = all_scraped_stations[stop_name]
                    stop_info['id'] = found_id
                    was_updated = True
                    print(f"    -> Updated '{stop_name}' with ID: {found_id}")
                else:
                    print(f"    -> ⚠️ Failed to find '{stop_name}' on the website.")

        # Save the file if any changes were made
        if was_updated:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(stops_data, f, indent=2, ensure_ascii=False)
            print(f"--- ✔️ File '{filename}' has been updated. ---")
        else:
            print(f"--- ❕ No new IDs could be found for '{filename}'. ---")

    print("\n🎉 All files processed. Script finished.")

if __name__ == "__main__":
    scrape_missing_ids()
