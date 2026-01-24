# Thresholds

Starter baseline thresholds for gen-blog (static HTML output):

- Home payload (index.html + app.js + styles.css): **<= 1024 KB**
- Dist total size: **<= 50 MB**
- HTML total size (all .html): **<= 15 MB**
- Largest HTML page: **<= 400 KB**
- Single image size: **<= 600 KB**

Notes:

- If you keep `posts/index.json`, consider splitting it by year or pagination once it exceeds 2 MB.
- If home payload grows above 1 MB, expect slower first load; consider loading only the latest N posts.
- Keep single images below 600 KB; aim for 200–400 KB after compression.
- Adjust thresholds per your audience and hosting bandwidth.
