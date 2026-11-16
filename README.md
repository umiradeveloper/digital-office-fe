# Digital Office — Frontend (Next.js)

```bash
npm install
cp .env.example .env.local     # API_URL = alamat backend, default http://localhost:4000
npm run dev                    # http://localhost:3000
```

Produksi: `npm run build && npm run start` (port 3000). Semua panggilan `/api/v1/*` diteruskan ke `API_URL`,
jadi backend tidak perlu dibuka langsung ke publik bila frontend dan backend berada di server yang sama.
