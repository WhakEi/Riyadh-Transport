package com.riyadhtransport.adapters;

import android.content.res.ColorStateList;
import android.graphics.PorterDuff;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;
import com.riyadhtransport.R;
import com.riyadhtransport.models.RouteSegment;
import com.riyadhtransport.utils.LineColorHelper;
import java.util.ArrayList;
import java.util.List;

public class RouteSegmentAdapter extends RecyclerView.Adapter<RouteSegmentAdapter.SegmentViewHolder> {
    
    private List<RouteSegment> segments;
    
    public RouteSegmentAdapter() {
        this.segments = new ArrayList<>();
    }
    
    public void setSegments(List<RouteSegment> segments) {
        this.segments = segments;
        notifyDataSetChanged();
    }
    
    @NonNull
    @Override
    public SegmentViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_route_segment, parent, false);
        return new SegmentViewHolder(view);
    }
    
    @Override
    public void onBindViewHolder(@NonNull SegmentViewHolder holder, int position) {
        RouteSegment segment = segments.get(position);
        boolean isLastSegment = (position == segments.size() - 1);
        holder.bind(segment, isLastSegment);
    }
    
    @Override
    public int getItemCount() {
        return segments.size();
    }
    
    static class SegmentViewHolder extends RecyclerView.ViewHolder {
        ImageView segmentIcon;
        TextView segmentType;
        TextView segmentDuration;
        TextView segmentDetails;
        
        SegmentViewHolder(@NonNull View itemView) {
            super(itemView);
            segmentIcon = itemView.findViewById(R.id.segment_icon);
            segmentType = itemView.findViewById(R.id.segment_type);
            segmentDuration = itemView.findViewById(R.id.segment_duration);
            segmentDetails = itemView.findViewById(R.id.segment_details);
        }
        
        void bind(RouteSegment segment, boolean isLastSegment) {
            String typeText;
            String detailsText;
            int iconRes;
            int color;
            
            if (segment.isWalking()) {
                // Walking segment
                iconRes = R.drawable.ic_walk;
                color = LineColorHelper.getWalkColor(itemView.getContext());
                
                // Get destination
                String destination = getDestinationName(segment, isLastSegment);
                
                if (isLastSegment) {
                    typeText = itemView.getContext().getString(R.string.walk_to_destination);
                } else {
                    // Determine if destination is a bus stop or metro station based on next segment
                    String stationType = itemView.getContext().getString(R.string.metro_station); // default
                    typeText = itemView.getContext().getString(R.string.walk_to_station, 
                            destination, stationType);
                }
                
                double distanceKm = segment.getDistance() != null ? segment.getDistance() / 1000.0 : 0;
                detailsText = String.format("%.2f %s", distanceKm, 
                        itemView.getContext().getString(R.string.kilometers));
                
            } else if (segment.isMetro()) {
                // Metro segment
                iconRes = R.drawable.ic_metro;
                String lineName = LineColorHelper.getMetroLineName(
                        itemView.getContext(), segment.getLine());
                color = LineColorHelper.getMetroLineColor(itemView.getContext(), segment.getLine());
                
                String destination = getDestinationStation(segment);
                typeText = itemView.getContext().getString(R.string.take_metro, 
                        lineName, destination);
                detailsText = destination + " (" + itemView.getContext().getString(R.string.metro_station) + ")";
                
            } else {
                // Bus segment
                iconRes = R.drawable.ic_bus;
                color = LineColorHelper.getBusLineColor(itemView.getContext());
                
                String startStation = getStartStation(segment);
                String destination = getDestinationStation(segment);
                
                typeText = itemView.getContext().getString(R.string.take_bus, 
                        segment.getLine(), destination);
                detailsText = startStation + " (" + itemView.getContext().getString(R.string.bus_stop) + ") → " + destination;
            }
            
            // Set icon and color
            segmentIcon.setImageResource(iconRes);
            segmentIcon.setColorFilter(color, PorterDuff.Mode.SRC_IN);
            
            // Set text with color
            segmentType.setText(typeText);
            segmentType.setTextColor(color);
            segmentDetails.setText(detailsText);
            
            // Set duration
            int minutes = (int) Math.ceil(segment.getDuration() / 60.0);
            segmentDuration.setText(minutes + " " + itemView.getContext().getString(R.string.minutes));
        }
        
        private String getDestinationName(RouteSegment segment, boolean isLastSegment) {
            if (isLastSegment) {
                return "your destination";
            }
            
            List<String> stations = segment.getStations();
            if (stations != null && !stations.isEmpty()) {
                return stations.get(stations.size() - 1);
            }
            
            return "next stop";
        }
        
        private String getStartStation(RouteSegment segment) {
            List<String> stations = segment.getStations();
            if (stations != null && !stations.isEmpty()) {
                return stations.get(0);
            }
            return "current location";
        }
        
        private String getDestinationStation(RouteSegment segment) {
            List<String> stations = segment.getStations();
            if (stations != null && !stations.isEmpty()) {
                return stations.get(stations.size() - 1);
            }
            return "destination";
        }
    }
}
