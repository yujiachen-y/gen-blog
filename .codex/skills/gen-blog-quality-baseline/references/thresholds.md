# Thresholds

Starter baseline thresholds for gen-blog (SPA output):

- `posts/index.json` size: **<= 2 MB**
- Home payload (index.html + app.js + styles.css + posts/index.json): **<= 1024 KB**
- Dist total size: **<= 50 MB**
- Single cover image size: **<= 600 KB**

Notes:

- If posts grow, consider splitting `posts/index.json` by year or pagination once it exceeds 2 MB.
- If home payload grows above 1 MB, expect slower first load; consider loading only the latest N posts.
- Keep single cover images below 600 KB; aim for 200–400 KB after compression.
- Adjust thresholds per your audience and hosting bandwidth.
