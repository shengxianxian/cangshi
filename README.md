# Neon Flux

A tiny arcade survival game that runs as a static site. No build step, backend, or external assets are required.

## Play locally

```bash
python -m http.server 4173
```

Open `http://127.0.0.1:4173/`.

## Controls

- `WASD` or arrow keys: move
- `Space`: dash
- `E`: activate Overdrive when the meter is full
- `R`: restart
- Mouse movement also steers on desktop

## GitHub Pages

Upload `index.html`, `styles.css`, `game.js`, and `README.md` to a repository. In **Settings -> Pages**, choose **Deploy from a branch**, select the default branch and the `/ (root)` folder, then save.
