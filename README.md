# Shlok's Parents: Android app and iPhone app

This repository turns the Apps Script app into:
- an **iPhone / Android home-screen app** (web app on GitHub Pages, folder `docs/`)
- an **Android APK**, built for you automatically by GitHub (folder `android/`)

The data still lives in your Google Sheet. The Apps Script backend (folder `apps-script/`) is the server for all of them.

---

## Step 1: Update the Apps Script backend (once)
1. In script.google.com, open the project. Replace **Code.gs**, **Js.html** and **Css.html** with the files from `apps-script/`, and add **Finance.gs** as a new script file named **Finance**. Save, then run **setup** once (it only adds the new finance sheets).
2. **Deploy → Manage deployments → ✏ → Version: New version → Deploy**.
3. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`). If it contains `/u/5/`, remove that part.
   **Who has access** must be **Anyone**.

## Step 2: Put this repository on GitHub
1. Sign in at github.com and click **New repository**. Name it `shloks-parents` and make it **Public** (free GitHub Pages needs public).
   Your family data is NOT in this repository; it stays in your Google Sheet, protected by your PINs.
2. Click **uploading an existing file**. Drag in **everything** from the unzipped folder (`docs`, `android`, `apps-script`, `.github`, `README.md`, `.gitignore`) and click **Commit changes**.
   - If the `.github` folder does not upload, click **Add file → Create new file**, type the name `.github/workflows/android.yml`, paste that file's contents, and commit.

## Step 3: Turn on the web app (for iPhone and Android)
1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**.
3. After 1–2 minutes your app is at **`https://<your-github-name>.github.io/shloks-parents/`**.

## Step 4: Get the Android APK
1. Open the **Actions** tab. If asked, click **I understand… enable workflows**.
2. **Build Android app** runs by itself after every upload (or click it → **Run workflow**). It takes about 5 minutes.
3. Open **Releases → latest** and download **ShloksParents.apk** on the Android phone. Tap it, allow **Install unknown apps** for Chrome or Files when asked, then **Install**.
   - Every new upload builds a new version that installs over the old one, so your login stays.

## Step 5: iPhone
1. Open `https://<your-github-name>.github.io/shloks-parents/` in **Safari** (not Chrome).
2. Tap **Share → Add to Home Screen → Add**. It opens full-screen with the Shlok's Parents icon.

## First time on each phone
The app asks for the server link. Paste the **Web app URL** from Step 1 and tap **Connect**. Then choose your name and enter your PIN.
To skip this on every phone, you can put the link in `docs/config.js` (`window.SP_API_DEFAULT = '…/exec';`). Note that the link then becomes visible in the public repository; your PINs still protect the data.

## Updating later
- **Web / iPhone**: upload the changed files in `docs/`. Phones get the update the next time the app opens.
- **Android**: the APK opens the same GitHub Pages web app, so most changes need **no new APK**. Only changes inside `android/` need a new build (this happens automatically).
- **Backend**: paste the new `apps-script` files and make a new deployment version.

---
Designed & Developed by Shlok's Parents · Approved by Shlok: *da, da, da, da!!*
