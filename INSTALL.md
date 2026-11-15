# Mobile-friendly update (web only, no install)

Copy these into your project's `public` folder, replacing the old files:
- public/css/mobile.css   (NEW)
- public/dashboard.html, scan.html, register.html, events.html, login.html (replace)

What changed:
- dashboard.html, scan.html, register.html had NO viewport tag, so phones showed the desktop layout. Added.
- All 5 pages now load css/mobile.css (last). It only applies on screens <= 768px, so desktop looks the same.
- No JavaScript, route, or database changes.

Testing on a phone:
- Open the Cloudflare link (https) in the phone browser. Camera scanning needs https; a plain http://192.168.x.x link will block the camera.
- Hard refresh once (clear cache) if the old layout still shows.
