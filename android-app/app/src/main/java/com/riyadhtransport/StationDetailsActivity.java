package com.riyadhtransport;

import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.riyadhtransport.api.ApiClient;
import com.riyadhtransport.models.Arrival;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StationDetailsActivity extends AppCompatActivity {
    
    private TextView stationNameText;
    private RecyclerView arrivalsRecycler;
    private String stationName;
    private String stationType; // "metro" or "bus"
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_station_details);
        
        // Get station info from intent
        stationName = getIntent().getStringExtra("station_name");
        stationType = getIntent().getStringExtra("station_type");
        
        if (stationName == null) {
            Toast.makeText(this, "Error: No station specified", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        
        // Initialize views
        stationNameText = findViewById(R.id.station_name);
        arrivalsRecycler = findViewById(R.id.arrivals_recycler);
        
        // Set station name
        stationNameText.setText(stationName);
        
        // Setup RecyclerView
        arrivalsRecycler.setLayoutManager(new LinearLayoutManager(this));
        
        // Load arrivals
        loadArrivals();
    }
    
    private void loadArrivals() {
        Map<String, String> body = new HashMap<>();
        body.put("station_name", stationName);
        
        Call<Map<String, Object>> call;
        if ("metro".equalsIgnoreCase(stationType)) {
            call = ApiClient.getApiService().getMetroArrivals(body);
        } else {
            call = ApiClient.getApiService().getBusArrivals(body);
        }
        
        call.enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, 
                                   Response<Map<String, Object>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    // Handle arrivals data
                    Toast.makeText(StationDetailsActivity.this, 
                            "Arrivals loaded", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(StationDetailsActivity.this, 
                            "Failed to load arrivals", Toast.LENGTH_SHORT).show();
                }
            }
            
            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                Toast.makeText(StationDetailsActivity.this, 
                        "Error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
