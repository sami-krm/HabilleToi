const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Méthode non prise en charge.' }, 405);

  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !projectUrl || !anonKey) return json({ error: 'Connecte-toi à ton compte Supabase.' }, 401);

  const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return json({ error: 'Ta session a expiré. Reconnecte-toi à Supabase.' }, 401);

  const apiKey = Deno.env.get('REMOVE_BG_API_KEY');
  if (!apiKey) return json({ error: 'Le service de détourage n’est pas configuré sur le serveur.' }, 503);

  let imageBase64: unknown;
  try {
    ({ imageBase64 } = await request.json());
  } catch {
    return json({ error: 'Image invalide.' }, 400);
  }
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || imageBase64.length > 18_000_000) {
    return json({ error: 'Image invalide ou trop volumineuse.' }, 413);
  }

  let imageBytes: Uint8Array;
  try {
    const binary = atob(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''));
    imageBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return json({ error: 'Le fichier image n’est pas lisible.' }, 400);
  }

  const input = new FormData();
  input.set('size', 'auto');
  input.set('format', 'png');
  // Recadre l'image autour du vêtement détouré, avec une petite marge
  input.set('crop', 'true');
  input.set('crop_margin', '6%');
  const uploadBuffer = new ArrayBuffer(imageBytes.length);
  new Uint8Array(uploadBuffer).set(imageBytes);
  input.set('image_file', new Blob([uploadBuffer], { type: 'image/jpeg' }), 'vetement.jpg');

  const serviceUrl = Deno.env.get('BACKGROUND_REMOVAL_API_URL') ?? 'https://api.remove.bg/v1.0/removebg';
  const result = await fetch(serviceUrl, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: input,
  });
  if (!result.ok) {
    let detail = `Le service de détourage a répondu ${result.status}.`;
    try {
      const payload = await result.json() as { errors?: { title?: string }[] };
      if (payload.errors?.[0]?.title) detail = payload.errors[0].title;
    } catch {}
    return json({ error: detail }, result.status === 429 ? 429 : 502);
  }

  return json({ imageBase64: toBase64(new Uint8Array(await result.arrayBuffer())) });
});
