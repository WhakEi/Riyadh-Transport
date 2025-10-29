package com.riyadhtransport.fragments;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.textfield.TextInputEditText;
import com.riyadhtransport.R;
import com.riyadhtransport.adapters.StationAdapter;
import com.riyadhtransport.api.ApiClient;
import com.riyadhtransport.models.Station;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StationsFragment extends Fragment {
    
    private TextInputEditText searchInput;
    private RecyclerView stationsRecycler;
    private StationAdapter stationAdapter;
    
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_stations, container, false);
    }
    
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        // Initialize views
        searchInput = view.findViewById(R.id.search_stations);
        stationsRecycler = view.findViewById(R.id.stations_recycler);
        
        // Setup RecyclerView
        stationAdapter = new StationAdapter(station -> {
            // Handle station click - show details
            Toast.makeText(requireContext(), 
                    "Station: " + station.getDisplayName(), 
                    Toast.LENGTH_SHORT).show();
            // TODO: Navigate to StationDetailsActivity
        });
        
        stationsRecycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        stationsRecycler.setAdapter(stationAdapter);
        
        // Setup search
        searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                stationAdapter.filter(s.toString());
            }
            
            @Override
            public void afterTextChanged(Editable s) {}
        });
        
        // Load stations
        loadStations();
    }
    
    private void loadStations() {
        ApiClient.getApiService().getStations().enqueue(new Callback<List<Station>>() {
            @Override
            public void onResponse(@NonNull Call<List<Station>> call, 
                                   @NonNull Response<List<Station>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    stationAdapter.setStations(response.body());
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
}
