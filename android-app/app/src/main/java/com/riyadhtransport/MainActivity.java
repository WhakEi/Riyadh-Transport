package com.riyadhtransport;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.fragment.app.Fragment;
import androidx.viewpager2.adapter.FragmentStateAdapter;
import androidx.viewpager2.widget.ViewPager2;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.tabs.TabLayoutMediator;
import com.riyadhtransport.fragments.LinesFragment;
import com.riyadhtransport.fragments.RouteFragment;
import com.riyadhtransport.fragments.StationsFragment;
import com.riyadhtransport.utils.LocationHelper;

public class MainActivity extends AppCompatActivity implements OnMapReadyCallback {
    
    private GoogleMap mMap;
    private TabLayout tabLayout;
    private ViewPager2 viewPager;
    private FloatingActionButton fabMyLocation;
    private LocationHelper locationHelper;
    
    // Riyadh coordinates
    private static final LatLng RIYADH_CENTER = new LatLng(24.7136, 46.6753);
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Initialize location helper
        locationHelper = new LocationHelper(this);
        
        // Initialize views
        tabLayout = findViewById(R.id.tab_layout);
        viewPager = findViewById(R.id.view_pager);
        fabMyLocation = findViewById(R.id.fab_my_location);
        
        // Setup map
        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.map);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }
        
        // Setup ViewPager with tabs
        setupViewPager();
        
        // Setup FAB for my location
        fabMyLocation.setOnClickListener(v -> getCurrentLocation());
        
        // Request location permission if not granted
        if (!LocationHelper.hasLocationPermission(this)) {
            LocationHelper.requestLocationPermission(this);
        }
    }
    
    private void setupViewPager() {
        ViewPagerAdapter adapter = new ViewPagerAdapter(this);
        viewPager.setAdapter(adapter);
        
        new TabLayoutMediator(tabLayout, viewPager, (tab, position) -> {
            switch (position) {
                case 0:
                    tab.setText(R.string.route_tab);
                    break;
                case 1:
                    tab.setText(R.string.stations_tab);
                    break;
                case 2:
                    tab.setText(R.string.lines_tab);
                    break;
            }
        }).attach();
    }
    
    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        mMap = googleMap;
        
        // Move camera to Riyadh
        mMap.moveCamera(CameraUpdateFactory.newLatLngZoom(RIYADH_CENTER, 11));
        
        // Enable location if permission granted
        if (LocationHelper.hasLocationPermission(this)) {
            try {
                mMap.setMyLocationEnabled(true);
            } catch (SecurityException e) {
                e.printStackTrace();
            }
        }
        
        // Configure map UI settings
        mMap.getUiSettings().setZoomControlsEnabled(true);
        mMap.getUiSettings().setCompassEnabled(true);
        mMap.getUiSettings().setMyLocationButtonEnabled(false); // Using custom FAB
    }
    
    private void getCurrentLocation() {
        if (!LocationHelper.hasLocationPermission(this)) {
            LocationHelper.requestLocationPermission(this);
            return;
        }
        
        locationHelper.getCurrentLocation(new LocationHelper.LocationCallback() {
            @Override
            public void onLocationReceived(double latitude, double longitude) {
                LatLng location = new LatLng(latitude, longitude);
                if (mMap != null) {
                    mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(location, 15));
                }
                Toast.makeText(MainActivity.this, 
                        getString(R.string.finding_location), 
                        Toast.LENGTH_SHORT).show();
            }
            
            @Override
            public void onLocationError(String error) {
                Toast.makeText(MainActivity.this, error, Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == LocationHelper.LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (mMap != null) {
                    try {
                        mMap.setMyLocationEnabled(true);
                    } catch (SecurityException e) {
                        e.printStackTrace();
                    }
                }
            } else {
                Toast.makeText(this, R.string.error_permission, Toast.LENGTH_SHORT).show();
            }
        }
    }
    
    public GoogleMap getMap() {
        return mMap;
    }
    
    // ViewPager Adapter
    private static class ViewPagerAdapter extends FragmentStateAdapter {
        
        public ViewPagerAdapter(@NonNull AppCompatActivity activity) {
            super(activity);
        }
        
        @NonNull
        @Override
        public Fragment createFragment(int position) {
            switch (position) {
                case 0:
                    return new RouteFragment();
                case 1:
                    return new StationsFragment();
                case 2:
                    return new LinesFragment();
                default:
                    return new RouteFragment();
            }
        }
        
        @Override
        public int getItemCount() {
            return 3;
        }
    }
}
