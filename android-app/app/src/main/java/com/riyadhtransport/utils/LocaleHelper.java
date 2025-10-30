package com.riyadhtransport.utils;

import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import java.util.Locale;

public class LocaleHelper {
    
    /**
     * Check if the app is currently in Arabic locale
     */
    public static boolean isArabic(Context context) {
        Resources resources = context.getResources();
        Configuration config = resources.getConfiguration();
        Locale locale = config.getLocales().get(0);
        return locale.getLanguage().equals("ar");
    }
    
    /**
     * Get the language code for the current locale
     */
    public static String getLanguageCode(Context context) {
        return isArabic(context) ? "ar" : "en";
    }
    
    /**
     * Get the API path prefix based on current locale
     * Returns "/ar/" if Arabic, empty string otherwise
     */
    public static String getApiPrefix(Context context) {
        return isArabic(context) ? "ar/" : "";
    }
}
