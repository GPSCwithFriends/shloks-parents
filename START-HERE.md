# શરૂઆત અહીંથી / Start here (first time, from zero)

Total time: about 30 minutes on a **laptop** (easier than a phone for the upload).
You need: your Apps Script **Web app URL** (ends in `/exec`). Get it from **script.google.com → your project → Deploy → Manage deployments**.

---

## A. Update Apps Script first (5 min)
1. Open your project on script.google.com.
2. Replace the contents of **Code.gs**, **Js.html** and **Css.html** with the files in the `apps-script` folder.
3. Click **+ → Script**, name it **Finance**, and paste in `apps-script/Finance.gs`.
4. Choose **setup** in the function list and click **Run**. It only adds the new sheets; your data stays.
5. **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
6. Copy the **Web app URL**. If it contains `/u/0/` or `/u/5/`, remove that part.
   Check that **Who has access** is **Anyone**.

## B. Create a GitHub account (5 min, skip if you have one)
1. Go to **github.com → Sign up**. Use any email and choose a short username, e.g. `mehulranavasiya`.
   This username becomes part of your app link: `https://mehulranavasiya.github.io/shloks-parents/`
2. Verify your email.

## C. Create the repository and upload the files (10 min)
1. On GitHub, click **+ (top right) → New repository**.
2. Repository name: **shloks-parents**. Choose **Public**. Do **not** tick "Add a README". Click **Create repository**.
3. On the next page, click the link **"uploading an existing file"**.
4. Unzip `shloks-parents-github.zip` on the laptop. Open the unzipped folder, select **everything inside it**
   (`.github`, `android`, `apps-script`, `docs`, `README.md`, `START-HERE.md`, `.gitignore`), and drag it all into the GitHub page.
   - On Windows, if you can't see `.github`: in File Explorer choose **View → Show → Hidden items**.
5. Wait until all files appear in the list, then click **Commit changes** at the bottom.
6. Check: the repository's main page should show the folders **.github, android, apps-script, docs**.
   - If **.github** is missing: click **Add file → Create new file**, type exactly `.github/workflows/android.yml` as the name,
     open the `android.yml` file from the zip in Notepad, copy everything, paste it, and click **Commit changes**.

## D. Turn on the website: iPhone and Android app link (3 min)
1. In the repository: **Settings → Pages** (left menu).
2. Source: **Deploy from a branch**. Branch: **main**, folder: **/docs**. Click **Save**.
3. Wait 2 minutes and refresh. The page shows: **"Your site is live at https://<username>.github.io/shloks-parents/"**.
4. Open that link once on the laptop. The app asks for the server link: paste the **Web app URL** from step A6 and click **Connect**.

## E. Build the Android app (5–8 min, automatic)
1. Click the **Actions** tab. If you see a green button **"I understand my workflows, go ahead and enable them"**, click it.
2. Click **Build Android app** on the left, then **Run workflow → Run workflow**.
3. Wait until the circle turns into a green ✓ (about 5–8 minutes). A red ✗ means the build failed: click it and send me a screenshot.
4. Go back to the repository's main page. On the right you'll see **Releases → latest**. Open it.

## F. Install on the Android phone
1. On the phone, open `https://github.com/<username>/shloks-parents/releases/latest`.
2. Tap **ShloksParents.apk** to download it. When downloaded, tap it.
3. If asked, allow **Install unknown apps** for Chrome (or Files), then tap **Install**.
4. Open **Shlok's Parents**, paste the server link once, and log in with your name and PIN.

## G. Install on an iPhone
1. On the iPhone, open `https://<username>.github.io/shloks-parents/` in **Safari**.
2. Tap **Share (□↑) → Add to Home Screen → Add**.
3. Open it from the home screen, paste the server link once, and log in.

---
### Optional: skip pasting the server link on every phone
On GitHub, open `docs/config.js` → ✏ (edit). Put your link between the quotes:
`window.SP_API_DEFAULT = 'https://script.google.com/macros/s/……/exec';` then **Commit changes**.
(The link becomes visible in the public repository; your PINs still protect the data.)
