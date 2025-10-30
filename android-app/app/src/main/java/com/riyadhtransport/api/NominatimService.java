package com.riyadhtransport.api;

import com.riyadhtransport.models.NominatimResult;
import java.util.List;
import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Query;

public interface NominatimService {
    
    @GET("search")
    Call<List<NominatimResult>> search(
            @Query("q") String query,
            @Query("format") String format,
            @Query("limit") int limit,
            @Query("bounded") int bounded,
            @Query("viewbox") String viewbox
    );
}
