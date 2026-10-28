// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Méthode non autorisée.' }, { status: 405, headers: cors });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !anonKey || !geminiKey || !authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Configuration ou connexion manquante.' }, { status: 401, headers: cors });
  }

  const accessToken = authorization.slice('Bearer '.length);
  const supabase = createClient(projectUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return Response.json({ error: 'Session expirée. Reconnecte-toi.' }, { status: 401, headers: cors });

  let input;
  try { input = await request.json(); }
  catch { return Response.json({ error: 'Requête invalide.' }, { status: 400, headers: cors }); }
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 500) {
    return Response.json({ error: 'La question doit contenir entre 1 et 500 caractères.' }, { status: 400, headers: cors });
  }
  if (typeof input.wardrobe !== 'string' || input.wardrobe.length > 12_000) {
    return Response.json({ error: 'La liste du dressing est trop longue.' }, { status: 400, headers: cors });
  }

  const prompt = [
    'Tu es un assistant styliste personnel francophone. Réponds brièvement et concrètement.',
    'Compose une tenue à partir des pièces propres indiquées dans le dressing. Ne propose jamais une pièce marquée sale.',
    'N’invente pas de vêtement absent. Si une pièce manque, indique-le et propose la meilleure alternative disponible.',
    'Donne les pièces exactes, leurs couleurs, une courte justification adaptée à l’occasion et à la météo, puis un accessoire facultatif.',
    `Question : ${input.question.trim()}`,
    `Météo : ${typeof input.weather === 'string' ? input.weather.slice(0, 300) : 'non précisée'}`,
    `Dressing :\n${input.wardrobe}`,
  ].join('\n\n');

  const modelResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.5 },
    }),
  });
  if (!modelResponse.ok) return Response.json({ error: 'Gemini est momentanément indisponible.' }, { status: 502, headers: cors });

  const result = await modelResponse.json();
  const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!answer) return Response.json({ error: 'Gemini n’a pas fourni de suggestion.' }, { status: 502, headers: cors });
  return Response.json({ answer }, { headers: cors });
});
