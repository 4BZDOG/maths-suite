# Deployment Guide — Puzzle Suite on GitHub Pages

This guide gets Puzzle Suite live on the web at a public URL using GitHub Pages.
It is free and requires no server or paid hosting.

---

## What Has Already Been Done for You

The following files were created automatically and are ready to commit:

| File | Purpose |
|------|---------|
| `package.json` | Declares esbuild as a build dependency |
| `package-lock.json` | Locks dependency versions for reproducible CI builds |
| `.gitignore` | Excludes `node_modules/`, `.DS_Store`, editor files, local Claude data |
| `.nojekyll` | Tells GitHub Pages to serve files as-is (no Jekyll processing) |
| `index.html` | Redirect from `https://your-site/` → `puzzle-suite.html` for a clean URL |
| `.github/workflows/deploy.yml` | GitHub Actions workflow: rebuilds `bundle.js` and deploys on every push to `main` |

You do **not** need to touch any of these files.

---

## What You Need to Do Manually

### Prerequisites

- A [GitHub account](https://github.com/join) (free)
- Git is already installed on your Mac (`git --version` confirms this)

---

### Step 1 — Create a GitHub Repository

1. Go to **https://github.com/new**
2. Fill in:
   - **Repository name**: `puzzle-suite` (or anything you like)
   - **Visibility**: Public *(required for free GitHub Pages)*
   - Leave "Add README" and other options **unchecked** — you already have these files
3. Click **Create repository**
4. Leave the next page open — you'll need the URL shown there (looks like `https://github.com/YOUR-USERNAME/puzzle-suite.git`)

---

### Step 2 — Push the Project to GitHub

Open Terminal and run these commands one at a time.
Replace `YOUR-USERNAME` and `puzzle-suite` with your actual values.

```bash
# Navigate to the project folder
cd "/Users/david/Desktop/Puzzle Suite 2 2/2.5.4"

# Initialise a git repository
git init

# Stage all files (respects .gitignore automatically)
git add .

# Create the first commit
git commit -m "Initial commit"

# Rename the default branch to 'main'
git branch -M main

# Connect to your GitHub repository
git remote add origin https://github.com/YOUR-USERNAME/puzzle-suite.git

# Push to GitHub
git push -u origin main
```

After the push, your code appears at `https://github.com/YOUR-USERNAME/puzzle-suite`.

---

### Step 3 — Enable GitHub Pages

1. On your repository page, click **Settings** (top tab bar)
2. In the left sidebar, click **Pages** (under "Code and automation")
3. Under **"Build and deployment"**, set **Source** to **GitHub Actions**
4. Click **Save**

That's it. GitHub will automatically run the workflow and deploy the site.

---

### Step 4 — Wait for the First Deployment (~2 minutes)

1. Click the **Actions** tab on your repository
2. You'll see a workflow run called **"Build & Deploy"** — wait for the green ✓
3. Once it finishes, go back to **Settings → Pages**
4. Your live URL is displayed there, e.g.:
   ```
   https://YOUR-USERNAME.github.io/puzzle-suite/
   ```
5. Open it — you'll be redirected to `puzzle-suite.html` automatically

---

## Updating the App After Changes

Every time you push new code to the `main` branch, GitHub Actions rebuilds and redeploys automatically. No manual steps needed.

```bash
# After making changes to any source file:
cd "/Users/david/Desktop/Puzzle Suite 2 2/2.5.4"

# Stage your changes
git add .

# Commit with a message describing what changed
git commit -m "Describe your changes here"

# Push — deployment starts automatically
git push
```

The update is live within ~2 minutes.

> **Note on bundle.js**: You do **not** need to run `bash build.sh` before pushing.
> The GitHub Actions workflow runs the build step automatically in the cloud.
> You only need to run it locally when previewing changes on `localhost:8082`.

---

## Optional — Custom Domain (e.g. puzzlesuite.com)

If you own a domain and want `https://puzzlesuite.com` instead of the default GitHub URL:

1. **Buy a domain** from any registrar (Cloudflare Registrar, Namecheap, etc.)
2. **In your registrar's DNS settings**, add these records:
   ```
   Type    Name    Value
   A       @       185.199.108.153
   A       @       185.199.109.153
   A       @       185.199.110.153
   A       @       185.199.111.153
   CNAME   www     YOUR-USERNAME.github.io
   ```
3. **In GitHub → Settings → Pages → Custom domain**, enter your domain and click Save
4. **Check "Enforce HTTPS"** once DNS propagates (~15 minutes to 48 hours)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Actions tab shows a red ✗ | Build or deploy step failed | Click the failed run → expand the failing step to read the error log |
| Site shows a 404 | Pages not yet enabled, or deployment still running | Check Settings → Pages; wait for Actions to show a green ✓ |
| Old version of the app loads | Browser cache | Hard-refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows) |
| `npm ci` fails in CI | `package-lock.json` not committed | Run `git add package-lock.json && git commit -m "add lockfile" && git push` |
| Puzzles don't generate | Worker path wrong at new URL | Check browser console for errors; the web worker uses a relative path and should resolve correctly |
| PDF export fails | Font CDN blocked | None — fonts load from `cdn.jsdelivr.net`; needs internet access on the user's machine |

---

## How the Workflow Works (Reference)

```
Push to main
    │
    ▼
.github/workflows/deploy.yml
    │
    ├─ Checkout code
    ├─ Install Node 20
    ├─ npm ci  (installs esbuild from package-lock.json)
    ├─ bash build.sh  (esbuild → bundle.js, ~56 KB)
    ├─ Upload artifact (whole repo folder)
    │
    └─ Deploy artifact → GitHub Pages CDN
            │
            ▼
    https://YOUR-USERNAME.github.io/puzzle-suite/
```

Total deploy time from push to live: **~90 seconds**.
