# Shlok's Parents: setup guide (Google Apps Script)

You need about 15 minutes, a Google account (the one that will own the data), and these 7 files:
`Code.gs`, `Finance.gs`, `Life.gs`, `Detox.gs`, `Index.html`, `Css.html`, `Js.html`, `Logo.html`, `appsscript.json`.

## 1. Create the project
1. Open **script.google.com** and click **New project**. Rename it to **Shlok's Parents**.
2. In the editor, `Code.gs` already exists. Delete everything in it and paste in the contents of **Code.gs**. Then click **+ → Script**, name it **Finance**, and paste in **Finance.gs**. Do the same twice more: **+ → Script** named **Life** (paste **Life.gs**) and **+ → Script** named **Detox** (paste **Detox.gs**).
3. Click **+ → HTML** four times and create files named exactly **Index**, **Css**, **Js** and **Logo** (the editor adds `.html` itself). Paste the matching file's contents into each one.
4. Open **Project Settings (gear icon)** and tick **"Show appsscript.json manifest file in editor"**. Go back to the editor, open `appsscript.json`, and replace its contents with the provided **appsscript.json**.
5. Save (Ctrl + S).

## 2. Run setup once
1. At the top, choose **setup** from the function list and click **Run**.
2. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced → Go to Shlok's Parents (unsafe) → Allow**. This is normal for your own scripts.
3. When it finishes, the **Execution log** shows a link to the new Google Sheet **"Shlok's Parents — Data"**. All data lives in that sheet, and all tasks are already filled in.
4. Starting PINs: **Dr. Arpita = 1111**, **Mehul = 2222**. Each of you must choose your own new PIN at first login.

`setup` also creates two automatic jobs:
- every evening at 19:00: an email reminder for to-do items due tomorrow (or overdue)
- every Sunday at 20:00: the weekly report

## 3. Publish the web app
1. Click **Deploy → New deployment**, then the gear next to "Select type" → **Web app**.
2. Description: `v1`. **Execute as: Me**. **Who has access: Anyone**.
   (Anyone with the link can open the login page, but nothing can be seen without your name and PIN.)
3. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

## 4. Put it on both phones
- Open the URL in **Chrome** (Android) and choose **⋮ → Add to Home screen**. On iPhone use Safari → **Share → Add to Home Screen**.
- Log in, choose your name, enter the starting PIN, then set your own PIN.
- You stay logged in on that phone for 30 days.

## 5. Gemini for the weekly report (optional, recommended)
1. Open **aistudio.google.com/apikey** and create a free API key.
2. In the app, open **⚙ Settings**, paste the key into **Gemini API key** and press **Save**.
3. Also in Settings: the **reminder emails** (both of yours, separated by commas) and the **value of the month** for Shlok.

Without a key, the report still works using simple rules (counts and the most common reasons).

## Changing things later
- **Task times, names, days**: edit the **Tasks** sheet.
  - `days` = `daily`, or weekday numbers (`0` = Sunday … `6` = Saturday). For example, running is `2,4,6`.
  - `ladder` = the 7 step-by-step times used by the change plan; `-` means "not yet at this level".
- **Change-plan level and water goal**: use the buttons at the bottom of the **Report** tab.
- **After changing the code**: use **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The URL stays the same.
- **Removed tasks** are only switched off (`active = 0` in the Tasks sheet), so old reports still make sense. Set `active` back to `1` to restore one.

## Adding the Finance module to an app you already set up
1. Click **+ → Script**, name it **Finance**, and paste in **Finance.gs**. Replace **Code.gs**, **Js.html** and **Css.html** with the new versions.
2. Run **setup** once more. It only adds the new sheets (Expenses, Receipts, Rules, Recurring, FinReports) and the 5-minute screenshot reader. Your existing data is not touched.
3. **Deploy → Manage deployments → ✏ → New version → Deploy**.

## Update: simple design, Medicine, Shlok, Reading (Nov 2026)
1. Click **+ → Script**, name it **Life**, and paste in **Life.gs**.
2. Replace **Code.gs**, **Finance.gs**, **Js.html** and **Css.html** with the new versions.
3. Choose `setup` in the function dropdown and click **Run** (this adds the sheets Medicines, MedLog, ShlokLog, Media and Learnings).
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** The link stays the same.
5. GitHub: upload the new `docs/index.html`, `docs/sw.js` and the `android/` folder. The Android app builds again by itself (Actions tab); install the new APK over the old one.
6. On Android, allow notifications when the app asks. On Android 12, if reminders come late, open Settings → Apps → Shlok's Parents → Alarms & reminders → Allow.

Medicine reminders: Android rings at the time even when the app is closed. iPhone shows pending medicines at the top of Today whenever you open the app. Both phones get Shlok's medicine reminders.

## Update: Digital Detox, many screenshots at once, clearer tasks (Nov 2026)
1. Click **+ → Script**, name it **Detox**, and paste in **Detox.gs**.
2. Replace **Code.gs**, **Finance.gs**, **Life.gs**, **Js.html** and **Css.html** with the new versions.
3. Choose `setup` and click **Run** (adds the DetoxShots and DetoxDays sheets and new columns).
4. **Deploy → Manage deployments → ✏️ → New version → Deploy.**
5. GitHub: upload the new `docs/index.html`, `docs/sw.js` and the `android/` folder. Install the new APK when Actions finishes (this fixes the screenshot button on Android).
6. Optional: Settings → second (backup) Gemini key from another Google account.

The AI now tries several free Gemini models in turn. If all are busy, screenshots wait and are tried again every 5 minutes, so results arrive within a day.

## Update: voice entry, yesterday catch-up, partner reminders, offline, last-3 picks (Nov 2026)
1. Replace **Code.gs**, **Finance.gs**, **Life.gs**, **Detox.gs** and **Js.html**.
2. Run `setup` once (adds the Nudges sheet), then **Deploy → Manage deployments → New version**.
3. GitHub: upload the new `docs/index.html`, `docs/sw.js` and the `android/` folder, then install the new APK (needed for partner reminders as notifications and the microphone on Android). Allow the microphone the first time you tap 🎤.

## If something goes wrong
- **Screenshots stay on "Waiting for AI"**: add the Gemini key in ⚙ Settings, or tap **Read now**. The automatic reader runs every 5 minutes.
- **Phone shows "Sorry, unable to open the file at present"**: the link has an account number in it, like `script.google.com/macros/u/5/s/…`. Delete the `u/5/` part so it reads `script.google.com/macros/s/…/exec`. Also check that the deployment's **Who has access** is **Anyone**.
- **Times show as 1899-12-30**: paste in the latest `Code.gs` and run **repairData** once from the editor. Then make a new deployment version.
- **"Run setup() once…"**: step 2 was not completed.
- **Locked after wrong PINs**: wait 5 minutes.
- **Forgot a PIN**: in the editor, run **resetPinArpita** or **resetPinMehul**. The PIN goes back to the starting PIN (1111 / 2222), and a new one must be chosen at next login.
