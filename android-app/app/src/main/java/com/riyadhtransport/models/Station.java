package com.riyadhtransport.models;

import com.google.gson.annotations.SerializedName;

public class Station {
    @SerializedName("value")
    private String value;
    
    @SerializedName("label")
    private String label;
    
    @SerializedName("name")
    private String name; // For nearby stations endpoint
    
    @SerializedName("type")
    private String type; // "metro" or "bus"
    
    @SerializedName("lat")
    private double latitude;
    
    @SerializedName("lng")
    private double longitude;
    
    @SerializedName("distance")
    private Double distance; // Distance in meters
    
    @SerializedName("duration")
    private Double duration; // Walking duration in seconds
    
    public Station() {
    }
    
    public Station(String value, String label, String type, double latitude, double longitude) {
        this.value = value;
        this.label = label;
        this.type = type;
        this.latitude = latitude;
        this.longitude = longitude;
    }
    
    public String getValue() {
        return value;
    }
    
    public void setValue(String value) {
        this.value = value;
    }
    
    public String getLabel() {
        return label;
    }
    
    public void setLabel(String label) {
        this.label = label;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public double getLatitude() {
        return latitude;
    }
    
    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }
    
    public double getLongitude() {
        return longitude;
    }
    
    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }
    
    public boolean isMetro() {
        return "metro".equalsIgnoreCase(type);
    }
    
    public boolean isBus() {
        return "bus".equalsIgnoreCase(type);
    }
    
    public String getDisplayName() {
        // Handle both /api/stations and /nearbystations formats
        if (label != null) return label;
        if (name != null) return name;
        return value;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public Double getDistance() {
        return distance;
    }
    
    public void setDistance(Double distance) {
        this.distance = distance;
    }
    
    public Double getDuration() {
        return duration;
    }
    
    public void setDuration(Double duration) {
        this.duration = duration;
    }
}
