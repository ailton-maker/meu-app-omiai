import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }) : null;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/compatibility', async (req, res) => {
    const { profileA, profileB } = req.body;
    
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    try {
      const prompt = `
        Analise a compatibilidade entre estas duas pessoas para um aplicativo de descoberta social.
        Pessoa A: Bio: "${profileA.bio}", Interesses: ${profileA.interests.join(', ')}, Hobbies: ${profileA.hobbies.join(', ')}
        Pessoa B: Bio: "${profileB.bio}", Interesses: ${profileB.interests.join(', ')}, Hobbies: ${profileB.hobbies.join(', ')}
        
        Forneça um "Omiai Insight" muito curto e impactante (máximo 10 palavras) em Português do Brasil sobre um interesse compartilhado único ou uma "vibe" que possa iniciar uma conversa.
        Formato: Apenas o texto do insight.
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = result.text || 'Conexão única detectada.';
      res.json({ insight: text.trim() });
    } catch (error) {
      console.error('Gemini error:', error);
      res.json({ insight: 'Duas almas, um caminho. Conecte-se para descobrir por quê.' });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Omiai server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
