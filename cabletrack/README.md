# CableTrack

A simple browser-based job tracker for the CABLE FAULT workbook.

## Included project files
- `index.html` — page structure
- `styles.css` — responsive styling
- `app.js` — search, filters, editing, adding, deleting and Excel export
- `config.js` — Supabase project URL and public anon key
- `supabase.sql` — database table and row-level security policies
- `data/initial-data.json` — combined starting records from the supplied workbook

## Starting data
The workbook contains 33 non-empty data rows in Sheet1 and 186 in Sheet2. The project combines the two sheets and removes 13 exact duplicate rows, resulting in **206 starting records**. Sheet1's row 3 supplies the column labels; the original blank third column is retained so the column positions stay aligned. The spelling `Finshed` is standardised to `Finished`. A blank `Status` is treated as Pending in the website, but stays blank in the exported workbook unless someone changes it.

## 1. Create the Supabase project
1. Create a project at https://supabase.com.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase.sql`, copy all of it, paste it into a new SQL query and run it.
4. Go to **Project Settings → API** (or API Keys).
5. Copy the Project URL and the `anon` / publishable public key.

## 2. Configure the website
1. Open `config.js`.
2. Replace `PASTE_SUPABASE_PROJECT_URL_HERE` with your Supabase Project URL.
3. Replace `PASTE_SUPABASE_ANON_KEY_HERE` with your Supabase anon/public key.
4. Save the file.

**Never put a Supabase `service_role` key or secret key in browser code.**

## 3. Publish with GitHub + Vercel
1. Create a GitHub repository.
2. Upload all files and folders in this project, keeping the `data` folder.
3. In Vercel, choose **Add New → Project**, import the GitHub repository and deploy.
4. No build command is needed. Set the output/root directory to the repository root.
5. Open the deployed URL.

You can also test locally using a small static server (for example `python -m http.server 8000`) and open `http://localhost:8000`. Opening the HTML file directly may prevent the starter JSON fetch from working.

## 4. Import the original records once
After the website is connected to Supabase, the dashboard will show **Import original records** while the database is empty. Click it once. It imports the 206 combined, de-duplicated rows. Do not click it again after adding jobs; the app checks that the database is empty before importing.

## How the website works
- The table uses the original workbook column names and order, including the blank third column.
- Search checks every column.
- Filters include Status, By Whom, Done and the DATE range.
- Blank Status is counted and shown as Pending. It is not written as the word Pending to the Excel file.
- `By Whom` and `Done` dropdown suggestions are generated from current records. New names become suggestions automatically after saving a job.
- All columns can be edited in the Add/Edit form.
- Download Excel exports the full combined list; Export filtered exports only the currently filtered rows.
- Exported workbook has one sheet named `CABLE FAULT`, with the same 13 columns in the same order.

## Important: no-login access and data security
This project follows your no-login requirement. The SQL policies permit anyone who can access the website and its public Supabase key to read, add, edit and delete the jobs. **That means the URL is not private security: anyone who finds it could change or download the records.** Do not put confidential or personal data in this version. If that is not acceptable for the workplace, ask for a shared access PIN or a network/Cloudflare access restriction before using it with real records. A shared PIN implemented only in browser JavaScript is not strong security; a proper server-side check is needed.

## Notes
- Supabase free-tier limits and availability can change; check the current plan limits before relying on it for business-critical records.
- This is a static HTML/CSS/JS site; the database lives in Supabase, not in the visitor's browser.
- The browser needs an internet connection to load Supabase and the Excel library.
