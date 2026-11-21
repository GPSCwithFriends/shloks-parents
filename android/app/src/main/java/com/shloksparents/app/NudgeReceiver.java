package com.shloksparents.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/** Every ~15 minutes asks the family sheet whether the partner sent a reminder, and shows it. */
public class NudgeReceiver extends BroadcastReceiver {
    private static final String PREFS = "nudges";

    static void saveAuth(Context c, String apiUrl, String token) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean changed = !String.valueOf(apiUrl).equals(p.getString("url", "")) || !String.valueOf(token).equals(p.getString("token", ""));
        p.edit().putString("url", apiUrl == null ? "" : apiUrl).putString("token", token == null ? "" : token).apply();
        if (changed || !p.getBoolean("scheduled", false)) schedule(c);
    }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(c, NudgeReceiver.class).setAction("com.shloksparents.app.POLL");
        PendingIntent pi = PendingIntent.getBroadcast(c, 4242, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 60000, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi);
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("scheduled", true).apply();
    }

    @Override
    public void onReceive(final Context c, Intent intent) {
        final SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final String url = p.getString("url", ""), token = p.getString("token", "");
        if (url.isEmpty() || token.isEmpty()) return;
        final PendingResult done = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String full = url + (url.contains("?") ? "&" : "?") + "api=pollNudges&token=" + URLEncoder.encode(token, "UTF-8");
                    HttpURLConnection con = (HttpURLConnection) new URL(full).openConnection();
                    con.setInstanceFollowRedirects(true);
                    con.setConnectTimeout(15000);
                    con.setReadTimeout(20000);
                    int code = con.getResponseCode();
                    // Apps Script answers through a redirect to another host: follow it by hand if needed
                    for (int hops = 0; (code == 301 || code == 302 || code == 303 || code == 307) && hops < 3; hops++) {
                        String loc = con.getHeaderField("Location");
                        con.disconnect();
                        con = (HttpURLConnection) new URL(loc).openConnection();
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(20000);
                        code = con.getResponseCode();
                    }
                    if (code != 200) return;
                    StringBuilder sb = new StringBuilder();
                    BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"));
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();
                    JSONObject res = new JSONObject(sb.toString());
                    if (!res.optBoolean("ok")) return;
                    JSONArray list = res.optJSONArray("data");
                    if (list == null) return;
                    for (int i = 0; i < list.length(); i++) {
                        JSONObject n = list.getJSONObject(i);
                        show(c, n.optString("id"), n.optString("title"), n.optString("body"));
                    }
                } catch (Exception ignored) {
                } finally {
                    done.finish();
                }
            }
        }).start();
    }

    @SuppressWarnings("deprecation")
    private static void show(Context c, String id, String title, String body) {
        Reminders.createChannel(c);
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, Reminders.CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_med).setContentTitle(title).setContentText(body).setColor(0xFF6D28D9)
            .setAutoCancel(true).setContentIntent(tap).setCategory(Notification.CATEGORY_REMINDER);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(("n" + id).hashCode(), b.build()); } catch (SecurityException ignored) { }
    }
}
