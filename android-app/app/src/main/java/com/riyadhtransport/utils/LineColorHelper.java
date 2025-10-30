package com.riyadhtransport.utils;

import android.content.Context;
import android.graphics.Color;
import com.riyadhtransport.R;

public class LineColorHelper {
    
    public static int getMetroLineColor(Context context, String lineNumber) {
        if (lineNumber == null) {
            return context.getColor(R.color.colorPrimary);
        }
        
        // Handle cases where backend returns "Line Blue Line", "Line Orange Line", etc.
        String cleanLine = lineNumber.trim();
        if (cleanLine.startsWith("Line ")) {
            cleanLine = cleanLine.substring(5).trim();
        }
        
        // Check for color names
        if (cleanLine.equalsIgnoreCase("Blue Line") || cleanLine.equals("1")) {
            return context.getColor(R.color.metro_line_1);
        } else if (cleanLine.equalsIgnoreCase("Red Line") || cleanLine.equals("2")) {
            return context.getColor(R.color.metro_line_2);
        } else if (cleanLine.equalsIgnoreCase("Orange Line") || cleanLine.equals("3")) {
            return context.getColor(R.color.metro_line_3);
        } else if (cleanLine.equalsIgnoreCase("Yellow Line") || cleanLine.equals("4")) {
            return context.getColor(R.color.metro_line_4);
        } else if (cleanLine.equalsIgnoreCase("Green Line") || cleanLine.equals("5")) {
            return context.getColor(R.color.metro_line_5);
        } else if (cleanLine.equalsIgnoreCase("Purple Line") || cleanLine.equals("6")) {
            return context.getColor(R.color.metro_line_6);
        }
        
        // Fallback for numeric line numbers
        switch (cleanLine) {
            case "1":
                return context.getColor(R.color.metro_line_1);
            case "2":
                return context.getColor(R.color.metro_line_2);
            case "3":
                return context.getColor(R.color.metro_line_3);
            case "4":
                return context.getColor(R.color.metro_line_4);
            case "5":
                return context.getColor(R.color.metro_line_5);
            case "6":
                return context.getColor(R.color.metro_line_6);
            default:
                return context.getColor(R.color.colorPrimary);
        }
    }
    
    public static String getMetroLineName(Context context, String lineNumber) {
        if (lineNumber == null) {
            return "";
        }
        
        // Handle cases where backend returns "Line Blue Line", "Line Orange Line", etc.
        String cleanLine = lineNumber.trim();
        if (cleanLine.startsWith("Line ")) {
            cleanLine = cleanLine.substring(5).trim();
        }
        
        // Check for color names
        if (cleanLine.equalsIgnoreCase("Blue Line") || cleanLine.equals("1")) {
            return context.getString(R.string.blue_line);
        } else if (cleanLine.equalsIgnoreCase("Red Line") || cleanLine.equals("2")) {
            return context.getString(R.string.red_line);
        } else if (cleanLine.equalsIgnoreCase("Orange Line") || cleanLine.equals("3")) {
            return context.getString(R.string.orange_line);
        } else if (cleanLine.equalsIgnoreCase("Yellow Line") || cleanLine.equals("4")) {
            return context.getString(R.string.yellow_line);
        } else if (cleanLine.equalsIgnoreCase("Green Line") || cleanLine.equals("5")) {
            return context.getString(R.string.green_line);
        } else if (cleanLine.equalsIgnoreCase("Purple Line") || cleanLine.equals("6")) {
            return context.getString(R.string.purple_line);
        }
        
        // Fallback for numeric line numbers
        switch (cleanLine) {
            case "1":
                return context.getString(R.string.blue_line);
            case "2":
                return context.getString(R.string.red_line);
            case "3":
                return context.getString(R.string.orange_line);
            case "4":
                return context.getString(R.string.yellow_line);
            case "5":
                return context.getString(R.string.green_line);
            case "6":
                return context.getString(R.string.purple_line);
            default:
                return cleanLine;
        }
    }
    
    public static int getBusLineColor(Context context) {
        return context.getColor(R.color.bus_color);
    }
    
    public static int getWalkColor(Context context) {
        return context.getColor(R.color.walk_color);
    }
    
    public static int getColorForSegment(Context context, String type, String line) {
        if ("walk".equalsIgnoreCase(type)) {
            return getWalkColor(context);
        } else if ("metro".equalsIgnoreCase(type) && line != null) {
            return getMetroLineColor(context, line);
        } else if ("bus".equalsIgnoreCase(type)) {
            return getBusLineColor(context);
        }
        return context.getColor(R.color.colorPrimary);
    }
}
