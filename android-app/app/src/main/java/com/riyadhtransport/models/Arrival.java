package com.riyadhtransport.models;

import com.google.gson.annotations.SerializedName;

public class Arrival {
    @SerializedName("line")
    private String line;
    
    @SerializedName("destination")
    private String destination;
    
    @SerializedName("minutes_until")
    private int minutesUntil;
    
    public Arrival() {
    }
    
    public Arrival(String line, String destination, int minutesUntil) {
        this.line = line;
        this.destination = destination;
        this.minutesUntil = minutesUntil;
    }
    
    public String getLine() {
        return line;
    }
    
    public void setLine(String line) {
        this.line = line;
    }
    
    public String getDestination() {
        return destination;
    }
    
    public void setDestination(String destination) {
        this.destination = destination;
    }
    
    public int getMinutesUntil() {
        return minutesUntil;
    }
    
    public void setMinutesUntil(int minutesUntil) {
        this.minutesUntil = minutesUntil;
    }
}
