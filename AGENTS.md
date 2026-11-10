# Repository Guidelines

## Project Structure & Module Organization

- `react/front/` contains the Create React App interface. Main screens and components are in `src/`; static files are in `public/`; the starter test is `src/App.test.js`.
- `react/extension/` contains the Manifest V3 YouTube history collector (`popup.js`, `background.js`, and `manifest.json`).
- `models/server.py` implements the FastAPI inference endpoint. `models/training/` holds model definitions, training scripts, and model weights; `models/result/` holds generated plots. Training data may be needed separately.
- `README.md` describes the intended product flow; `requirements.txt` lists Python dependencies.

## Build, Test, and Development Commands

Run frontend commands from `react/front/`:

```bash
npm install --legacy-peer-deps # install frontend dependencies
npm start                      # run the UI at localhost:3000
npm test                       # run the Jest/React Testing Library suite
npm run build                  # create a production build in build/
```

From the repository root, start the inference API with `python models/server.py` (serves port 5000). The API loads local weights and a Hugging Face tokenizer/model; ensure these dependencies and artifacts are available before evaluating live inference.

## Coding Style & Naming Conventions

Follow the surrounding file’s style: React components use PascalCase filenames/names, hooks and helpers use camelCase, and Python classes use PascalCase while functions and variables use snake_case. Keep changes focused, use clear names, and avoid mixing demo/mock values with live model results without labeling them. No repository-wide formatter or linter is configured; preserve existing indentation and formatting.

## Testing Guidelines

Frontend tests use Jest and React Testing Library through `npm test`; name tests with `.test.js` or `.test.jsx` alongside the code. The existing `App.test.js` is an unupdated Create React App starter test, so update it when changing app behavior. No Python test suite or coverage threshold is configured. For API changes, verify the `/api/analyze` request and response shape with representative title/comment inputs.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects (for example, `Fix minor bugs` and `Implement Backend Server for interactive demo`). Use a concise imperative subject and explain the user-facing or model-facing change in the body when needed. Pull requests should describe the change, list validation performed, link related issues when available, and include screenshots for visible UI changes.

## Security & Configuration Tips

The UI stores the YouTube API key in browser `localStorage` and calls YouTube directly. Do not commit API keys, credentials, or private datasets. The backend is configured for local development; review CORS and host binding before exposing it on a network.
