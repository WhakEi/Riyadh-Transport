import json
from pathlib import Path
from typing import Dict, List, Set

def validate_stations_with_fallback(exc_dir: str = "../exc",
                                  geo_dir: str = "../geocoded_stops",
                                  fallback_name: str = "missing.json"):
    # Validate and load fallback data
    fallback_path = Path(geo_dir) / fallback_name
    fallback_data = {}
    
    if fallback_path.exists():
        try:
            # Check if file is not empty
            if fallback_path.stat().st_size > 0:
                with fallback_path.open() as f:
                    fallback_data = json.load(f)
            else:
                print(f"Note: {fallback_name} exists but is empty")
        except json.JSONDecodeError:
            print(f"Warning: Malformed JSON in {fallback_name}")
        except Exception as e:
            print(f"Error reading {fallback_name}: {str(e)}")
    else:
        print(f"Note: {fallback_name} not found in {geo_dir}")

    # Track validation results
    report = {
        'missing_files': [],
        'missing_stations': {},
        'fallback_used': 0,
        'total_missing': 0
    }

    # Process each bus file
    for bus_path in Path(exc_dir).glob("bus_*.json"):
        # Extract numeric ID from filename
        bus_id = bus_path.stem.split("_")[1]
        geo_path = Path(geo_dir) / f"{bus_id}.json"

        # File existence checks
        if not geo_path.exists():
            report['missing_files'].append(f"Missing geocoded file for {bus_path.name}")
            continue

        # Load data
        try:
            with bus_path.open() as f:
                bus_data: Dict[str, List[str]] = json.load(f)
            with geo_path.open() as f:
                geo_data: Dict[str, Dict] = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Skipping invalid file pair {bus_id}: {str(e)}")
            continue

        # Collect all stations from bus file
        all_bus_stations = {station for stations in bus_data.values() for station in stations}
        missing_stations = []

        # Check each station
        for station in all_bus_stations:
            if station not in geo_data:
                # Check fallback
                if station not in fallback_data:
                    missing_stations.append(station)
                    report['total_missing'] += 1
                else:
                    report['fallback_used'] += 1

        if missing_stations:
            report['missing_stations'][bus_id] = missing_stations

    # Check for orphaned geo files
    for geo_path in Path(geo_dir).glob("*.json"):
        if geo_path.name == fallback_name:
            continue
            
        bus_id = geo_path.stem
        bus_path = Path(exc_dir) / f"bus_{bus_id}.json"
        
        if not bus_path.exists():
            report['missing_files'].append(f"Missing bus file for {geo_path.name}")

    # Generate report
    print("=== Station Validation Report ===")
    
    if report['missing_files']:
        print("\nMissing Counterpart Files:")
        print("\n".join(report['missing_files']))
    
    if report['missing_stations']:
        print("\nMissing Stations (not found in primary or fallback):")
        for bus_id, stations in report['missing_stations'].items():
            print(f"bus_{bus_id}.json:")
            print("\n".join(f"  - {s}" for s in stations))
    
    print(f"\nStatistics:")
    print(f"Total unresolved stations: {report['total_missing']}")
    print(f"Stations found in fallback: {report['fallback_used']}")

if __name__ == "__main__":
    validate_stations_with_fallback()
