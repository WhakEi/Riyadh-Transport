import os
import json
import requests
import time

# --- Configuration ---
DIRECTORY_NAME = "../geocoded_stops"
API_URL = 'https://sitprd.rpt.sa/en/plan?p_p_id=rcrc_plan_my_trip_RcrcPlanMyTripPortlet_INSTANCE_2bFi5BtbHUDZ&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Fsearch-stop-resource-command&p_p_cacheability=cacheLevelPage'

# Headers from the curl command (it's best to exclude cookies as they are session-specific)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'https://sitprd.rpt.sa',
    'Referer': 'https://sitprd.rpt.sa/en/plan',
}

# --- Main Script Logic ---

def update_stop_ids():
    """
    Finds JSON files in the specified directory and adds a unique 'id'
    to each stop by fetching it from the RPT API.
    """
    # Check if the target directory exists
    if not os.path.isdir(DIRECTORY_NAME):
        print(f"❌ Error: Directory '{DIRECTORY_NAME}' not found.")
        print("Please make sure the script is in the same parent folder as your 'geocoded_stops' directory.")
        return

    # Get a list of all JSON files in the directory
    json_files = [f for f in os.listdir(DIRECTORY_NAME) if f.endswith('.json')]

    if not json_files:
        print(f"🤷 No JSON files found in the '{DIRECTORY_NAME}' directory.")
        return

    print(f"Found {len(json_files)} JSON file(s) to process.")

    # Process each file
    for filename in json_files:
        filepath = os.path.join(DIRECTORY_NAME, filename)
        print(f"\n--- Processing file: {filename} ---")

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                stops_data = json.load(f)
        except json.JSONDecodeError:
            print(f"  ❗️ Warning: Could not read {filename}. It might be invalid JSON. Skipping.")
            continue

        was_updated = False  # A flag to check if we need to re-save the file

        # Iterate over each stop in the current JSON file
        for stop_name, stop_info in stops_data.items():
            # --- FIX 1: PREVENT CRASH ---
            # Ensure we are working with a dictionary (a proper stop object), not just a string.
            if not isinstance(stop_info, dict):
                print(f"  - Skipping entry '{stop_name}': Not a valid stop object.")
                continue

            # --- FIX 2: SKIP IF ID EXISTS ---
            # If the 'id' key already exists and has a value, we can skip this stop.
            if 'id' in stop_info and stop_info['id']:
                print(f"  - Skipping '{stop_name}': ID already exists.")
                continue

            print(f"  - Fetching ID for '{stop_name}'...")

            # The data payload for the POST request
            payload = {
                '_rcrc_plan_my_trip_RcrcPlanMyTripPortlet_INSTANCE_2bFi5BtbHUDZ_word': stop_name,
                '_rcrc_plan_my_trip_RcrcPlanMyTripPortlet_INSTANCE_2bFi5BtbHUDZ_languageID': 'en'
            }

            try:
                # Send the POST request to the API
                response = requests.post(API_URL, headers=HEADERS, data=payload, timeout=15)
                response.raise_for_status()  # This will raise an error for bad responses (like 404 or 500)

                api_results = response.json()

                # Check if the response contains data and get the first result
                if api_results and 'record_id' in api_results[0]:
                    record_id = api_results[0]['record_id']
                    stop_info['id'] = record_id
                    print(f"    ✅ Success! Found ID: {record_id}")
                    was_updated = True
                else:
                    print(f"    ⚠️ Warning: No ID found for '{stop_name}'.")

            except requests.exceptions.RequestException as e:
                print(f"    ❌ Error: Network request failed for '{stop_name}': {e}")
            except (json.JSONDecodeError, IndexError):
                print(f"    ❌ Error: Could not understand the server's response for '{stop_name}'.")

            # A small delay to be respectful to the server and avoid getting blocked
            time.sleep(0.5)

        # If we made any changes, save the updated data back to the same file
        if was_updated:
            with open(filepath, 'w', encoding='utf-8') as f:
                # indent=2 makes the JSON file nicely formatted and readable
                json.dump(stops_data, f, indent=2, ensure_ascii=False)
            print(f"--- ✔️ File '{filename}' has been updated. ---")
        else:
            print(f"--- ❕ No new IDs to add in '{filename}'. ---")

    print("\n🎉 All files processed. Script finished.")

# Run the main function
if __name__ == "__main__":
    update_stop_ids()
