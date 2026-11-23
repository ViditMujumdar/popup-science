// Local stand-in for Gemini + YouTube Data API, for automated tests only (never used in production).
import http from 'node:http';
import { pathToFileURL } from 'node:url';

export const HEART = {
  understood: true, notUnderstoodReason: null,
  title: 'Human heart: double circulation', subject: 'biology', topic: 'Transportation in humans', gradeLevel: 'Class 10',
  summary: 'The heart has four chambers that pump deoxygenated blood to the lungs and oxygenated blood to the body.',
  descriptionMarkdown: 'The **right side** pumps deoxygenated blood to the lungs; the **left side** pumps oxygenated blood to the body.\n\n- Atria receive blood\n- Ventricles pump blood out',
  parts: [
    { id: 'right-atrium', name: 'Right atrium', description: 'Receives deoxygenated blood from the body.' },
    { id: 'left-ventricle', name: 'Left ventricle', description: 'Pumps oxygenated blood to the whole body.' },
    { id: 'aorta', name: 'Aorta', description: 'Largest artery.' },
  ],
  steps: [
    { title: 'Blood enters the right atrium', text: 'Deoxygenated blood returns from the body.', focus: ['right-atrium'] },
    { title: 'Left ventricle pumps', text: 'Oxygenated blood leaves through the aorta.', focus: ['left-ventricle', 'aorta'] },
  ],
  keyTerms: [{ term: 'Atrium', meaning: 'Upper receiving chamber.' }],
  funFact: 'Your heart beats about 1,00,000 times a day.',
  objects: [
    { kind: 'sphere', part: 'right-atrium', label: 'Right atrium', position: [-0.9, 0.9, 0], rotation: null, size: [0.8], points: null, color: '#4f7dff', opacity: null, glow: null, double: null, count: null, step: 0, animation: 'pulse', axis: null, speed: 1, center: null },
    { kind: 'sphere', part: 'left-ventricle', label: 'Left ventricle', position: [0.6, -0.6, 0], rotation: null, size: [1.1, 1.4, 1], points: null, color: 'red', opacity: null, glow: null, double: null, count: null, step: 0, animation: 'pulse', axis: null, speed: 1, center: null },
    { kind: 'tube', part: 'aorta', label: 'Aorta', position: [0, 0, 0], rotation: null, size: [0.25], points: [0.4, 0.6, 0, 0.6, 2.2, 0, -0.4, 2.6, 0, -1.2, 2, 0], color: '#ff4d5e', opacity: null, glow: null, double: null, count: null, step: 2, animation: 'flow', axis: null, speed: 1, center: null },
    { kind: 'arrow', part: null, label: null, position: [0, 0, 0], rotation: null, size: null, points: [1], color: '#ffffff', opacity: null, glow: null, double: null, count: null, step: 1, animation: null, axis: null, speed: null, center: null },
    { kind: 'teapot', part: null, label: 'bad', position: [0, 0, 0], rotation: null, size: null, points: null, color: '#ffffff', opacity: null, glow: null, double: null, count: null, step: 0, animation: null, axis: null, speed: null, center: null },
  ],
  videoQuery: 'human heart double circulation class 10',
  warnings: [],
};

const VIDEOS = ['dQw4w9WgXcQ', 'aaaaaaaaaaa', 'bbbbbbbbbbb'].map((id, i) => ({
  id: { kind: 'youtube#video', videoId: id },
  snippet: { title: `Heart lesson ${i + 1} &amp; circulation`, channelTitle: i === 1 ? 'Khan Academy India' : `Teacher ${i}`, publishedAt: '2024-01-01T00:00:00Z', liveBroadcastContent: 'none', thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } } },
}));

let failNext = 0, slowNext = 0, last = null;
export function startMock(port = 8899) {
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const send = (s, j) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (req.url === '/__fail') { failNext = Number(body || 1); return send(200, { ok: true }); }
    if (req.url === '/__last') return send(200, last ?? {});
    if (req.url === '/__slow') { slowNext = Number(body || 1); return send(200, { ok: true }); }
    if (req.url.startsWith('/v1beta/models/')) {
      if (failNext > 0) { failNext--; return send(429, { error: { code: 429, message: 'quota' } }); }
      if (slowNext > 0) { slowNext--; await new Promise((r) => setTimeout(r, 1500)); }
      const j = JSON.parse(body || '{}');
      last = { url: req.url, hadImage: Boolean(j.contents?.[0]?.parts?.some((p) => p.inlineData?.data)), hasSchema: Boolean(j.generationConfig?.responseJsonSchema), system: (j.systemInstruction?.parts?.[0]?.text ?? '').slice(0, 80) };
      return send(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(HEART) }] } }] });
    }
    if (req.url.startsWith('/youtube/v3/search')) return send(200, { items: VIDEOS });
    if (req.url.startsWith('/youtube/v3/videos')) return send(200, { items: VIDEOS.map((v, i) => ({ id: v.id.videoId, contentDetails: { duration: i === 2 ? 'PT45S' : 'PT8M12S' }, statistics: { viewCount: String(1000 * (i + 1) ** 4) } })) });
    send(404, { error: 'not found' });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) startMock(Number(process.env.MOCK_PORT || 8899)).then(() => console.log('mock upstream on 8899'));
