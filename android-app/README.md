# Riyadh Transport Android App

An Android mobile application for Riyadh public transport, built in Java. This app provides route planning, station information, and live arrival times for metro and bus services in Riyadh.

## Features

- **Route Planning**: Find routes between locations using public transport
- **Station Search**: Browse and search all metro and bus stations
- **Live Arrivals**: View real-time arrival information for metro and buses
- **Interactive Map**: View stations and routes with OpenStreetMap and MapTiler
- **GPS Location**: Use your current location as starting point
- **Multilingual**: Supports English and Arabic (العربية) with language-specific map labels

## Prerequisites

- Android Studio Arctic Fox or later
- Android SDK 21 (Lollipop) or higher

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/WhakEi/Riyadh-Transport.git
cd Riyadh-Transport/android-app
```

### 2. Configure Backend Server URL

Open `app/src/main/java/com/riyadhtransport/api/ApiClient.java` and update the `BASE_URL`:

```java
// For local development (use your computer's IP address)
private static final String BASE_URL = "http://192.168.1.XXX:5000/";

// For production
private static final String BASE_URL = "https://your-server.com/";
```

### 3. Build and Run

1. Open the project in Android Studio
2. Wait for Gradle sync to complete
3. Connect an Android device or start an emulator
4. Click Run (▶️) button

## Project Structure

```
android-app/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/riyadhtransport/
│   │       │   ├── adapters/          # RecyclerView adapters
│   │       │   ├── api/               # API service and client
│   │       │   ├── fragments/         # UI fragments
│   │       │   ├── models/            # Data models
│   │       │   ├── utils/             # Utility classes
│   │       │   └── MainActivity.java  # Main activity
│   │       ├── res/
│   │       │   ├── layout/            # XML layouts
│   │       │   ├── values/            # Strings, colors, themes (English)
│   │       │   └── values-ar/         # Arabic translations
│   │       └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## API Integration

The app communicates with the Flask backend server using the following endpoints:

- `GET /api/stations` - Get all stations
- `POST /nearbystations` - Find nearby stations
- `POST /route_from_coords` - Find route from coordinates
- `POST /metro_arrivals` - Get metro arrival times
- `POST /bus_arrivals` - Get bus arrival times
- `GET /buslines` - Get all bus lines
- `GET /mtrlines` - Get all metro lines

## Technologies Used

- **Language**: Java
- **UI Framework**: Android SDK, Material Design Components
- **Maps**: OSMDroid (OpenStreetMap) with MapTiler tiles
- **Location**: Google Play Services Location
- **Networking**: Retrofit 2, OkHttp
- **JSON Parsing**: Gson
- **Architecture**: Fragment-based with ViewPager2 and TabLayout

## Map Features

The app uses **OSMDroid** with **MapTiler** tiles, providing:
- Language-specific map labels (automatically matches app language)
- High-quality street maps
- No API key required
- Open-source mapping solution
- Same map provider as the web frontend for consistency

## Permissions Required

- `ACCESS_FINE_LOCATION` - For GPS-based features
- `ACCESS_COARSE_LOCATION` - For network-based location
- `INTERNET` - For API communication and map tiles
- `ACCESS_NETWORK_STATE` - For network status checking
- `WRITE_EXTERNAL_STORAGE` - For map tile caching (Android 12 and below)
- `READ_EXTERNAL_STORAGE` - For map tile caching (Android 12 and below)

## Testing

The app can be tested with:
- **Android Emulator**: Use Android Studio's built-in emulator
- **Physical Device**: Enable USB debugging and connect your device

Note: For local backend testing on emulator, use `http://10.0.2.2:5000/` as the BASE_URL.

## Known Limitations

- Backend server must be running and accessible
- Some features require active internet connection
- Map tiles are downloaded on demand (requires internet)

## Future Enhancements

- Offline mode with cached data
- Route favorites and history
- Push notifications for service alerts
- Dark mode support
- Widget for quick access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is part of the Riyadh Transport initiative to make public transport easier in Riyadh.

## Support

For issues or questions, please open an issue on the GitHub repository.
