import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server-side keyword matcher for resilient fallback
const ID_STOPWORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'dengan', 'adalah', 'ini',
  'itu', 'atau', 'dalam', 'bisa', 'ada', 'akan', 'telah', 'sudah', 'oleh', 'secara',
  'serta', 'bagi', 'agar', 'karena', 'melalui', 'tentang', 'terhadap', 'atas', 'guna'
]);

const tokenize = (text: string): string[] => {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ID_STOPWORDS.has(w));
};

function fallbackClassify(rhkList: any[], activities: any[]) {
  const rhkTokens = rhkList.map((r, idx) => ({
    id: r.id,
    nomor: idx + 1,
    tokens: new Set([...tokenize(r.nama), ...tokenize(r.ind || '')]),
  }));

  return activities.map((act) => {
    const actTokens = tokenize(act.ur + ' ' + (act.bukti || ''));
    let bestRhkId = rhkList[0]?.id || null;
    let highestScore = 0;

    for (const r of rhkTokens) {
      let matches = 0;
      for (const token of actTokens) {
        if (r.tokens.has(token)) {
          matches += 1;
        } else {
          for (const rt of r.tokens) {
            if (token.length >= 4 && (rt.includes(token) || token.includes(rt))) {
              matches += 0.5;
              break;
            }
          }
        }
      }
      const score = matches / Math.max(1, Math.sqrt(r.tokens.size * Math.max(1, actTokens.length)));
      if (score > highestScore && matches >= 1) {
        highestScore = score;
        bestRhkId = r.id;
      }
    }

    return {
      id: act.id,
      rhkId: bestRhkId,
      confidence: highestScore > 0 ? Math.min(0.95, parseFloat((0.5 + highestScore * 0.5).toFixed(2))) : 0.4,
      alasan: 'Disesuaikan dengan relevansi substansi uraian kegiatan dan target RHK.',
    };
  });
}

function fallbackRefine(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Replacements for common informal Indonesian notes to formal ASN civil service terms
  const terms: Record<string, string> = {
    benerin: 'melakukan perbaikan dan pemeliharaan',
    ngurus: 'melakukan pengelolaan',
    rapat: 'menghadiri dan mengikuti rapat koordinasi',
    bikin: 'menyusun draf',
    ngerjain: 'melaksanakan penyelesaian',
    cek: 'melakukan pemeriksaan dan monitoring',
    bantuin: 'memberikan asistensi dan pendampingan teknis kepada',
    lapor: 'SP4N-LAPOR!',
    nyiapin: 'menyiapkan kelengkapan administrasi dan dokumen',
    ngirim: 'mendistribusikan dan menyampaikan',
  };

  let refined = text;
  for (const [key, val] of Object.entries(terms)) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    refined = refined.replace(regex, val);
  }

  // Capitalize first letter and ensure formal active verb start
  const firstWord = refined.split(' ')[0].toLowerCase();
  const formalPrefixes = ['melakukan', 'melaksanakan', 'menyusun', 'menghadiri', 'mengikuti', 'mengembangkan', 'memberikan', 'mengelola', 'memvalidasi', 'mengoordinasikan'];

  if (!formalPrefixes.some((p) => firstWord.startsWith(p))) {
    refined = `Melaksanakan kegiatan ${refined.charAt(0).toLowerCase() + refined.slice(1)}`;
  } else {
    refined = refined.charAt(0).toUpperCase() + refined.slice(1);
  }

  return refined;
}

function fallbackSummarize(rhkListWithActivities: any[]): any[] {
  return rhkListWithActivities.map((group) => {
    const uniqueKeg = Array.from(new Set(group.kegiatan || [])).filter(Boolean) as string[];
    const rencanaAksi: string[] = [];

    if (uniqueKeg.length === 0) {
      rencanaAksi.push(`Melaksanakan implementasi dan pencapaian target ${group.rhkNama}`);
    } else {
      // Pick up to 3 synthesized actions
      const sample1 = uniqueKeg[0] ? fallbackRefine(uniqueKeg[0]) : '';
      const sample2 = uniqueKeg[1] ? fallbackRefine(uniqueKeg[1]) : '';
      const sample3 = uniqueKeg[2] ? fallbackRefine(uniqueKeg[2]) : '';

      if (sample1) rencanaAksi.push(sample1);
      if (sample2) rencanaAksi.push(sample2);
      if (sample3) rencanaAksi.push(sample3);

      if (rencanaAksi.length < 2) {
        rencanaAksi.push(`Menyusun rekapitulasi data dan pelaporan capaian terkait ${group.rhkNama}`);
      }
    }

    return {
      rhkId: group.rhkId,
      rencanaAksi,
    };
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number = 7000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI Request timeout')), ms)),
  ]);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '10mb' }));

  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      appUrl: process.env.APP_URL || null,
    });
  });

  // AI Classification endpoint
  app.post('/api/ai/classify', async (req, res) => {
    const { rhkList, activities } = req.body;
    if (!Array.isArray(rhkList) || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ error: 'Data RHK atau kegiatan tidak valid' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const results = fallbackClassify(rhkList, activities);
      return res.json({ success: true, results, fallback: true });
    }

    try {
      const formattedRhk = rhkList.map((r: any, idx: number) => ({
        id: r.id,
        nomor: idx + 1,
        uraian: r.nama,
        indikator: r.ind || '',
      }));

      const formattedActivities = activities.map((a: any) => ({
        id: a.id,
        uraian: a.ur,
        bukti: a.bukti || '',
      }));

      const prompt = `Anda adalah asisten cerdas ASN di Indonesia. Petakan kegiatan kerja harian ke RHK yang paling tepat:
Daftar RHK:
${JSON.stringify(formattedRhk)}

Kegiatan:
${JSON.stringify(formattedActivities)}

Kembalikan format JSON array: [{ "id": "ID_KEGIATAN", "rhkId": "ID_RHK", "confidence": 0.9, "alasan": "singkat" }]`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })
      );

      const text = response.text || '[]';
      let results = [];
      try {
        results = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        results = match ? JSON.parse(match[0]) : fallbackClassify(rhkList, activities);
      }

      return res.json({ success: true, results });
    } catch (err: any) {
      console.warn('Gemini classify fallback activated:', err?.message || err);
      const results = fallbackClassify(rhkList, activities);
      return res.json({ success: true, results, fallback: true });
    }
  });

  // AI Summarize Monthly Action Plans
  app.post('/api/ai/summarize', async (req, res) => {
    const { rhkListWithActivities, periode } = req.body;
    if (!Array.isArray(rhkListWithActivities) || rhkListWithActivities.length === 0) {
      return res.status(400).json({ error: 'Daftar RHK dan kegiatan kosong' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const results = fallbackSummarize(rhkListWithActivities);
      return res.json({ success: true, results, fallback: true });
    }

    try {
      const prompt = `Anda adalah konsultan kinerja ASN Indonesia. Ringkas log kegiatan harian berikut untuk periode ${periode} menjadi 2-3 butir Rencana Aksi formal kedinasan per RHK yang diawali kata kerja aktif (Melakukan, Menyusun, Mengoordinasikan, Mengembangkan).
Format respon JSON array:
[
  {
    "rhkId": "ID_RHK",
    "rencanaAksi": ["Poin 1", "Poin 2"]
  }
]
Data:
${JSON.stringify(rhkListWithActivities)}`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        })
      );

      const text = response.text || '[]';
      let results = [];
      try {
        results = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        results = match ? JSON.parse(match[0]) : fallbackSummarize(rhkListWithActivities);
      }

      return res.json({ success: true, results });
    } catch (err: any) {
      console.warn('Gemini summarize fallback activated:', err?.message || err);
      const results = fallbackSummarize(rhkListWithActivities);
      return res.json({ success: true, results, fallback: true });
    }
  });

  // AI Refine Activity
  app.post('/api/ai/refine-activity', async (req, res) => {
    const { text, rhkContext } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Teks uraian wajib diisi' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ success: true, refined: fallbackRefine(text), fallback: true });
    }

    try {
      const prompt = `Ubah catatan kegiatan harian pegawai berikut menjadi kalimat formal, baku, dan lugas sesuai standar log harian e-Kinerja ASN:
"${text}"
${rhkContext ? `Konteks RHK: "${rhkContext}"` : ''}

Kembalikan HANYA format JSON: { "refined": "Kalimat yang sudah diperbaiki" }`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        })
      );

      const raw = response.text || '{}';
      let parsed = { refined: fallbackRefine(text) };
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      return res.json({ success: true, refined: parsed.refined || fallbackRefine(text) });
    } catch (err: any) {
      console.warn('Gemini refine fallback activated:', err?.message || err);
      return res.json({ success: true, refined: fallbackRefine(text), fallback: true });
    }
  });

  // Serve static files or Vite middlewares
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Kinerja Harian running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
