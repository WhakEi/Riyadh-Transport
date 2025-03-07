import json
import os
from typing import Dict, Any

def process_failed_stations():
    # Configuration
    INPUT_DIR = '.'
    RETRY_FILE = 'retry_stations.json'
    
    retry_data: Dict[str, Dict[str, Any]] = {}

    # Process each geocoded file
    for filename in os.listdir(INPUT_DIR):
        if not filename.endswith('.json'):
            continue

        filepath = os.path.join(INPUT_DIR, filename)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data: Dict[str, Dict] = json.load(f)
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON file: {filename}")
                continue

        cleaned_data = {}
        for station, info in data.items():
            if 'error' in info:
                # Add to retry list with origin information
                retry_entry = {
                    'error': info['error'],
                    'origin': filename
                }
                if 'source' in info:  # Preserve any existing metadata
                    retry_entry['source'] = info['source']
                retry_data[station] = retry_entry
            else:
                cleaned_data[station] = info

        # Save cleaned data back to original file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
            print(f"Cleaned {len(cleaned_data)} successful entries in {filename}")

    # Save retry data to new file
    with open(RETRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(retry_data, f, indent=2, ensure_ascii=False)
        print(f"\nSaved {len(retry_data)} failed stations to {RETRY_FILE}")

if __name__ == '__main__':
    process_failed_stations()
