# Riyadh Transport Android App - Developer Guide

## Overview

This Android application is built in Java and provides a mobile interface for the Riyadh Transport system. It mirrors the functionality of the web application while being optimized for mobile devices.

## Architecture

### Project Structure

```
com.riyadhtransport/
├── MainActivity.java           # Main entry point with map and tabs
├── adapters/                   # RecyclerView adapters
│   ├── StationAdapter.java     # Displays station list
│   └── RouteSegmentAdapter.java # Displays route segments
├── api/                        # Backend communication
│   ├── ApiClient.java          # Retrofit client setup
│   └── TransportApiService.java # API endpoints interface
├── fragments/                  # Tab fragments
│   ├── RouteFragment.java      # Route planning tab
│   ├── StationsFragment.java   # Stations list tab
│   └── LinesFragment.java      # Metro/Bus lines tab
├── models/                     # Data models
│   ├── Station.java            # Station data model
│   ├── Route.java              # Route data model
│   ├── RouteSegment.java       # Route segment (walk/metro/bus)
│   └── Arrival.java            # Arrival time data
└── utils/                      # Utility classes
    ├── LocationHelper.java     # GPS and location services
    └── LineColorHelper.java    # Metro line colors and names
```

## Key Features Implementation

### 1. Map Integration (Google Maps)

The app uses Google Maps SDK to display:
- Station locations as markers
- Route paths as polylines
- User's current location
- Interactive map controls

**Setup:**
- Add Google Maps API key to `gradle.properties`
- Map is initialized in `MainActivity.onMapReady()`
- Location permission is requested on first launch

### 2. Route Planning

**How it works:**
1. User enters start and end locations (or uses GPS)
2. App calls `/route_from_coords` API endpoint
3. Response contains route segments (walk/metro/bus)
4. Segments are displayed in RecyclerView with icons and durations
5. Route is drawn on the map

**Implementation:** `RouteFragment.java`

### 3. Station Search

**Features:**
- Load all stations from `/api/stations`
- Filter stations by name in real-time
- Display station type (metro/bus)
- Click to view station details

**Implementation:** `StationsFragment.java`

### 4. Live Arrivals

**How it works:**
1. User selects a station
2. App calls `/metro_arrivals` or `/bus_arrivals`
3. Response contains arrival times in minutes
4. Display updates automatically

**Future Enhancement:** Auto-refresh every 30 seconds

### 5. Lines Browsing

**Features:**
- List all metro lines (1-6) with colors
- List all bus lines
- Click to view stations on each line
- Call `/viewmtr` or `/viewbus` API

**Implementation:** `LinesFragment.java`

## API Integration Details

### Base URL Configuration

Edit `ApiClient.java` to set your backend URL:

```java
// Local development (Android emulator)
private static final String BASE_URL = "http://10.0.2.2:5000/";

// Physical device on same network
private static final String BASE_URL = "http://192.168.1.XXX:5000/";

// Production server
private static final String BASE_URL = "https://api.riyadhtransport.com/";
```

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stations` | GET | Get all stations |
| `/nearbystations` | POST | Find nearby stations |
| `/route_from_coords` | POST | Find route from GPS coordinates |
| `/searchstation` | POST | Search for a station |
| `/metro_arrivals` | POST | Get metro arrival times |
| `/bus_arrivals` | POST | Get bus arrival times |
| `/buslines` | GET | Get all bus lines |
| `/mtrlines` | GET | Get all metro lines |
| `/viewbus` | POST | Get bus line details |
| `/viewmtr` | POST | Get metro line details |

### Request/Response Examples

**Get Stations:**
```json
GET /api/stations
Response: [
  {
    "value": "Olaya (Metro)",
    "label": "Olaya (Metro)",
    "type": "metro",
    "lat": 24.7136,
    "lng": 46.6753
  },
  ...
]
```

**Find Route:**
```json
POST /route_from_coords
Body: {
  "start_lat": 24.7136,
  "start_lng": 46.6753,
  "end_lat": 24.8000,
  "end_lng": 46.7000
}
Response: {
  "routes": [{
    "segments": [...],
    "total_time": 1800
  }]
}
```

## UI Components

### Bottom Sheet with Tabs

The main UI uses a bottom sheet that slides up from the bottom, containing three tabs:
1. **Route** - Plan your journey
2. **Stations** - Browse all stations
3. **Lines** - View metro and bus lines

Implementation uses:
- `BottomSheetBehavior` for the sliding panel
- `ViewPager2` for tab content
- `TabLayout` for tab navigation

### RecyclerView Adapters

**StationAdapter:**
- Displays stations in a list
- Supports filtering by name
- Shows station type badge
- Clickable items

**RouteSegmentAdapter:**
- Displays route steps
- Shows duration and distance
- Different icons for walk/metro/bus
- Color-coded for metro lines

## Localization (i18n)

The app supports both English and Arabic:

**English:** `res/values/strings.xml`
**Arabic:** `res/values-ar/strings.xml`

All user-facing text should be in string resources for easy translation.

## Dependencies

Key libraries used:

```gradle
// Material Design
implementation 'com.google.android.material:material:1.10.0'

// Google Maps
implementation 'com.google.android.gms:play-services-maps:18.2.0'
implementation 'com.google.android.gms:play-services-location:21.0.1'

// Networking
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
implementation 'com.squareup.okhttp3:logging-interceptor:4.11.0'

// AndroidX
implementation 'androidx.appcompat:appcompat:1.6.1'
implementation 'androidx.recyclerview:recyclerview:1.3.2'
implementation 'androidx.viewpager2:viewpager2:1.0.0'
```

## Permissions

The app requires these permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Location permission is requested at runtime when needed.

## Building and Testing

### Build Variants

- **Debug**: For development, includes logging
- **Release**: Optimized, requires signing key

### Testing Checklist

1. ✅ App launches successfully
2. ✅ Map displays correctly
3. ✅ Location permission request works
4. ✅ Stations load from API
5. ✅ Search filtering works
6. ⏳ Route planning finds paths
7. ⏳ Live arrivals display
8. ⏳ Lines view shows all lines

### Debugging Tips

**Enable Logging:**
The app uses OkHttp logging interceptor. Check Logcat for API requests/responses.

**Test with Mock Data:**
If backend is unavailable, you can modify adapters to use mock data temporarily.

**Network Issues:**
- Ensure backend server is running
- Check firewall settings
- Verify BASE_URL is correct
- For emulator, use `10.0.2.2` instead of `localhost`

## Future Enhancements

### Phase 2
- Complete route finding with real API integration
- Live arrival times display
- Station details activity with full information
- Line details activity showing all stations

### Phase 3
- Favorites and bookmarks
- Route history
- Offline mode with cached data
- Push notifications for service alerts

### Phase 4
- Widget for home screen
- Dark mode support
- Accessibility improvements
- Performance optimizations

## Code Style Guidelines

- Follow Android code style conventions
- Use meaningful variable names
- Add comments for complex logic
- Keep methods focused and short
- Handle errors gracefully with user-friendly messages

## Performance Considerations

1. **Image Loading**: Consider adding Glide or Picasso for efficient image loading
2. **Caching**: Implement response caching to reduce API calls
3. **Background Tasks**: Use WorkManager for background updates
4. **Memory**: Properly manage RecyclerView adapters and clear references

## Security

1. **API Key**: Never commit API keys to version control
2. **HTTPS**: Use HTTPS for production API endpoints
3. **ProGuard**: Enable code obfuscation for release builds
4. **Certificate Pinning**: Consider for production

## Troubleshooting

### Common Issues

**Map not showing:**
- Check Google Maps API key is valid
- Ensure key has Maps SDK for Android enabled
- Verify `MAPS_API_KEY` in gradle.properties

**Location not working:**
- Check permissions are granted
- Enable location services on device
- For emulator, send mock location data

**API calls failing:**
- Verify backend server is running
- Check BASE_URL configuration
- Review network permissions
- Check Logcat for error details

**Build errors:**
- Clean and rebuild project
- Invalidate caches and restart Android Studio
- Check Gradle sync completed successfully
- Verify all dependencies are available

## Contributing

When contributing to this project:
1. Follow the existing code structure
2. Test on multiple devices/API levels
3. Update documentation for new features
4. Add appropriate comments
5. Handle edge cases and errors

## Contact

For questions or issues, please open an issue on the GitHub repository.
