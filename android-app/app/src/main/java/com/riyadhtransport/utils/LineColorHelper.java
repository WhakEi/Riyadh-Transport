package com.riyadhtransport.utils;

import android.content.Context;
import android.graphics.Color;
import com.riyadhtransport.R;

public class LineColorHelper {
    
    public static int getMetroLineColor(Context context, String lineNumber) {
        if (lineNumber == null) {
            return context.getColor(R.color.colorPrimary);
        }
        
        switch (lineNumber) {
            case "1":
                return context.getColor(R.color.metro_line_1); // Blue
            case "2":
                return context.getColor(R.color.metro_line_2); // Red
            case "3":
                return context.getColor(R.color.metro_line_3); // Orange
            case "4":
                return context.getColor(R.color.metro_line_4); // Yellow
            case "5":
                return context.getColor(R.color.metro_line_5); // Green
            case "6":
                return context.getColor(R.color.metro_line_6); // Purple
            default:
                return context.getColor(R.color.colorPrimary);
        }
    }
    
    public static String getMetroLineName(Context context, String lineNumber) {
        if (lineNumber == null) {
            return "";
        }
        
        switch (lineNumber) {
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
                return "Line " + lineNumber;
        }
    }
    
    public static int getBusLineColor(Context context) {
        return context.getColor(R.color.bus_color);
    }
}
