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
    
    private static Retrofit retrofit = null;
    private static TransportApiService apiService = null;
    
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
    
    // Method to update base URL if needed
    public static void setBaseUrl(String url) {
        retrofit = null;
        apiService = null;
        // Will be recreated with new URL on next call
    }
}
