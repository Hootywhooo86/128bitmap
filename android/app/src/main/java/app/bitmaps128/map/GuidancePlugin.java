package app.bitmaps128.map;

import android.Manifest;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** The bridge between the web app and the phone-only parts of guidance. */
@CapacitorPlugin(
    name = "Guidance",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class GuidancePlugin extends Plugin {
    @Override
    public void load() {
        GuidanceService.sink = new GuidanceService.Sink() {
            @Override
            public void onFix(JSObject fix) {
                notifyListeners("fix", fix);
            }

            @Override
            public void onEndRequested() {
                notifyListeners("end", new JSObject());
            }
        };
    }

    @Override
    protected void handleOnDestroy() {
        GuidanceService.sink = null;
    }

    // Asks for location and (on Android 13+) permission to show the lock-screen notification.
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED && getPermissionState("notifications") != PermissionState.PROMPT) {
            report(call);
            return;
        }
        requestPermissionForAliases(new String[] { "location", "notifications" }, call, "afterAccess");
    }

    @PermissionCallback
    private void afterAccess(PluginCall call) {
        report(call);
    }

    private void report(PluginCall call) {
        JSObject o = new JSObject();
        o.put("location", getPermissionState("location") == PermissionState.GRANTED);
        o.put("notifications", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(o);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location is off for this app.");
            return;
        }
        Intent i = new Intent(getContext(), GuidanceService.class);
        i.putExtra("title", call.getString("title", "Navigating"));
        i.putExtra("text", call.getString("text", ""));
        i.putExtra("end", call.getString("end", "End"));
        try {
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't start guidance in the background: " + e.getMessage());
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        if (!GuidanceService.running) {
            call.resolve();
            return;
        }
        GuidanceService.post(
            getContext(),
            call.getString("title", ""),
            call.getString("text", ""),
            call.getString("short", ""),
            call.getInt("percent", 0),
            call.getString("end", "End")
        );
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), GuidanceService.class));
        setShowOnLock(false);
        call.resolve();
    }

    @PluginMethod
    public void speak(PluginCall call) {
        GuidanceService.say(call.getString("text", ""));
        call.resolve();
    }

    @PluginMethod
    public void hush(PluginCall call) {
        GuidanceService.hush();
        call.resolve();
    }

    // While navigating, let the app appear over the lock screen (like Google Maps does).
    @PluginMethod
    public void showOnLock(PluginCall call) {
        setShowOnLock(Boolean.TRUE.equals(call.getBoolean("on", false)));
        call.resolve();
    }

    private void setShowOnLock(boolean on) {
        getActivity().runOnUiThread(() -> getActivity().setShowWhenLocked(on));
    }
}
