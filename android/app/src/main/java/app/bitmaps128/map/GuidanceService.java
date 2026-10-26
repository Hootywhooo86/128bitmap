package app.bitmaps128.map;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.util.ArrayList;
import java.util.List;

/**
 * Keeps guidance alive with the screen off: a foreground service that asks the phone for its most
 * accurate position about once a second, shows the next turn in an ongoing notification (on the lock
 * screen, and as a Live Update chip on Android 16), and speaks the directions with the phone's own voice.
 */
public class GuidanceService extends Service {
    public interface Sink {
        void onFix(JSObject fix);

        void onEndRequested();
    }

    static final String ACTION_END = "app.bitmaps128.map.END";
    private static final String CHANNEL = "guidance";
    private static final int NOTE_ID = 128;

    static volatile Sink sink;
    static volatile boolean running = false;
    private static GuidanceService instance;

    private FusedLocationProviderClient fused;
    private LocationCallback callback;
    private LocationManager manager;
    private LocationListener plain;
    private PowerManager.WakeLock wake;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<String> queued = new ArrayList<>();
    private AudioFocusRequest focus;

    // ---- helpers the plugin calls ----

    static void say(String text) {
        GuidanceService s = instance;
        if (s != null) s.speakNow(text);
    }

    static void hush() {
        GuidanceService s = instance;
        if (s != null) s.hushNow();
    }

    static void post(Context c, String title, String text, String shortText, int percent, String endLabel) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTE_ID, build(c, title, text, shortText, percent, endLabel));
    }

    private static Notification build(Context c, String title, String text, String shortText, int percent, String endLabel) {
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent end = new Intent(c, GuidanceService.class).setAction(ACTION_END);
        PendingIntent endPi = PendingIntent.getService(c, 1, end, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_nav)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setColor(0xFF1A73E8)
            .setContentIntent(openPi)
            .addAction(R.drawable.ic_stat_nav, endLabel, endPi);

        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16 "Live Updates": shown on the lock screen and always-on display, with a short chip.
            b.setStyle(
                new NotificationCompat.ProgressStyle()
                    .setStyledByProgress(false)
                    .addProgressSegment(new NotificationCompat.ProgressStyle.Segment(100).setColor(0xFF1A73E8))
                    .setProgress(Math.max(0, Math.min(100, percent)))
            );
            b.setRequestPromotedOngoing(true);
            if (shortText != null && !shortText.isEmpty()) b.setShortCriticalText(shortText);
        } else {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(text));
        }
        return b.build();
    }

    // ---- service ----

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_END.equals(intent.getAction())) {
            Sink s = sink;
            if (s != null) s.onEndRequested();
            else stopSelf();
            return START_NOT_STICKY;
        }
        instance = this;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Navigation", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Directions while you travel");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);

        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Navigating";
        String text = intent != null && intent.getStringExtra("text") != null ? intent.getStringExtra("text") : "";
        String end = intent != null && intent.getStringExtra("end") != null ? intent.getStringExtra("end") : "End";
        Notification n = build(this, title, text, "", 0, end);
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(NOTE_ID, n);
        running = true;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (wake == null) {
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "128bitmaps:guidance");
            wake.acquire(6 * 60 * 60 * 1000L);
        }
        startLocation();
        startVoice();
        return START_NOT_STICKY;
    }

    @SuppressLint("MissingPermission")
    private void startLocation() {
        if (callback != null || plain != null) return;
        try {
            fused = LocationServices.getFusedLocationProviderClient(this);
            LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setMinUpdateIntervalMillis(500)
                .setMinUpdateDistanceMeters(0f)
                .setWaitForAccurateLocation(false)
                .build();
            callback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult result) {
                    for (Location l : result.getLocations()) deliver(l);
                }
            };
            fused.requestLocationUpdates(req, callback, Looper.getMainLooper()).addOnFailureListener(e -> startPlain());
        } catch (Throwable t) {
            startPlain();
        }
    }

    // Phones without Google Play services: ask the GPS chip directly.
    @SuppressLint("MissingPermission")
    private void startPlain() {
        if (plain != null) return;
        try {
            manager = (LocationManager) getSystemService(LOCATION_SERVICE);
            plain = this::deliver;
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0f, plain, Looper.getMainLooper());
        } catch (Throwable ignored) {
        }
    }

    private void deliver(Location l) {
        Sink s = sink;
        if (s == null) return;
        JSObject o = new JSObject();
        o.put("lat", l.getLatitude());
        o.put("lng", l.getLongitude());
        o.put("accuracy", l.hasAccuracy() ? l.getAccuracy() : -1);
        o.put("speed", l.hasSpeed() ? l.getSpeed() : -1);
        o.put("heading", l.hasBearing() ? l.getBearing() : -1);
        o.put("time", l.getTime());
        s.onFix(o);
    }

    // ---- voice ----

    private void startVoice() {
        if (tts != null) return;
        tts = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) return;
            tts.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            );
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String id) {}

                @Override
                public void onDone(String id) {
                    giveBackFocus();
                }

                @Override
                public void onError(String id) {
                    giveBackFocus();
                }
            });
            ttsReady = true;
            for (String q : queued) speakNow(q);
            queued.clear();
        });
    }

    private void speakNow(String text) {
        if (!ttsReady) {
            queued.clear();
            queued.add(text);
            return;
        }
        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .build();
        am.requestAudioFocus(focus);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "turn");
    }

    private void hushNow() {
        if (tts != null) tts.stop();
        giveBackFocus();
    }

    private void giveBackFocus() {
        if (focus == null) return;
        ((AudioManager) getSystemService(AUDIO_SERVICE)).abandonAudioFocusRequest(focus);
        focus = null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        instance = null;
        if (fused != null && callback != null) fused.removeLocationUpdates(callback);
        callback = null;
        if (manager != null && plain != null) manager.removeUpdates(plain);
        plain = null;
        if (wake != null && wake.isHeld()) wake.release();
        wake = null;
        hushNow();
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        ttsReady = false;
        super.onDestroy();
    }
}
