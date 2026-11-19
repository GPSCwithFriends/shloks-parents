package com.shloksparents.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Schedules medicine reminders received from the web app. */
public final class Reminders {
    static final String CHANNEL = "meds";
    private static final String PREFS = "reminders";

    private Reminders() { }

    static void createChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel_meds), NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription(c.getString(R.string.channel_meds_desc));
            ch.enableVibration(true);
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    /** json: [{id, at: "yyyy-MM-ddTHH:mm", title, body}] */
    static synchronized void replaceAll(Context c, String json) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(c, p.getString("list", "[]"));
        p.edit().putString("list", json == null ? "[]" : json).apply();
        scheduleAll(c, json);
    }

    static void restore(Context c) {
        scheduleAll(c, c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("list", "[]"));
    }

    private static void scheduleAll(Context c, String json) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US);
        long now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(json == null ? "[]" : json);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                Date when = f.parse(o.getString("at"));
                if (when == null || when.getTime() < now - 60000) continue;
                PendingIntent pi = pending(c, o.getString("id"), o.optString("title"), o.optString("body"));
                long t = Math.max(when.getTime(), now + 2000);
                boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            }
        } catch (Exception ignored) { }
    }

    private static void cancelAll(Context c, String json) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                am.cancel(pending(c, o.getString("id"), o.optString("title"), o.optString("body")));
            }
        } catch (Exception ignored) { }
    }

    private static PendingIntent pending(Context c, String id, String title, String body) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("com.shloksparents.app.REMIND." + id);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
