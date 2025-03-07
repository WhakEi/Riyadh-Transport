import json
import os
import time
from playwright.sync_api import sync_playwright
from typing import Dict, Union

# Configuration
RPT_URL = "https://rpt.sa/en/web/guest/plan"
INPUT_DELAY = 50  # Reduced keystroke delay
TIMEOUT = 10000  # Reduced to 10 seconds
HEADLESS = True
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"

def setup_browser(playwright):
    browser = playwright.chromium.launch(headless=HEADLESS)
    context = browser.new_context(
        user_agent=USER_AGENT,
        viewport={'width': 1920, 'height': 1080}
    )
    page = context.new_page()
    page.goto(RPT_URL)
    page.wait_for_selector("input#from", state="visible")
    return browser, context, page

def process_station(page, station_name: str) -> Dict[str, Union[str, None]]:
    try:
        # Clear input using focused deletion
        input_field = page.locator("input#from")
        input_field.click()
        input_field.fill("")

        # Type and search with exact match verification
        input_field.type(station_name, delay=INPUT_DELAY)
        page.keyboard.press("Enter")

        # Wait for specific station result using DOM matching
        result_selector = f'div.result:has-text("{station_name}")'
        page.wait_for_selector(result_selector, state="visible", timeout=15000)

        # Get exact match element
        result = page.locator(result_selector).first
        return {
            'lat': result.get_attribute("data-lat"),
            'lng': result.get_attribute("data-lng"),
            'source': 'RPT'
        }
    except Exception as e:
        return {'error': f'Failed for {station_name}: {str(e)}'}

# In clear_input replace with:
def clear_input(page):
    page.evaluate('''() => {
        document.querySelector('input#from').value = '';
        const event = new Event('input', { bubbles: true });
        document.querySelector('input#from').dispatchEvent(event);
    }''')
    page.wait_for_load_state("networkidle")

def process_bus_file(page, input_path: str, output_dir: str):
    with open(input_path) as f:
        data = json.load(f)

    coordinates = {}
    for direction in data.values():
        for station in direction:
            if station not in coordinates:
                print(f"Processing {station}...")
                start_time = time.time()

                result = process_station(page, station)
                coordinates[station] = result

                # Dynamic rate limiting based on processing time
                elapsed = time.time() - start_time
                time.sleep(max(0.3 - elapsed, 0))  # Target 300ms per request

    # Save results
    bus_number = os.path.basename(input_path).split('_')[1].split('.')[0]
    output_path = os.path.join(output_dir, f"{bus_number}.json")

    with open(output_path, 'w') as f:
        json.dump(coordinates, f, indent=2, ensure_ascii=False)

def main():
    with sync_playwright() as playwright:
        browser, context, page = setup_browser(playwright)
        os.makedirs('rpt_coordinates', exist_ok=True)

        try:
            bus_files = [f for f in os.listdir() if f.startswith('bus_') and f.endswith('.json')]

            for bus_file in bus_files:
                print(f"\nProcessing file: {bus_file}")
                process_bus_file(page, bus_file, 'rpt_coordinates')

        finally:
            context.close()
            browser.close()

if __name__ == '__main__':
    main()
