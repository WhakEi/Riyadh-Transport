package com.riyadhtransport.api;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

import java.util.concurrent.TimeUnit;

public class ApiClient {
    // Update this URL to point to your backend server
    // For testing with local server, use: http://10.0.2.2:5000/ (Android emulator)
    // For production, use your actual server URL
    private static final String BASE_URL = "http://10.0.2.2:5000/";
    private static final String NOMINATIM_URL = "https://nominatim.openstreetmap.org/";
    
    private static Retrofit retrofit = null;
    private static Retrofit nominatimRetrofit = null;
    private static TransportApiService apiService = null;
    private static NominatimService nominatimService = null;
    
    public static Retrofit getClient() {
        if (retrofit == null) {
            // Create logging interceptor for debugging
            HttpLoggingInterceptor loggingInterceptor = new HttpLoggingInterceptor();
            loggingInterceptor.setLevel(HttpLoggingInterceptor.Level.BODY);
            
            // Create OkHttpClient with timeout settings
            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(loggingInterceptor)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();
            
            // Create Retrofit instance
            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit;
    }
    
    public static TransportApiService getApiService() {
        if (apiService == null) {
            apiService = getClient().create(TransportApiService.class);
        }
        return apiService;
    }
    
    private static Retrofit getNominatimClient() {
        if (nominatimRetrofit == null) {
            // Create OkHttpClient with timeout settings
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS)
                    .addInterceptor(chain -> {
                        // Add User-Agent header as required by Nominatim
                        return chain.proceed(
                                chain.request()
                                        .newBuilder()
                                        .header("User-Agent", "RiyadhTransportApp/1.0")
                                        .build()
                        );
                    })
                    .build();
            
            // Create Retrofit instance for Nominatim
            nominatimRetrofit = new Retrofit.Builder()
                    .baseUrl(NOMINATIM_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return nominatimRetrofit;
    }
    
    public static NominatimService getNominatimService() {
        if (nominatimService == null) {
            nominatimService = getNominatimClient().create(NominatimService.class);
        }
        return nominatimService;
    }
    
    // Method to update base URL if needed
    public static void setBaseUrl(String url) {
        retrofit = null;
        apiService = null;
        // Will be recreated with new URL on next call
    }
}
