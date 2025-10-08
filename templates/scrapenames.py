import os
import subprocess
import cv2
import pytesseract
import json
import time
import re
import imagehash
from PIL import Image
from datetime import datetime

# Configuration
os.environ["TESSDATA_PREFIX"] = "/usr/share/tessdata"
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
DEVICE_ID = "LHS7N19403000843"
MAX_CONSECUTIVE_DUPLICATES = 3
HASH_THRESHOLD = 10
SWIPE_DURATION = 1000
SCROLL_SLEEP = 4.0

def get_image_hash(img):
    pil_img = Image.fromarray(img)
    return imagehash.phash(pil_img)

def capture_screen():
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"/tmp/screen_{timestamp}.png"
        result = subprocess.run(
            ["adb", "-s", DEVICE_ID, "exec-out", "screencap", "-p"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        with open(filename, "wb") as f:
            f.write(result.stdout)

        img = cv2.imread(filename, cv2.IMREAD_GRAYSCALE)
        if img is None:
            print(f"Failed to read image: {filename}")
            return None

        # Crop the image to remove status and navigation bars
        # Original size: 1080x2340
        # Crop y from 73 to 2184
        cropped_img = img[73:2184, :]

        return cropped_img
    except Exception as e:
        print(f"Capture error: {str(e)[:100]}")
        return None

def extract_bus_data(img):
    # Enhanced preprocessing
    img_processed = cv2.threshold(img, 170, 255, cv2.THRESH_BINARY)[1]
    img_processed = cv2.medianBlur(img_processed, 3)

    text = pytesseract.image_to_string(
        img_processed,
        config='--psm 6 -l eng --oem 3'
    )
    print(f"Raw OCR Text:\n{text}\n{'='*40}")

    stations = []
    last_stop = None
    lines = text.split('\n')

    # Enhanced last stop pattern with letter support
    last_stop_pattern = r'^[A-Za-z][A-Za-z0-9\s-]+\s(\d+[\s-]*[A-Za-z]?|[A-Za-z])$'

    # Reverse search for last stop with extended range
    for i, line in enumerate(lines):
        clean_line = re.sub(r'[^a-zA-Z0-9\s-]', '', line.strip())
        if re.search(r'last\s*stop', clean_line, re.IGNORECASE):
            # Check up to 10 lines above with priority to closest
            for j in range(min(i-1, len(lines)-1), max(-1, i-11), -1):
                candidate = lines[j].strip()
                # Enhanced cleaning
                candidate = re.sub(r'^[O0\W]+', '', candidate)
                candidate = re.sub(r'\s+', ' ', candidate)
                candidate = re.sub(r'([a-z])([A-Z])', r'\1 \2', candidate)
                candidate = re.sub(r'(\d)([A-Z])', r'\1 \2', candidate)
                candidate = re.sub(r'\b(l|I)\b', 'Al', candidate)
                candidate = re.sub(r'(?<=\D)(\d+)(?=\D)', r' \1 ', candidate)

                if re.match(last_stop_pattern, candidate):
                    last_stop = candidate
                    print(f"Last stop candidate accepted: {last_stop}")
                    break
            if last_stop: break

    # Enhanced station validation pattern
    station_pattern = r'^[A-Za-z][A-Za-z0-9\s-]+\s(\d+[\s-]*[A-Za-z]?|[A-Za-z])$'

    for line in lines:
        original = line.strip()
        # Multi-stage cleaning
        cleaned = original
        cleaned = re.sub(r'^[O0\W]+', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', cleaned)
        cleaned = re.sub(r'(\d)([A-Z])', r'\1 \2', cleaned)
        cleaned = re.sub(r'\b(l|I)\b', 'Al', cleaned)
        cleaned = re.sub(r'[^a-zA-Z0-9\s-]', '', cleaned)
        cleaned = re.sub(r'\s+([A-Z])$', r' \1', cleaned)  # Ensure space before final letter

        if re.fullmatch(station_pattern, cleaned):
            # Final normalization
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            stations.append(cleaned)
            print(f"Validated station: {cleaned}")

    return {'stations': stations, 'last_stop': last_stop}

def scroll_down():
    try:
        subprocess.run([
            "adb", "-s", DEVICE_ID, "shell", "input", "swipe",
            "300", "1600", "300", "400", str(SWIPE_DURATION)
        ], check=True, timeout=5)
    except Exception as e:
        print(f"Scroll error: {str(e)[:100]}")

def main():
    line_number = input("Enter the bus line number: ").strip()
    filename = f"bus_{line_number}.json"

    # Initialize data storage
    all_data = {}
    if os.path.exists(filename):
        try:
            with open(filename, 'r') as f:
                all_data = json.load(f)
            print(f"Loaded existing data with {sum(len(v) for v in all_data.values())} stations")
        except Exception as e:
            print(f"Loading error: {e} - Starting fresh")

    processed_hashes = set()
    consecutive_duplicates = 0
    temp_stations = []  # Preserve order
    temp_set = set()     # Track duplicates
    current_direction = None

    while True:
        screen = capture_screen()
        if screen is None:
            time.sleep(2)
            continue

        current_hash = get_image_hash(screen)
        if current_hash in processed_hashes:
            consecutive_duplicates += 1
            print(f"Duplicate ({consecutive_duplicates}/{MAX_CONSECUTIVE_DUPLICATES})")

            if consecutive_duplicates >= MAX_CONSECUTIVE_DUPLICATES:
                print("Stopping: Consecutive duplicates reached")
                break
            continue

        processed_hashes.add(current_hash)
        consecutive_duplicates = 0

        data = extract_bus_data(screen)
        new_stations = data['stations']
        last_stop = data['last_stop']

        if last_stop:
            print(f"Identified direction: {last_stop}")
            if last_stop not in all_data:
                all_data[last_stop] = []

            # Merge temporary stations in original order
            if temp_stations:
                print(f"Merging {len(temp_stations)} temporary stations")
                existing_set = set(all_data[last_stop])
                ordered_new = [s for s in temp_stations if s not in existing_set]
                all_data[last_stop].extend(ordered_new)
                temp_stations = []
                temp_set = set()

            # Add new stations with order preservation
            existing_set = set(all_data[last_stop])
            added = []
            for station in new_stations:
                if station not in existing_set:
                    added.append(station)
                    existing_set.add(station)
            all_data[last_stop].extend(added)
            print(f"Added {len(added)} stations to {last_stop}")
            current_direction = last_stop
        else:
            # Add to temporary storage with order+duplicate tracking
            added = []
            for station in new_stations:
                if station not in temp_set:
                    temp_stations.append(station)
                    temp_set.add(station)
                    added.append(station)
            print(f"Added {len(added)} stations to temporary storage (total: {len(temp_stations)})")

        scroll_down()
        time.sleep(SCROLL_SLEEP)

    # Final merge of remaining stations
    if current_direction and temp_stations:
        existing_set = set(all_data[current_direction])
        ordered_to_add = [s for s in temp_stations if s not in existing_set]
        all_data[current_direction].extend(ordered_to_add)
        print(f"Added final {len(ordered_to_add)} temporary stations to {current_direction}")

    if all_data:
        with open(filename, 'w') as f:
            json.dump(all_data, f, indent=2)
        print(f"Successfully saved {sum(len(v) for v in all_data.values())} stations in order")
    else:
        print("No data collected")

if __name__ == "__main__":
    main()
