import { RhkItem, LogItem, AiClassificationResult } from '../types';

// Stopwords in Indonesian for lightweight text similarity
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
    .filter(w => w.length > 2 && !ID_STOPWORDS.has(w));
};

export const classifyLocally = (
  rhkList: RhkItem[],
  activities: LogItem[]
): AiClassificationResult[] => {
  const rhkTokens = rhkList.map(r => ({
    id: r.id,
    name: r.nama,
    tokens: new Set([...tokenize(r.nama), ...tokenize(r.ind || '')]),
  }));

  return activities.map(act => {
    const actTokens = tokenize(act.ur + ' ' + (act.bukti || ''));
    let bestRhkId: string | null = null;
    let highestScore = 0;

    for (const r of rhkTokens) {
      let matches = 0;
      for (const token of actTokens) {
        if (r.tokens.has(token)) {
          matches++;
        } else {
          // Check prefix match for Indonesian lemmas (e.g., lapor vs pelaporan)
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
      rhkId: bestRhkId || (rhkList.length > 0 ? rhkList[0].id : null),
      confidence: highestScore > 0 ? Math.min(0.95, parseFloat((0.4 + highestScore * 0.6).toFixed(2))) : 0.3,
      alasan: bestRhkId
        ? 'Disesuaikan berdasarkan kesesuaian kata kunci uraian tugas.'
        : 'Diselaraskan dengan sasaran kinerja utama pegawai.',
    };
  });
};
