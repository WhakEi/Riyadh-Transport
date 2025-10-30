package com.riyadhtransport.fragments;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.riyadhtransport.MainActivity;
import com.riyadhtransport.R;
import com.riyadhtransport.adapters.RouteSegmentAdapter;
import com.riyadhtransport.api.ApiClient;
import com.riyadhtransport.models.Route;
import com.riyadhtransport.models.RouteSegment;
import com.riyadhtransport.models.Station;
import com.riyadhtransport.utils.LocationHelper;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Polyline;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RouteFragment extends Fragment {
    
    private AutoCompleteTextView startInput;
    private AutoCompleteTextView endInput;
    private Button findRouteButton;
    private Button useLocationButton;
    private LinearLayout routeDetailsContainer;
    private RecyclerView routeSegmentsRecycler;
    private RouteSegmentAdapter segmentAdapter;
    private LocationHelper locationHelper;
    private double currentLat = 0;
    private double currentLng = 0;
    private List<Station> allStations = new ArrayList<>();
    private Map<String, Station> stationMap = new HashMap<>();
    
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_route, container, false);
    }
    
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        locationHelper = new LocationHelper(requireContext());
        
        // Initialize views
        startInput = view.findViewById(R.id.start_input);
        endInput = view.findViewById(R.id.end_input);
        findRouteButton = view.findViewById(R.id.find_route_button);
        useLocationButton = view.findViewById(R.id.use_location_button);
        routeDetailsContainer = view.findViewById(R.id.route_details_container);
        routeSegmentsRecycler = view.findViewById(R.id.route_segments_recycler);
        
        // Setup RecyclerView
        segmentAdapter = new RouteSegmentAdapter();
        routeSegmentsRecycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        routeSegmentsRecycler.setAdapter(segmentAdapter);
        
        // Setup listeners
        findRouteButton.setOnClickListener(v -> findRoute());
        useLocationButton.setOnClickListener(v -> useMyLocation());
        
        // Load stations for autocomplete
        loadStations();
        
        // Get current location
        getCurrentLocation();
    }
    
    private void loadStations() {
        ApiClient.getApiService().getStations().enqueue(new Callback<List<Station>>() {
            @Override
            public void onResponse(@NonNull Call<List<Station>> call, 
                                   @NonNull Response<List<Station>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    allStations = response.body();
                    
                    // Build station name list and map
                    List<String> stationNames = new ArrayList<>();
                    for (Station station : allStations) {
                        String name = station.getDisplayName();
                        stationNames.add(name);
                        stationMap.put(name, station);
                    }
                    
                    // Setup autocomplete adapters
                    ArrayAdapter<String> adapter = new ArrayAdapter<>(
                            requireContext(),
                            android.R.layout.simple_dropdown_item_1line,
                            stationNames
                    );
                    startInput.setAdapter(adapter);
                    endInput.setAdapter(adapter);
                } else {
                    Toast.makeText(requireContext(), 
                            R.string.error_network, 
                            Toast.LENGTH_SHORT).show();
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<List<Station>> call, @NonNull Throwable t) {
                Toast.makeText(requireContext(), 
                        getString(R.string.error_network) + ": " + t.getMessage(), 
                        Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void getCurrentLocation() {
        if (!LocationHelper.hasLocationPermission(requireContext())) {
            startInput.setHint(R.string.enter_destination);
            return;
        }
        
        locationHelper.getCurrentLocation(new LocationHelper.LocationCallback() {
            @Override
            public void onLocationReceived(double latitude, double longitude) {
                currentLat = latitude;
                currentLng = longitude;
                startInput.setHint(R.string.use_my_location);
            }
            
            @Override
            public void onLocationError(String error) {
                startInput.setHint(R.string.enter_destination);
            }
        });
    }
    
    private void useMyLocation() {
        if (currentLat == 0 && currentLng == 0) {
            getCurrentLocation();
            Toast.makeText(requireContext(), R.string.finding_location, Toast.LENGTH_SHORT).show();
        } else {
            startInput.setText(String.format("My Location (%.4f, %.4f)", currentLat, currentLng));
        }
    }
    
    private void findRoute() {
        String start = startInput.getText() != null ? startInput.getText().toString() : "";
        String end = endInput.getText() != null ? endInput.getText().toString() : "";
        
        if (start.isEmpty() || end.isEmpty()) {
            Toast.makeText(requireContext(), "Please enter both start and end locations", 
                    Toast.LENGTH_SHORT).show();
            return;
        }
        
        // Parse coordinates from text if present
        double startLat = 0, startLng = 0, endLat = 0, endLng = 0;
        boolean startIsCoord = false, endIsCoord = false;
        
        // Check if start is a coordinate (from map tap or "My Location")
        if (start.contains("Location (") || start.contains("My Location")) {
            startLat = currentLat;
            startLng = currentLng;
            startIsCoord = true;
        }
        
        // Check if end is a coordinate (from map tap)
        if (end.contains("Location (")) {
            // Parse coordinates from text like "Location (24.1234, 46.5678)"
            try {
                String coords = end.substring(end.indexOf("(") + 1, end.indexOf(")"));
                String[] parts = coords.split(",");
                endLat = Double.parseDouble(parts[0].trim());
                endLng = Double.parseDouble(parts[1].trim());
                endIsCoord = true;
            } catch (Exception e) {
                // Failed to parse, treat as station name
            }
        }
        
        // Get coordinates based on input types
        if (startIsCoord && endIsCoord) {
            // Both coordinates
            findRouteFromCoordinates(startLat, startLng, endLat, endLng);
        } else if (startIsCoord && !endIsCoord) {
            // Start is coordinate, end is station
            Station endStation = stationMap.get(end);
            if (endStation != null) {
                findRouteFromCoordinates(startLat, startLng, 
                        endStation.getLatitude(), endStation.getLongitude());
            } else {
                Toast.makeText(requireContext(), 
                        "Please select a valid station for destination", 
                        Toast.LENGTH_SHORT).show();
            }
        } else if (!startIsCoord && endIsCoord) {
            // Start is station, end is coordinate
            Station startStation = stationMap.get(start);
            if (startStation != null) {
                findRouteFromCoordinates(startStation.getLatitude(), startStation.getLongitude(),
                        endLat, endLng);
            } else {
                Toast.makeText(requireContext(), 
                        "Please select a valid station for origin", 
                        Toast.LENGTH_SHORT).show();
            }
        } else {
            // Both are station names
            Station startStation = stationMap.get(start);
            Station endStation = stationMap.get(end);
            
            if (startStation != null && endStation != null) {
                findRouteFromCoordinates(startStation.getLatitude(), startStation.getLongitude(),
                        endStation.getLatitude(), endStation.getLongitude());
            } else {
                Toast.makeText(requireContext(), 
                        "Please select valid stations from the list", 
                        Toast.LENGTH_SHORT).show();
            }
        }
    }
    
    private void findRouteFromCoordinates(double startLat, double startLng, 
                                          double endLat, double endLng) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("start_lat", startLat);
        requestBody.put("start_lng", startLng);
        requestBody.put("end_lat", endLat);
        requestBody.put("end_lng", endLng);
        
        ApiClient.getApiService().findRouteFromCoordinates(requestBody)
                .enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(@NonNull Call<Map<String, Object>> call, 
                                   @NonNull Response<Map<String, Object>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> responseBody = response.body();
                    
                    if (responseBody.containsKey("routes")) {
                        List<Map<String, Object>> routes = 
                                (List<Map<String, Object>>) responseBody.get("routes");
                        
                        if (routes != null && !routes.isEmpty()) {
                            Map<String, Object> route = routes.get(0);
                            displayRoute(route);
                        } else {
                            Toast.makeText(requireContext(), 
                                    R.string.no_route_found, 
                                    Toast.LENGTH_SHORT).show();
                        }
                    } else if (responseBody.containsKey("error")) {
                        String error = (String) responseBody.get("error");
                        Toast.makeText(requireContext(), 
                                "Error: " + error, 
                                Toast.LENGTH_SHORT).show();
                    }
                } else {
                    Toast.makeText(requireContext(), 
                            "Failed to find route", 
                            Toast.LENGTH_SHORT).show();
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<Map<String, Object>> call, @NonNull Throwable t) {
                Toast.makeText(requireContext(), 
                        getString(R.string.error_network) + ": " + t.getMessage(), 
                        Toast.LENGTH_LONG).show();
            }
        });
    }
    
    private void displayRoute(Map<String, Object> route) {
        try {
            // Parse route segments
            Gson gson = new Gson();
            String json = gson.toJson(route);
            Route routeObj = gson.fromJson(json, Route.class);
            
            if (routeObj != null && routeObj.getSegments() != null) {
                segmentAdapter.setSegments(routeObj.getSegments());
                routeDetailsContainer.setVisibility(View.VISIBLE);
                
                // Draw route on map
                drawRouteOnMap(routeObj);
            }
        } catch (Exception e) {
            Toast.makeText(requireContext(), 
                    "Error displaying route: " + e.getMessage(), 
                    Toast.LENGTH_SHORT).show();
        }
    }
    
    private void drawRouteOnMap(Route route) {
        if (getActivity() == null || !(getActivity() instanceof MainActivity)) {
            return;
        }
        
        MainActivity mainActivity = (MainActivity) getActivity();
        MapView mapView = mainActivity.getMapView();
        
        if (mapView == null) {
            return;
        }
        
        // Clear existing route overlays (keep location overlay)
        mapView.getOverlays().removeIf(overlay -> overlay instanceof Polyline);
        
        // Draw each segment
        for (RouteSegment segment : route.getSegments()) {
            Polyline line = new Polyline();
            List<GeoPoint> points = new ArrayList<>();
            
            // Get segment coordinates based on type
            if (segment.isWalking()) {
                // Walking segment - dotted gray line (matching frontend walk color)
                line.setColor(Color.parseColor("#6c757d"));
                line.getPaint().setStrokeWidth(8f);
                line.getPaint().setPathEffect(new DashPathEffect(new float[]{10, 20}, 0));
                
                addSegmentPoints(segment, points);
                
            } else if (segment.isMetro()) {
                // Metro segment - color based on line (matching frontend colors)
                int lineColor = com.riyadhtransport.utils.LineColorHelper.getMetroLineColor(
                        requireContext(), segment.getLine());
                line.setColor(lineColor);
                line.getPaint().setStrokeWidth(10f);
                
                addSegmentPoints(segment, points);
                
            } else if (segment.isBus()) {
                // Bus segment - green line (matching frontend bus color)
                line.setColor(Color.parseColor("#18a034"));
                line.getPaint().setStrokeWidth(10f);
                
                addSegmentPoints(segment, points);
            }
            
            if (!points.isEmpty()) {
                line.setPoints(points);
                mapView.getOverlays().add(line);
            }
        }
        
        mapView.invalidate();
        
        // Zoom to show the entire route
        if (!route.getSegments().isEmpty()) {
            zoomToRoute(mapView, route);
        }
    }
    
    private void addSegmentPoints(RouteSegment segment, List<GeoPoint> points) {
        // For now, we'll need to get coordinates from stations
        // This is a simplified version - you may need to enhance based on your data structure
        if (segment.getStations() != null && !segment.getStations().isEmpty()) {
            for (String stationName : segment.getStations()) {
                Station station = stationMap.get(stationName);
                if (station != null) {
                    points.add(new GeoPoint(station.getLatitude(), station.getLongitude()));
                }
            }
        }
    }
    
    private void zoomToRoute(MapView mapView, Route route) {
        double minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        
        for (RouteSegment segment : route.getSegments()) {
            if (segment.getStations() != null) {
                for (String stationName : segment.getStations()) {
                    Station station = stationMap.get(stationName);
                    if (station != null) {
                        double lat = station.getLatitude();
                        double lon = station.getLongitude();
                        
                        minLat = Math.min(minLat, lat);
                        maxLat = Math.max(maxLat, lat);
                        minLon = Math.min(minLon, lon);
                        maxLon = Math.max(maxLon, lon);
                    }
                }
            }
        }
        
        if (minLat != 90) {
            // Calculate center and zoom
            double centerLat = (minLat + maxLat) / 2;
            double centerLon = (minLon + maxLon) / 2;
            
            mapView.getController().setCenter(new GeoPoint(centerLat, centerLon));
            
            // Calculate appropriate zoom level based on bounds
            double latDiff = maxLat - minLat;
            double lonDiff = maxLon - minLon;
            double maxDiff = Math.max(latDiff, lonDiff);
            
            int zoomLevel = 15; // Default
            if (maxDiff > 0.1) zoomLevel = 12;
            else if (maxDiff > 0.05) zoomLevel = 13;
            else if (maxDiff > 0.02) zoomLevel = 14;
            
            mapView.getController().setZoom((double) zoomLevel);
        }
    }
    
    // Public methods for setting locations from map tap
    public void setStartLocation(double latitude, double longitude) {
        currentLat = latitude;
        currentLng = longitude;
        startInput.setText(String.format("Location (%.4f, %.4f)", latitude, longitude));
    }
    
    public void setEndLocation(double latitude, double longitude) {
        endInput.setText(String.format("Location (%.4f, %.4f)", latitude, longitude));
    }
}
