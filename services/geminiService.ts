import { GoogleGenAI } from "@google/genai";
import { Note, Workspace } from "../types";

// Helper to get client securely
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is not set in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTitle = async (content: string): Promise<string> => {
  const client = getClient();
  if (!client) return "Untitled Note";

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following note content and generate a short, unique, canonical title for it. 
      Return ONLY the title text, nothing else.
      
      Content:
      ${content.substring(0, 1000)}...`,
    });
    return response.text?.trim() || "Untitled Note";
  } catch (error) {
    console.error("Error generating title:", error);
    return "Untitled Note";
  }
};

export const generateNoteCover = async (noteContext: string): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a cinematic, atmospheric sci-fi concept art for a wiki entry about: ${noteContext.substring(0, 300)}. 
            Style: Deep space, obsidian, neon accents, high detail, mysterious.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating cover:", error);
    return null;
  }
};

export const analyzeCanon = async (currentNote: Note, workspace: Workspace): Promise<string> => {
  const client = getClient();
  if (!client) return "AI Service Unavailable";

  // Context: Provide titles and statuses of other notes to check for collisions or inconsistencies
  const contextList = Object.values(workspace.notes)
    .map(n => `- ${n.title} (${n.status})`)
    .slice(0, 50) // Limit to avoid hitting token limits in this demo
    .join("\n");

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are the Cosmic Records Keeper. Analyze the following note for canon consistency.
      
      Current Note:
      Title: ${currentNote.title}
      Status: ${currentNote.status}
      Type: ${currentNote.type}
      Content: ${currentNote.content_plain}
      
      Existing Universe Context (Titles & Status):
      ${contextList}
      
      Identify:
      1. Potential contradictions with established canon (if referenced).
      2. Suggestions to improve tone or structure based on the note type.
      3. Missing details (e.g., if it's a character, does it describe appearance?).
      
      Be concise and advisory.`,
    });
    return response.text || "No insights available.";
  } catch (error) {
    console.error("Error analyzing canon:", error);
    return "Error analyzing canon.";
  }
};

export const convertNarrativeToRules = async (characterNote: Note): Promise<string> => {
    const client = getClient();
    if (!client) return "AI Unavailable";
    
    try {
        const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze the following narrative character description and convert their abilities/traits into a structured game rule format (Generic TTRPG).
            
            Character: ${characterNote.title}
            Description: ${characterNote.content_plain}
            
            Output strictly as a list of modules:
            - Stats (Strength, Agility, Intellect, Will)
            - Active Skills (Name: Effect)
            - Passive Traits (Name: Effect)
            `
        });
        return response.text || "Could not convert.";
    } catch (e) {
        return "Conversion failed.";
    }
};

export const chatWithAssistant = async (
  message: string, 
  currentNote: Note | null,
  workspace: Workspace,
  history: {role: 'user' | 'model', text: string}[]
) => {
  const client = getClient();
  if (!client) throw new Error("API Key missing");

  // Construct context
  const noteContext = currentNote 
    ? `Current Note Context:\nTitle: ${currentNote.title}\nContent: ${currentNote.content_plain}\nStatus: ${currentNote.status}` 
    : "No active note selected.";

  const systemInstruction = `You are the Cosmic Records Assistant. You help manage a fictional multiverse.
  Your principles:
  1. Data integrity and canon consistency are paramount.
  2. You are advisory, not authoritative. You never change content without permission.
  3. You can simulate in-universe perspectives if asked.
  
  ${noteContext}`;

  const chat = client.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
    },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }))
  });

  const result = await chat.sendMessage({ message });
  return result.text;
};