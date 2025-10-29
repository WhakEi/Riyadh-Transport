package com.riyadhtransport.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android:view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
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
        holder.bind(segment);
    }
    
    @Override
    public int getItemCount() {
        return segments.size();
    }
    
    static class SegmentViewHolder extends RecyclerView.ViewHolder {
        TextView segmentType;
        TextView segmentDuration;
        TextView segmentDetails;
        
        SegmentViewHolder(@NonNull View itemView) {
            super(itemView);
            segmentType = itemView.findViewById(R.id.segment_type);
            segmentDuration = itemView.findViewById(R.id.segment_duration);
            segmentDetails = itemView.findViewById(R.id.segment_details);
        }
        
        void bind(RouteSegment segment) {
            String typeText;
            String detailsText;
            
            if (segment.isWalking()) {
                typeText = itemView.getContext().getString(R.string.walk);
                double distanceKm = segment.getDistance() / 1000.0;
                detailsText = String.format("%.2f km", distanceKm);
            } else if (segment.isMetro()) {
                String lineName = LineColorHelper.getMetroLineName(
                        itemView.getContext(), segment.getLine());
                typeText = itemView.getContext().getString(R.string.metro) + " - " + lineName;
                int stops = segment.getStopCount();
                detailsText = stops + " " + itemView.getContext().getString(R.string.stops);
            } else {
                typeText = itemView.getContext().getString(R.string.bus) + " " + segment.getLine();
                int stops = segment.getStopCount();
                detailsText = stops + " " + itemView.getContext().getString(R.string.stops);
            }
            
            segmentType.setText(typeText);
            segmentDetails.setText(detailsText);
            
            int minutes = (int) Math.ceil(segment.getDuration() / 60.0);
            segmentDuration.setText(minutes + " " + itemView.getContext().getString(R.string.minutes));
        }
    }
}
