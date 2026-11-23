# Pop-Up Science

Snap a photo of a diagram in a science textbook. Pop-Up Science rebuilds it as an **interactive 3D model** you can rotate, explode, step through and tap. It explains every part clearly and shows **real YouTube lessons** on the same topic.

- **Photo → 3D**: Google Gemini reads the diagram and *describes* a scene with simple shapes (spheres, tubes, arrows, helices, particles…). The app validates every number and builds the 3D model itself with three.js. Nothing from the AI is executed or injected as HTML.
- **Explained**: a summary, step-by-step walkthrough (synced with the 3D "Build" mode), a part-by-part guide (tap a part to highlight it and fly the camera to it), key terms and a fun fact, in 8 languages (English, Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Spanish).
- **Real videos**: with a YouTube Data API key, matching lessons are found with official YouTube search and play inside the app (privacy-enhanced `youtube-nocookie.com` embeds; Shorts are filtered out and well-known education channels are ranked higher). Without a key, the app shows a button to YouTube's own search results. It never invents video links.
- **Share & save**: share links (`/s/<id>`, stored without the photo), recent pop-ups on the device, and a "save picture" snapshot of the 3D view.
- **Four hand-made examples** that work without AI: convex lens (object at 2F), Bohr model of carbon, a simple circuit, and the DNA double helix.

## Run locally

```bash
npm install
cp .env.example .env      # add GEMINI_API_KEY (and optionally YOUTUBE_API_KEY)
npm run build
npm start                 # http://localhost:8787
```

For development with hot reload, use `npm run dev` (Vite on :5173 and the API on :8787).

### Keys
| Variable | Needed for | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | photo → 3D + explanation | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | default `gemini-3.6-flash` | |
| `GEMINI_FALLBACK_MODEL` | used automatically on overload (503) or quota (429), e.g. `gemini-3.5-flash-lite` | |
| `YOUTUBE_API_KEY` | videos inside the app (optional) | Google Cloud Console → enable **YouTube Data API v3** → Credentials → Create API key. Free quota: 10,000 units/day ≈ 100 searches; results are cached for 12 h. |

Free Gemini keys have small daily limits. For a public launch, turn on billing for the key.

## Deploy (Embarko or any Node host)
One Node process serves both the API and the built site. Build with `npm run build` and start with `npm start`. The server reads `PORT` (and `HOST`, default `0.0.0.0`). Set `GEMINI_API_KEY`, optionally `YOUTUBE_API_KEY`, `PUBLIC_APP_URL` (used in share links) and `DATA_DIR` (a persistent folder for share links) as environment variables on the host. No database or websockets are needed.

## Tests
```bash
npm run typecheck
npm test
```
The tests cover the sanitizer (clamping, dropping invalid shapes, step and part references), the examples (including the lens ray geometry), every API route, the real Gemini and YouTube adapters against a local mock (`scripts/mock-upstream.mjs`), share storage and security headers.

## Honesty, privacy and safety
- 3D models are simplified AI sketches, not to scale. The UI says so and shows any AI warnings.
- Photos go to Gemini only to be explained. They are not stored on the server, and share links contain no photo.
- API keys stay on the server. A strict Content Security Policy allows only YouTube thumbnails and embeds as third-party content. Uploads are checked by content (JPEG/PNG/WebP, size, dimensions). The API is rate limited per IP.
