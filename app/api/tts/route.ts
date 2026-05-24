import { rejectWithoutFamilySession } from "@/lib/auth";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI API key is not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { text?: string };
  const text = String(body.text ?? "").trim();

  if (text.length < 1) {
    return Response.json({ error: "Text is required." }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "marin",
      input: text.slice(0, 1000),
      instructions:
        "Speak naturally and warmly for a child learning English. Use clear American English, gentle intonation, and a slightly slower classroom pace.",
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    return Response.json({ error: "Text-to-speech request failed." }, { status: 502 });
  }

  const audio = await response.arrayBuffer();
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store"
    }
  });
}
