package com.riyadhtransport.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Route {
    @SerializedName("segments")
    private List<RouteSegment> segments;
    
    @SerializedName("total_time")
    private double totalTime; // in seconds
    
    public Route() {
    }
    
    public Route(List<RouteSegment> segments, double totalTime) {
        this.segments = segments;
        this.totalTime = totalTime;
    }
    
    public List<RouteSegment> getSegments() {
        return segments;
    }
    
    public void setSegments(List<RouteSegment> segments) {
        this.segments = segments;
    }
    
    public double getTotalTime() {
        return totalTime;
    }
    
    public void setTotalTime(double totalTime) {
        this.totalTime = totalTime;
    }
    
    public int getTotalMinutes() {
        return (int) Math.ceil(totalTime / 60.0);
    }
}
