package com.shloksparents.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts reminders back after the phone restarts or the app is updated. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Reminders.restore(c);
    }
}
