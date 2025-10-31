package com.riyadhtransport.api;

import com.google.gson.JsonObject;
import com.riyadhtransport.models.Arrival;
import com.riyadhtransport.models.Route;
import com.riyadhtransport.models.Station;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;

public interface TransportApiService {
    
    @GET("api/stations")
    Call<List<Station>> getStations();
    
    @POST("nearbystations")
    Call<List<Station>> getNearbyStations(@Body Map<String, Object> coordinates);
    
    @POST("route_from_coords")
    Call<Map<String, Object>> findRouteFromCoordinates(@Body Map<String, Object> coordinates);
    
    @POST("searchstation")
    Call<Map<String, Object>> searchStation(@Body Map<String, String> stationName);
    
    @POST("metro_arrivals")
    Call<Map<String, Object>> getMetroArrivals(@Body Map<String, String> stationName);
    
    @POST("bus_arrivals")
    Call<Map<String, Object>> getBusArrivals(@Body Map<String, String> stationName);
    
    @GET("buslines")
    Call<JsonObject> getBusLines();
    
    @GET("mtrlines")
    Call<JsonObject> getMetroLines();
    
    @POST("viewbus")
    Call<JsonObject> viewBus(@Body JsonObject lineNumber);
    
    @POST("viewmtr")
    Call<JsonObject> viewMetro(@Body JsonObject lineNumber);
}
