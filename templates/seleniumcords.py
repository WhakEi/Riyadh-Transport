import json
import os
import time
from typing import Dict, Union

# Selenium imports
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# --- CONFIGURATION ---
# IMPORTANT: Update this path to where you extracted the chromedriver executable.
# Example for Windows: "C:\\Users\\YourUser\\Downloads\\chromedriver-win64\\chromedriver.exe"
# Example for Linux/macOS: "/home/user/drivers/chromedriver"
CHROMEDRIVER_PATH = "/usr/bin/chromedriver"

# OPTIONAL: Update this if Chromium is installed in a non-standard location.
# Leave as "" if you don't need it.
# Example for Windows: "C:\\path\\to\\chrome.exe"
# Example for Linux: "/usr/bin/chromium-browser"
CHROMIUM_BINARY_PATH = ""

RPT_URL = "https://sitprd.rpt.sa/en/web/guest/plan"
TIMEOUT = 15
HEADLESS = True
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
# --- END CONFIGURATION ---


def setup_browser() -> webdriver.Chrome:
    """Sets up the Selenium Chromium browser using a manual driver path."""
    if not os.path.exists(CHROMEDRIVER_PATH):
        raise FileNotFoundError(f"ChromeDriver not found at the specified path: {CHROMEDRIVER_PATH}\n"
                              "Please download the correct driver and update the CHROMEDRIVER_PATH variable in the script.")

    options = webdriver.ChromeOptions()
    if HEADLESS:
        options.add_argument("--headless")
    if CHROMIUM_BINARY_PATH:
        options.binary_location = CHROMIUM_BINARY_PATH

    options.add_argument(f"user-agent={USER_AGENT}")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    # Use the manual path for the driver service
    service = ChromeService(executable_path=CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=options)

    driver.get(RPT_URL)
    WebDriverWait(driver, TIMEOUT).until(
        EC.presence_of_element_located((By.ID, "from"))
    )
    return driver

def process_station(driver: webdriver.Chrome, station_name: str) -> Dict[str, Union[str, None]]:
    """Processes a single station to get its coordinates using Selenium."""
    try:
        input_field = driver.find_element(By.ID, "from")
        input_field.clear()
        input_field.send_keys(Keys.CONTROL + "a")
        input_field.send_keys(Keys.DELETE)
        input_field.send_keys(station_name)
        input_field.send_keys(Keys.ENTER)

        result_selector = f"//div[contains(@class, 'result') and contains(., '{station_name}')]"
        wait = WebDriverWait(driver, TIMEOUT)
        result_element = wait.until(
            EC.visibility_of_element_located((By.XPATH, result_selector))
        )

        return {
            'lat': result_element.get_attribute("data-lat"),
            'lng': result_element.get_attribute("data-lng"),
            'source': 'RPT'
        }
    except TimeoutException:
        return {'error': f'Failed for {station_name}: Timed out waiting for result.'}
    except NoSuchElementException:
        return {'error': f'Failed for {station_name}: Result element not found.'}
    except Exception as e:
        return {'error': f'An unexpected error occurred for {station_name}: {str(e)}'}

def process_bus_file(driver: webdriver.Chrome, input_path: str, output_dir: str):
    """Processes a bus file, scrapes coordinates, and saves the results."""
    with open(input_path) as f:
        data = json.load(f)

    coordinates = {}
    all_stations = set(station for direction in data.values() for station in direction)

    for station in sorted(list(all_stations)):
        if station not in coordinates:
            print(f"Processing {station}...")
            start_time = time.time()
            result = process_station(driver, station)
            coordinates[station] = result
            elapsed = time.time() - start_time
            time.sleep(max(0.3 - elapsed, 0))

    bus_number = os.path.basename(input_path).split('_')[1].split('.')[0]
    output_path = os.path.join(output_dir, f"{bus_number}.json")

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(coordinates, f, indent=2, ensure_ascii=False)
    print(f"Results for {input_path} saved to {output_path}")

def main():
    driver = None
    try:
        driver = setup_browser()
        os.makedirs('rpt_coordinates', exist_ok=True)
        bus_files = [f for f in os.listdir() if f.startswith('bus_') and f.endswith('.json')]

        for bus_file in bus_files:
            print(f"\nProcessing file: {bus_file}")
            process_bus_file(driver, bus_file, 'rpt_coordinates')

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if driver:
            driver.quit()

if __name__ == '__main__':
    main()
