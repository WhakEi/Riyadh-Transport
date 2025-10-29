# Add project specific ProGuard rules here.
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class com.riyadhtransport.models.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**
