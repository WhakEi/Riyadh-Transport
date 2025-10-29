package com.riyadhtransport.models;

import com.google.gson.annotations.SerializedName;

public class Station {
    @SerializedName("value")
    private String value;
    
    @SerializedName("label")
    private String label;
    
    @SerializedName("type")
    private String type; // "metro" or "bus"
    
    @SerializedName("lat")
    private double latitude;
    
    @SerializedName("lng")
    private double longitude;
    
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
        return label != null ? label : value;
    }
}
