# Thresholds

Starter baseline thresholds for gen-blog (static HTML output):

- Home payload (index.html + app.js + styles.css): **<= 1024 KB**
- Dist total size: **<= 120 MB**
- HTML total size (all .html): **<= 15 MB**
- Largest HTML page: **<= 400 KB**
- Single image size: **<= 1800 KB**

Notes:

- If you keep `posts/index.json`, consider splitting it by year or pagination once it exceeds 2 MB.
- If home payload grows above 1 MB, expect slower first load; consider loading only the latest N posts.
- With high-resolution images enabled, keep dist under 120 MB to avoid GitHub Pages bloat.
- Keep single images below 1800 KB; aim for 500–1200 KB after compression.
- Adjust thresholds per your audience and hosting bandwidth.
