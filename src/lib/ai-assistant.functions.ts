import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
});

const SYSTEM_PROMPT = `You are the KYC & Verification Assistant for the Cognito Student Card Portal.

You help administrators and verifiers:
- Understand the KYC verification workflow (Pending → In Review → Approved / Rejected).
- Explain what to check on a student record: full name, roll number, Aadhaar (12 digits), mobile (digits only), email, date of birth (YYYY-MM-DD), pincode (6 digits), address, institution.
- Suggest reasons a record might be rejected (mismatched name, invalid Aadhaar format, blurry/missing documents, duplicate roll number, mismatched DOB, etc.).
- Walk users through approving, rejecting, or re-reviewing students from the KYC Monitoring page.
- Answer general questions about uploads, validation errors, card generation, and reports inside the portal.

Rules:
- Be concise and friendly. Use short paragraphs or bullet points.
- Never invent student data. If asked about a specific student, tell the user to open the KYC Monitoring page and search by name, roll, email, or Aadhaar.
- Never ask the user to share Aadhaar numbers, passwords, or OTPs in chat.
- If a request is outside KYC/portal scope, politely redirect.`;

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chatSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI assistant is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) {
      throw new Error("Rate limit reached. Please try again in a moment.");
    }
    if (res.status === 402) {
      throw new Error("AI credits exhausted. Add credits in Lovable Cloud settings.");
    }
    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      throw new Error("AI assistant is temporarily unavailable.");
    }

    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content as string | undefined;
    return { reply: reply ?? "Sorry, I couldn't generate a response." };
  });