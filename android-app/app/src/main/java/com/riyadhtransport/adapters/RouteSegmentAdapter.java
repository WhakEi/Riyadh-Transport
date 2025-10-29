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
                    typeText = "Walk to your destination";
                } else {
                    typeText = "Walk to " + destination;
                }
                
                double distanceKm = segment.getDistance() != null ? segment.getDistance() / 1000.0 : 0;
                detailsText = String.format("%.2f km", distanceKm);
                
            } else if (segment.isMetro()) {
                // Metro segment
                iconRes = R.drawable.ic_metro;
                String lineName = LineColorHelper.getMetroLineName(
                        itemView.getContext(), segment.getLine());
                color = LineColorHelper.getMetroLineColor(itemView.getContext(), segment.getLine());
                
                String destination = getDestinationStation(segment);
                typeText = "Take the " + lineName + " and disembark at " + destination;
                detailsText = destination + " (Metro station)";
                
            } else {
                // Bus segment
                iconRes = R.drawable.ic_bus;
                color = LineColorHelper.getBusLineColor(itemView.getContext());
                
                String startStation = getStartStation(segment);
                String destination = getDestinationStation(segment);
                
                typeText = "Take Bus " + segment.getLine() + " and disembark at " + destination;
                detailsText = startStation + " (Bus stop) → " + destination;
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
