package com.riyadhtransport.fragments;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.textfield.TextInputEditText;
import com.riyadhtransport.MainActivity;
import com.riyadhtransport.R;
import com.riyadhtransport.adapters.RouteSegmentAdapter;
import com.riyadhtransport.api.ApiClient;
import com.riyadhtransport.models.Route;
import com.riyadhtransport.models.RouteSegment;
import com.riyadhtransport.utils.LocationHelper;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RouteFragment extends Fragment {
    
    private TextInputEditText startInput;
    private TextInputEditText endInput;
    private Button findRouteButton;
    private Button useLocationButton;
    private LinearLayout routeDetailsContainer;
    private RecyclerView routeSegmentsRecycler;
    private RouteSegmentAdapter segmentAdapter;
    private LocationHelper locationHelper;
    private double currentLat = 0;
    private double currentLng = 0;
    
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
        
        // Get current location
        getCurrentLocation();
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
        
        // TODO: Parse coordinates or station names and call API
        // For now, showing a placeholder
        Toast.makeText(requireContext(), "Finding route from " + start + " to " + end, 
                Toast.LENGTH_SHORT).show();
        
        // If using coordinates (from "My Location")
        if (start.contains("My Location") && currentLat != 0) {
            findRouteFromCoordinates(currentLat, currentLng, end);
        }
    }
    
    private void findRouteFromCoordinates(double startLat, double startLng, String endStation) {
        // This is a simplified version - you'd need to geocode the end station first
        // or allow user to select from stations list
        Toast.makeText(requireContext(), "Route finding not yet fully implemented", 
                Toast.LENGTH_LONG).show();
    }
}
