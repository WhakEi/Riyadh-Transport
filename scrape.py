from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json
import unicodedata
from urllib.parse import urlparse, parse_qs

# Scrape metro lines (unchanged)
print("Loading lines...")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_extra_http_headers({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })
    page.goto("https://rpt.sa/en/web/guest/lines")
    page.wait_for_selector('li.routes-metro-item', timeout=10000)
    html = page.content()
    browser.close()

soup = BeautifulSoup(html, 'html.parser')
metro_lines = []

for item in soup.select('li.routes-metro-item'):
    line_number_tag = item.select_one('.metro-lines-icon.metro-color')
    if not line_number_tag:
        continue

    line_number = unicodedata.normalize('NFKC', line_number_tag.text.strip())
    if line_number == "M":
        continue

    source = item.select_one('.metro-lines-source').text.strip()
    destination = item.select_one('.metro-lines-destination').text.strip()

    source = unicodedata.normalize('NFKD', source).encode('ascii', 'ignore').decode()
    destination = unicodedata.normalize('NFKD', destination).encode('ascii', 'ignore').decode()

    details_url = item.select_one('a.metro-line-link')['href'] if item.select_one('a.metro-line-link') else ""
    details_url = details_url.replace("/ar/", "/en/")

    metro_lines.append({
        "line_number": line_number,
        "source": source,
        "destination": destination,
        "details_url": f"https://rpt.sa/en{details_url}"
    })

with open('metro_lines.json', 'w', encoding='utf-8') as f:
    json.dump(metro_lines, f, ensure_ascii=False, indent=2)

print(f"Successfully extracted {len(metro_lines)} lines")

# Process stations with fixes
print("Scraping stations for all lines...")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    context = browser.new_context(user_agent=user_agent)  # Set User-Agent here

    for line in metro_lines:
        line_number = line['line_number']
        print(f"Processing Line {line_number}...")
        stations = []

        try:
            # Collect station data from line details page
            line_page = context.new_page()
            line_page.goto(line['details_url'], timeout=30000)
            line_page.wait_for_selector('a.station-info', timeout=15000)

            # Extract station names and URLs
            station_elements = line_page.query_selector_all('a.station-info')
            station_data = []
            for el in station_elements:
                raw_name = el.text_content().strip()
                cleaned_name = unicodedata.normalize('NFKD', raw_name).encode('ascii', 'ignore').decode()
                url = f"https://rpt.sa{el.get_attribute('href')}"
                url = url.replace("/ar/", "/en/")  # Ensure English URL
                station_data.append((cleaned_name, url))
            line_page.close()

            # Process each station
            # Process each station
            for cleaned_name, station_details_url in station_data:
                try:
                    station_page = context.new_page()
                    station_page.goto(station_details_url, timeout=60000)  # Increased timeout

                    # Wait for button AND its parameters to be ready
                    goto_btn = station_page.wait_for_selector(
                        'a.riya-green-button.riya-button.go-to-station',
                        state='attached',
                        timeout=60000
                    )

                    # Wait until href contains coordinates
                    station_page.wait_for_function(
                        '''(selector) => {
                            const btn = document.querySelector(selector);
                            return btn && btn.href.includes('destinationLat=');
                        }''',
                        arg='a.riya-green-button.riya-button.go-to-station',
                        timeout=45000
                    )

                    # Get FINAL resolved URL
                    href = station_page.evaluate('''(selector) => {
                        return document.querySelector(selector).href
                    }''', arg='a.riya-green-button.riya-button.go-to-station')

                    # Parse coordinates
                    parsed = urlparse(href)
                    params = parse_qs(parsed.query)

                    stations.append({
                        "name": cleaned_name,
                        "button_url": href,  # Now contains full URL with params
                        "station_details_url": station_details_url,
                        "latitude": params.get('destinationLat', [None])[0],
                        "longitude": params.get('destinationLng', [None])[0]
                    })

                    station_page.close()

                except Exception as e:
                    print(f"Error processing {cleaned_name}: {str(e)}")
                    stations.append({
                        "name": cleaned_name,
                        "button_url": None,
                        "station_details_url": station_details_url,
                        "latitude": None,
                        "longitude": None
                    })

            # This should be OUTSIDE the station loop but INSIDE the line loop
            filename = f"line_{line_number}_stations.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(stations, f, ensure_ascii=False, indent=2)
            print(f"Saved {len(stations)} stations to {filename}")

        except Exception as e:
            print(f"Error processing Line {line_number}: {str(e)}")

    browser.close()

print("All stations have been successfully saved to JSON files.")
