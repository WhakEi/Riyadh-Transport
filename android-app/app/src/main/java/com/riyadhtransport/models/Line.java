package com.riyadhtransport.models;

import java.util.List;
import java.util.Map;

public class Line {
    private String id;
    private String name;
    private String type; // "metro" or "bus"
    private String color;
    private List<String> directions;
    private Map<String, List<String>> stationsByDirection;
    
    public Line() {}
    
    public Line(String id, String name, String type) {
        this.id = id;
        this.name = name;
        this.type = type;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    
    public List<String> getDirections() { return directions; }
    public void setDirections(List<String> directions) { this.directions = directions; }
    
    public Map<String, List<String>> getStationsByDirection() { return stationsByDirection; }
    public void setStationsByDirection(Map<String, List<String>> stationsByDirection) {
        this.stationsByDirection = stationsByDirection;
    }
    
    public boolean isMetro() {
        return "metro".equalsIgnoreCase(type);
    }
    
    public boolean isBus() {
        return "bus".equalsIgnoreCase(type);
    }
}
