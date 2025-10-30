package com.riyadhtransport.models;

import com.google.gson.annotations.SerializedName;

public class NominatimResult {
    
    @SerializedName("place_id")
    private long placeId;
    
    @SerializedName("display_name")
    private String displayName;
    
    @SerializedName("lat")
    private String latitude;
    
    @SerializedName("lon")
    private String longitude;
    
    @SerializedName("type")
    private String type;
    
    @SerializedName("importance")
    private double importance;
    
    public NominatimResult() {
    }
    
    public long getPlaceId() {
        return placeId;
    }
    
    public void setPlaceId(long placeId) {
        this.placeId = placeId;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
    
    public String getLatitude() {
        return latitude;
    }
    
    public void setLatitude(String latitude) {
        this.latitude = latitude;
    }
    
    public String getLongitude() {
        return longitude;
    }
    
    public void setLongitude(String longitude) {
        this.longitude = longitude;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public double getImportance() {
        return importance;
    }
    
    public void setImportance(double importance) {
        this.importance = importance;
    }
    
    public double getLatitudeAsDouble() {
        try {
            return Double.parseDouble(latitude);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
    
    public double getLongitudeAsDouble() {
        try {
            return Double.parseDouble(longitude);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
