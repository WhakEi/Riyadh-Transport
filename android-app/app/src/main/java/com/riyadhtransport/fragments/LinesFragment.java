package com.riyadhtransport.fragments;

import android.app.AlertDialog;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.JsonObject;
import com.riyadhtransport.R;
import com.riyadhtransport.adapters.LineAdapter;
import com.riyadhtransport.api.ApiClient;
import com.riyadhtransport.models.Line;
import com.riyadhtransport.utils.LineColorHelper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LinesFragment extends Fragment {
    
    private TextInputEditText searchInput;
    private RecyclerView linesRecycler;
    private LineAdapter lineAdapter;
    private boolean linesLoaded = false;
    
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_lines, container, false);
    }
    
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        // Initialize views
        searchInput = view.findViewById(R.id.search_lines);
        linesRecycler = view.findViewById(R.id.lines_recycler);
        
        // Setup RecyclerView
        lineAdapter = new LineAdapter(line -> showLineDetails(line));
        linesRecycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        linesRecycler.setAdapter(lineAdapter);
        
        // Setup search
        searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                lineAdapter.filter(s.toString());
            }
            
            @Override
            public void afterTextChanged(Editable s) {}
        });
        
        // Load lines data
        if (!linesLoaded) {
            loadLines();
        }
    }
    
    private void loadLines() {
        List<Line> allLines = new ArrayList<>();
        
        // Load metro lines
        ApiClient.getApiService().getMetroLines().enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(@NonNull Call<JsonObject> call, @NonNull Response<JsonObject> response) {
                if (response.isSuccessful() && response.body() != null) {
                    String linesStr = response.body().get("lines").getAsString();
                    String[] metroLines = linesStr.split(",");
                    
                    for (String lineId : metroLines) {
                        String lineName = LineColorHelper.getMetroLineName(requireContext(), lineId);
                        allLines.add(new Line(lineId, lineName, true));
                    }
                    
                    // After metro lines loaded, load bus lines
                    loadBusLines(allLines);
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<JsonObject> call, @NonNull Throwable t) {
                Toast.makeText(requireContext(), 
                        getString(R.string.error_network), 
                        Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void loadBusLines(List<Line> allLines) {
        ApiClient.getApiService().getBusLines().enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(@NonNull Call<JsonObject> call, @NonNull Response<JsonObject> response) {
                if (response.isSuccessful() && response.body() != null) {
                    String linesStr = response.body().get("lines").getAsString();
                    String[] busLines = linesStr.split(",");
                    
                    for (String lineId : busLines) {
                        allLines.add(new Line(lineId, getString(R.string.bus) + " " + lineId, false));
                    }
                    
                    // Update adapter
                    lineAdapter.setLines(allLines);
                    linesLoaded = true;
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<JsonObject> call, @NonNull Throwable t) {
                // Still show metro lines if bus lines fail
                lineAdapter.setLines(allLines);
                linesLoaded = true;
            }
        });
    }
    
    private void showLineDetails(Line line) {
        // Fetch line data from backend
        if (line.isMetro()) {
            loadMetroLineDetails(line);
        } else {
            loadBusLineDetails(line);
        }
    }
    
    private void loadMetroLineDetails(Line line) {
        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("line", line.getLineId());
        
        ApiClient.getApiService().viewMetro(requestBody).enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(@NonNull Call<JsonObject> call, @NonNull Response<JsonObject> response) {
                if (response.isSuccessful() && response.body() != null) {
                    JsonObject data = response.body();
                    List<String> stations = new ArrayList<>();
                    if (data.has("stations")) {
                        data.getAsJsonArray("stations").forEach(element -> 
                                stations.add(element.getAsString()));
                    }
                    showStationsList(line, stations);
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<JsonObject> call, @NonNull Throwable t) {
                Toast.makeText(requireContext(), 
                        getString(R.string.error_network), 
                        Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void loadBusLineDetails(Line line) {
        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("line", line.getLineId());
        
        ApiClient.getApiService().viewBus(requestBody).enqueue(new Callback<JsonObject>() {
            @Override
            public void onResponse(@NonNull Call<JsonObject> call, @NonNull Response<JsonObject> response) {
                if (response.isSuccessful() && response.body() != null) {
                    JsonObject data = response.body();
                    
                    // Bus lines have directions as keys
                    List<String> directions = new ArrayList<>();
                    for (Map.Entry<String, com.google.gson.JsonElement> entry : data.entrySet()) {
                        directions.add(entry.getKey());
                    }
                    
                    if (directions.size() == 1) {
                        // Ring route - single direction
                        List<String> stations = new ArrayList<>();
                        data.getAsJsonArray(directions.get(0)).forEach(element -> 
                                stations.add(element.getAsString()));
                        showStationsList(line, stations);
                    } else if (directions.size() >= 2) {
                        // Bi-directional route - show direction selector
                        showDirectionSelector(line, data, directions);
                    }
                }
            }
            
            @Override
            public void onFailure(@NonNull Call<JsonObject> call, @NonNull Throwable t) {
                Toast.makeText(requireContext(), 
                        getString(R.string.error_network), 
                        Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void showDirectionSelector(Line line, JsonObject lineData, List<String> directions) {
        String dir1 = directions.get(0);
        String dir2 = directions.get(1);
        
        String[] options = {
                dir1 + " → " + dir2,
                dir2 + " → " + dir1
        };
        
        new AlertDialog.Builder(requireContext())
                .setTitle(R.string.select_direction)
                .setItems(options, (dialog, which) -> {
                    String selectedDirection = which == 0 ? dir1 : dir2;
                    List<String> stations = new ArrayList<>();
                    lineData.getAsJsonArray(selectedDirection).forEach(element -> 
                            stations.add(element.getAsString()));
                    showStationsList(line, stations);
                })
                .show();
    }
    
    private void showStationsList(Line line, List<String> stations) {
        // Create dialog with list of stations
        AlertDialog.Builder builder = new AlertDialog.Builder(requireContext());
        builder.setTitle(line.getLineName());
        
        // Create view for stations list
        LinearLayout layout = new LinearLayout(requireContext());
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 16, 32, 16);
        
        for (int i = 0; i < stations.size(); i++) {
            TextView stationView = new TextView(requireContext());
            stationView.setText((i + 1) + ". " + stations.get(i));
            stationView.setTextSize(16);
            stationView.setPadding(16, 12, 16, 12);
            
            // Set color based on line type
            if (line.isMetro()) {
                int color = LineColorHelper.getMetroLineColor(requireContext(), line.getLineId());
                stationView.setTextColor(color);
            } else {
                int color = LineColorHelper.getBusLineColor(requireContext());
                stationView.setTextColor(color);
            }
            
            layout.addView(stationView);
        }
        
        builder.setView(layout);
        builder.setPositiveButton(android.R.string.ok, null);
        builder.show();
    }
}
