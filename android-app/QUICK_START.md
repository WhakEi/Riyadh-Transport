# Quick Start Guide - Riyadh Transport Android App

## Get Started in 5 Minutes!

### Prerequisites
- ✅ Android Studio installed
- ✅ Android device or emulator
- ✅ Internet connection

### Step 1: Open Project (1 minute)

1. Open Android Studio
2. Click "Open" or "File → Open"
3. Navigate to `Riyadh-Transport/android-app/`
4. Click "OK"
5. Wait for Gradle sync to complete

### Step 2: Configure API Key (1 minute)

#### Option A: Get Your Own Google Maps Key (Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Maps SDK for Android"
4. Create API key in "Credentials"
5. Open `gradle.properties`
6. Replace:
   ```
   MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
   ```
   with:
   ```
   MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXX
   ```

#### Option B: Test Without Maps (Quick)
Skip this step - map will show blank but rest of app works

### Step 3: Configure Backend URL (1 minute)

Open `app/src/main/java/com/riyadhtransport/api/ApiClient.java`

**For Android Emulator:**
```java
private static final String BASE_URL = "http://10.0.2.2:5000/";
```

**For Physical Device (same WiFi as backend):**
```java
private static final String BASE_URL = "http://192.168.1.XXX:5000/";
// Replace XXX with your computer's IP
```

**For Production Server:**
```java
private static final String BASE_URL = "https://your-domain.com/";
```

### Step 4: Run the App (2 minutes)

1. Connect device via USB (enable USB debugging) OR start emulator
2. Click the green "Run" button (▶️) in Android Studio
3. Select your device
4. Wait for installation
5. App launches! 🎉

## Troubleshooting

### "Map is blank"
➡️ Need valid Google Maps API key (see Step 2)

### "Network error"
➡️ Check backend server is running:
```bash
cd Riyadh-Transport
python server.py
```

### "Location permission denied"
➡️ In app, tap "Allow" when prompted
➡️ Or: Settings → Apps → Riyadh Transport → Permissions → Location

### "Build failed"
➡️ Try:
- File → Invalidate Caches → Invalidate and Restart
- Build → Clean Project
- Build → Rebuild Project

### "Emulator won't start"
➡️ Create new virtual device:
- Tools → Device Manager → Create Device
- Select Pixel 5 or similar
- Download system image if needed

## Testing Without Backend

You can test the UI without a backend server:

1. Open `StationsFragment.java`
2. Comment out `loadStations()` call
3. Add mock data:
```java
List<Station> mockStations = new ArrayList<>();
mockStations.add(new Station("Olaya", "Olaya (Metro)", "metro", 24.7136, 46.6753));
mockStations.add(new Station("King Abdullah", "King Abdullah (Metro)", "metro", 24.7200, 46.6800));
stationAdapter.setStations(mockStations);
```

## What You Can Test

### ✅ Working Features
- App launches
- Map displays (with API key)
- Bottom sheet slides up/down
- Tabs switch (Route, Stations, Lines)
- Location button requests permission
- Search bars work
- UI is responsive

### ⏳ Needs Backend
- Loading actual stations
- Finding routes
- Showing arrivals
- Line information

## Quick Customization

### Change App Name
Edit `res/values/strings.xml`:
```xml
<string name="app_name">Your App Name</string>
```

### Change Colors
Edit `res/values/colors.xml`:
```xml
<color name="colorPrimary">#YOUR_COLOR</color>
```

### Change Map Initial Position
Edit `MainActivity.java`:
```java
private static final LatLng RIYADH_CENTER = new LatLng(YOUR_LAT, YOUR_LNG);
```

## Development Tips

### Enable Logging
Logs are already enabled! View in Logcat:
- Filter: `TransportApp`
- Level: `Debug` or `Verbose`

### Hot Reload
Apply Changes button (⚡) for quick iterations without full rebuild

### Layout Inspector
Tools → Layout Inspector to debug UI

### Database Inspector
Tools → Database Inspector (if using local DB)

## Next Steps

After basic setup:

1. **Read the Docs**
   - `README.md` - User guide
   - `DEVELOPER_GUIDE.md` - Deep dive
   - `PROJECT_SUMMARY.md` - Overview

2. **Start Backend**
   ```bash
   cd Riyadh-Transport
   pip install flask flask-cors requests pytz cloudscraper
   python server.py
   ```

3. **Test Features**
   - Open app
   - Grant location permission
   - Click "Use My Location"
   - Search for stations
   - Browse lines

4. **Customize**
   - Add your branding
   - Modify colors
   - Adjust layouts
   - Add features

## Common Tasks

### Add a New Screen
1. Create Activity: `New → Activity → Empty Activity`
2. Design layout in `res/layout/`
3. Add to `AndroidManifest.xml`
4. Navigate from existing screen

### Add a New Model
1. Create class in `models/` package
2. Add Gson annotations: `@SerializedName`
3. Generate getters/setters
4. Use in API service

### Modify API Endpoint
1. Edit `api/TransportApiService.java`
2. Add method with Retrofit annotations
3. Call from Fragment/Activity
4. Handle response

## Keyboard Shortcuts

- **Build**: `Ctrl/Cmd + F9`
- **Run**: `Shift + F10`
- **Debug**: `Shift + F9`
- **Find**: `Ctrl/Cmd + F`
- **Format Code**: `Ctrl/Cmd + Alt/Opt + L`
- **Go to Declaration**: `Ctrl/Cmd + B`

## Resources

### Official Docs
- [Android Developers](https://developer.android.com/)
- [Material Design](https://material.io/)
- [Google Maps Android](https://developers.google.com/maps/documentation/android-sdk)
- [Retrofit](https://square.github.io/retrofit/)

### Useful Links
- [Stack Overflow](https://stackoverflow.com/questions/tagged/android)
- [Android Weekly](https://androidweekly.net/)
- [GitHub Issues](https://github.com/WhakEi/Riyadh-Transport/issues)

## Getting Help

1. Check the documentation first
2. Search for error in Stack Overflow
3. Check Logcat for error details
4. Open issue on GitHub
5. Ask in Android development communities

## Success Checklist

- [ ] Project opens in Android Studio
- [ ] Gradle sync completes successfully
- [ ] App builds without errors
- [ ] App installs on device/emulator
- [ ] Map displays (if API key configured)
- [ ] Location permission works
- [ ] Tabs switch correctly
- [ ] No crashes during basic navigation

## That's It!

You're now ready to develop the Riyadh Transport Android app! 🚀

For detailed information, refer to:
- `README.md` for user documentation
- `DEVELOPER_GUIDE.md` for technical details
- `PROJECT_SUMMARY.md` for architecture overview

Happy coding! 🎉
