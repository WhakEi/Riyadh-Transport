package com.riyadhtransport;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

public class RouteDetailsActivity extends AppCompatActivity {
    
    private RecyclerView routeSegmentsRecycler;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_route_details);
        
        // Initialize views
        routeSegmentsRecycler = findViewById(R.id.route_segments_recycler);
        
        // Setup RecyclerView
        routeSegmentsRecycler.setLayoutManager(new LinearLayoutManager(this));
        
        // TODO: Get route data from intent and display
    }
}
