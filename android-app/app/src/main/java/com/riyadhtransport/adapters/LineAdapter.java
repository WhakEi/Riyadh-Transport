package com.riyadhtransport.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.riyadhtransport.R;
import com.riyadhtransport.models.Line;
import com.riyadhtransport.utils.LineColorHelper;
import java.util.ArrayList;
import java.util.List;

public class LineAdapter extends RecyclerView.Adapter<LineAdapter.LineViewHolder> {
    
    private List<Line> lines;
    private List<Line> filteredLines;
    private OnLineClickListener listener;
    
    public interface OnLineClickListener {
        void onLineClick(Line line);
    }
    
    public LineAdapter(OnLineClickListener listener) {
        this.lines = new ArrayList<>();
        this.filteredLines = new ArrayList<>();
        this.listener = listener;
    }
    
    public void setLines(List<Line> lines) {
        this.lines = lines;
        this.filteredLines = new ArrayList<>(lines);
        notifyDataSetChanged();
    }
    
    public void filter(String query) {
        filteredLines.clear();
        if (query == null || query.isEmpty()) {
            filteredLines.addAll(lines);
        } else {
            String lowerQuery = query.toLowerCase();
            for (Line line : lines) {
                if (line.getLineId().toLowerCase().contains(lowerQuery) ||
                    line.getLineName().toLowerCase().contains(lowerQuery)) {
                    filteredLines.add(line);
                }
            }
        }
        notifyDataSetChanged();
    }
    
    @NonNull
    @Override
    public LineViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_line, parent, false);
        return new LineViewHolder(view);
    }
    
    @Override
    public void onBindViewHolder(@NonNull LineViewHolder holder, int position) {
        Line line = filteredLines.get(position);
        holder.bind(line, listener);
    }
    
    @Override
    public int getItemCount() {
        return filteredLines.size();
    }
    
    static class LineViewHolder extends RecyclerView.ViewHolder {
        ImageView lineIcon;
        TextView lineName;
        TextView lineType;
        View colorIndicator;
        
        LineViewHolder(@NonNull View itemView) {
            super(itemView);
            lineIcon = itemView.findViewById(R.id.line_icon);
            lineName = itemView.findViewById(R.id.line_name);
            lineType = itemView.findViewById(R.id.line_type);
            colorIndicator = itemView.findViewById(R.id.color_indicator);
        }
        
        void bind(Line line, OnLineClickListener listener) {
            lineName.setText(line.getLineName());
            
            if (line.isMetro()) {
                lineIcon.setImageResource(R.drawable.ic_metro);
                lineType.setText(R.string.metro);
                
                // Set color based on metro line
                int color = LineColorHelper.getMetroLineColor(itemView.getContext(), line.getLineId());
                colorIndicator.setBackgroundColor(color);
                lineIcon.setColorFilter(color);
            } else {
                lineIcon.setImageResource(R.drawable.ic_bus);
                lineType.setText(itemView.getContext().getString(R.string.bus) + " " + line.getLineId());
                
                // Set bus color
                int color = LineColorHelper.getBusLineColor(itemView.getContext());
                colorIndicator.setBackgroundColor(color);
                lineIcon.setColorFilter(color);
            }
            
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onLineClick(line);
                }
            });
        }
    }
}
