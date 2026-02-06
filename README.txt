Train Plan & Track – Static GitHub Pages Deploy (v0.1.3)

This package avoids GitHub Actions / npm install failures by deploying a pre-built site.

Folder included:
- docs/    (the built website)

DEPLOY STEPS (GitHub website UI):
1) Open your repository on GitHub.
2) Delete or disable GitHub Actions deploy workflows if you want to avoid them running:
   - .github/workflows/deploy.yml (optional, but recommended to remove to stop failing runs)
3) Upload the provided "docs" folder into the ROOT of your repo.
   - You should end up with: <repo>/docs/index.html and <repo>/docs/assets/...
4) Go to Settings -> Pages.
5) Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /docs
6) Save.
7) Wait for GitHub Pages to publish.

IMPORTANT:
- Your repo name MUST be: train-plan-track
  because the built files reference /train-plan-track/... paths.
  If your repo name differs, rebuild with the correct base path or ask to regenerate.

TEST:
- Visit: https://<your-username>.github.io/train-plan-track/
- If you see 404s for /train-plan-track/assets/*, your repo name or Pages folder selection is wrong.
