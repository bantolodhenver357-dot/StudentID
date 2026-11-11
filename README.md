# School ID Maker

A browser-based school ID card editor built with HTML, CSS, and vanilla JavaScript.

## Run locally
1. Extract the ZIP.
2. Open the folder in VS Code.
3. Use the VS Code Live Server extension and open `index.html`.
   - You can also use `python -m http.server 8000` in the project folder, then visit `http://localhost:8000`.

## Features in this starter
- Upload separate front and back ID background designs.
- Use the supplied sample images as visual references.
- Enter student details and apply text layers.
- Upload a student photo and adjust zoom, position, and rotation.
- Drag, resize, lock, and delete canvas layers.
- Save student layouts in browser IndexedDB.
- Export current side as PNG and print both sides / Save as PDF.
- Export a JSON backup of browser data.

## Important storage note
This is a local-first starter. IndexedDB belongs to the browser profile and device where the data was entered. It is not a shared online database. Export backups regularly. Do not put real student records, photos, or signatures in a public GitHub repository.

## GitHub Pages
1. Create a public repository named `SchoolIDMaker`.
2. Upload the contents of this folder (not the outer folder).
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/(root)`, then Save.
6. Open `https://YOUR-USERNAME.github.io/SchoolIDMaker/`.

## Notes
- The sample ID images are examples only and contain personal information. They are included as local reference images; do not publish them in a public repository. Remove `assets/templates/sample-*-reference.jpg` before uploading to GitHub, and upload clean, authorized template artwork inside the app.
- The service worker file is included; register it from `app.js` after confirming the site is served over localhost or HTTPS if you want install/offline caching. This starter currently works as a responsive web app; PWA install polish can be added in a later phase.
