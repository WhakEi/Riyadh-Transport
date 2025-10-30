package com.riyadhtransport.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.riyadhtransport.R;
import com.riyadhtransport.models.Station;
import java.util.ArrayList;
import java.util.List;

public class StationAdapter extends RecyclerView.Adapter<StationAdapter.StationViewHolder> {
    
    private List<Station> stations;
    private List<Station> stationsFiltered;
    private OnStationClickListener listener;
    
    public interface OnStationClickListener {
        void onStationClick(Station station);
    }
    
    public StationAdapter(OnStationClickListener listener) {
        this.stations = new ArrayList<>();
        this.stationsFiltered = new ArrayList<>();
        this.listener = listener;
    }
    
    public void setStations(List<Station> stations) {
        this.stations = stations;
        this.stationsFiltered = new ArrayList<>(stations);
        notifyDataSetChanged();
    }
    
    public void filter(String query) {
        stationsFiltered.clear();
        if (query.isEmpty()) {
            stationsFiltered.addAll(stations);
        } else {
            String lowerQuery = query.toLowerCase();
            for (Station station : stations) {
                if (station.getDisplayName().toLowerCase().contains(lowerQuery)) {
                    stationsFiltered.add(station);
                }
            }
        }
        notifyDataSetChanged();
    }
    
    @NonNull
    @Override
    public StationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_station, parent, false);
        return new StationViewHolder(view);
    }
    
    @Override
    public void onBindViewHolder(@NonNull StationViewHolder holder, int position) {
        Station station = stationsFiltered.get(position);
        holder.bind(station, listener);
    }
    
    @Override
    public int getItemCount() {
        return stationsFiltered.size();
    }
    
    static class StationViewHolder extends RecyclerView.ViewHolder {
        TextView stationName;
        TextView stationType;
        TextView stationDistance;
        
        StationViewHolder(@NonNull View itemView) {
            super(itemView);
            stationName = itemView.findViewById(R.id.station_name);
            stationType = itemView.findViewById(R.id.station_type);
            stationDistance = itemView.findViewById(R.id.station_distance);
        }
        
        void bind(Station station, OnStationClickListener listener) {
            stationName.setText(station.getDisplayName());
            
            String type = station.isMetro() ? 
                    itemView.getContext().getString(R.string.metro) : 
                    itemView.getContext().getString(R.string.bus);
            stationType.setText(type);
            
            // Display distance and walking time if available
            if (station.getDistance() != null && station.getDuration() != null) {
                double distanceMeters = station.getDistance();
                double durationSeconds = station.getDuration();
                
                String distanceStr;
                if (distanceMeters < 1000) {
                    distanceStr = String.format("%.0f %s", distanceMeters, 
                            itemView.getContext().getString(R.string.meters));
                } else {
                    distanceStr = String.format("%.2f %s", distanceMeters / 1000, 
                            itemView.getContext().getString(R.string.kilometers));
                }
                
                int walkMinutes = (int) Math.ceil(durationSeconds / 60.0);
                String walkTimeStr = walkMinutes + " " + itemView.getContext().getString(R.string.minutes) + 
                        " " + itemView.getContext().getString(R.string.walk).toLowerCase();
                
                stationDistance.setText(distanceStr + " • " + walkTimeStr);
                stationDistance.setVisibility(View.VISIBLE);
            } else {
                stationDistance.setVisibility(View.GONE);
            }
            
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onStationClick(station);
                }
            });
        }
    }
}
