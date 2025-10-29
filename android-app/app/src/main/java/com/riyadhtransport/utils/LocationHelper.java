package com.riyadhtransport.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

public class LocationHelper {
    public static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    
    private FusedLocationProviderClient fusedLocationClient;
    private Context context;
    
    public interface LocationCallback {
        void onLocationReceived(double latitude, double longitude);
        void onLocationError(String error);
    }
    
    public LocationHelper(Context context) {
        this.context = context;
        this.fusedLocationClient = LocationServices.getFusedLocationProviderClient(context);
    }
    
    public static boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, 
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    
    public static void requestLocationPermission(Activity activity) {
        ActivityCompat.requestPermissions(activity,
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION},
                LOCATION_PERMISSION_REQUEST_CODE);
    }
    
    public void getCurrentLocation(LocationCallback callback) {
        if (!hasLocationPermission(context)) {
            callback.onLocationError("Location permission not granted");
            return;
        }
        
        try {
            fusedLocationClient.getLastLocation()
                    .addOnSuccessListener(location -> {
                        if (location != null) {
                            callback.onLocationReceived(location.getLatitude(), location.getLongitude());
                        } else {
                            callback.onLocationError("Unable to get location");
                        }
                    })
                    .addOnFailureListener(e -> {
                        callback.onLocationError("Error getting location: " + e.getMessage());
                    });
        } catch (SecurityException e) {
            callback.onLocationError("Location permission error: " + e.getMessage());
        }
    }
    
    public static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000; // Earth radius in meters
        double lat1Rad = Math.toRadians(lat1);
        double lat2Rad = Math.toRadians(lat2);
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLon = Math.toRadians(lon2 - lon1);
        
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }
    
    public static String formatDistance(double meters) {
        if (meters < 1000) {
            return String.format("%.0f m", meters);
        } else {
            return String.format("%.1f km", meters / 1000);
        }
    }
}
