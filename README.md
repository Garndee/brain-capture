# Brain Capture PWA

Android PWA that appears in the share sheet and saves captured content as `.md` files into your Google Drive `/Brain/inbox/`.

---

## Deploy to GitHub Pages (free, HTTPS required for PWA)

### 1. Create a GitHub repo

```
git init
git add .
git commit -m "initial Brain Capture PWA"
gh repo create brain-capture --public --source=. --push
```

Then go to **Settings → Pages** → set source to `main` branch → `/root`.

Your app URL will be: `https://YOUR-USERNAME.github.io/brain-capture/`

---

### 2. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "Brain Capture")
3. Enable the **Google Drive API**: APIs & Services → Library → search "Drive API" → Enable
4. Create credentials: APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: Brain Capture
   - Authorized JavaScript origins: `https://YOUR-USERNAME.github.io`
   - Authorized redirect URIs: `https://YOUR-USERNAME.github.io/brain-capture/`
5. Copy the **Client ID**

---

### 3. Install as PWA on Android

1. Open Chrome on your Android phone
2. Navigate to `https://YOUR-USERNAME.github.io/brain-capture/`
3. Chrome will show a banner or you can tap **⋮ → Add to Home screen**
4. Enter your Google Client ID when prompted
5. Sign in with Google

---

### 4. Use the share target

1. In any Android app (browser, YouTube, Twitter, etc.)
2. Tap **Share → Brain** (your installed PWA appears in the share sheet)
3. The app opens with the shared content pre-filled
4. Add notes, then tap **Save to Brain**
5. File is saved to Google Drive `/Brain/inbox/` as a timestamped `.md` file

---

## File format

Each capture is saved as:
```
YYYY-MM-DD_HH-MM-SS_title-slug.md
```

With frontmatter:
```markdown
---
captured: 2024-01-15T10:30:00.000Z
status: inbox
tags: []
source: "https://example.com"
---

# Title

Shared text content

> https://example.com

## Notes

Your personal notes here
```

---

## Folder structure created in Drive

```
My Drive/
  Brain/
    inbox/       ← PWA writes here
    processed/   ← Claude agent moves here (Step 2)
    topics/      ← Auto-categorized (Step 2)
    summaries/   ← Claude summaries (Step 2)
    skills/      ← Agent skill definitions (Step 5)
```

---

## Icons

Open `icons/generate-icons.html` in a browser, click both download buttons, and place `icon-192.png` and `icon-512.png` in the `icons/` folder before deploying.

---

## Next steps

- **Step 2**: Claude agent that watches `/Brain/inbox/`, summarizes, tags, adds `[[wikilinks]]`, moves files
- **Step 3**: NotebookLM connected to `/Brain/` for Q&A
- **Step 4**: Web UI dashboard with directory tree and inline markdown rendering
- **Step 5**: Skills layer for custom agent behaviors
