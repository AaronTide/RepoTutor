
import { GoogleGenAI, Type } from "@google/genai";
import { Chapter, Tutorial, LearningMode, TraceResult, CodeExplanation } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Robustly parses JSON from AI responses, handling markdown wrappers and potential truncation.
 */
const safeJsonParse = (text: string) => {
  try {
    let cleaned = text.trim();
    // Remove Markdown code block wrappers
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse failed. Raw Text:", text);
    // If it fails, try to find the first '{' or '[' and the last '}' or ']'
    try {
      const startObj = text.indexOf('{');
      const startArr = text.indexOf('[');
      const start = (startObj !== -1 && (startArr === -1 || startObj < startArr)) ? startObj : startArr;
      
      const endObj = text.lastIndexOf('}');
      const endArr = text.lastIndexOf(']');
      const end = (endObj !== -1 && (endArr === -1 || endObj > endArr)) ? endObj : endArr;
      
      if (start !== -1 && end !== -1 && end > start) {
        const sliced = text.slice(start, end + 1);
        return JSON.parse(sliced);
      }
    } catch (innerError) {
      console.error("Nested JSON recovery failed", innerError);
    }
    throw new Error("The AI provided an invalid data format or the response was truncated. Please try again.");
  }
};

export const generateTutorial = async (
  repoName: string, 
  treeSummary: string, 
  readme: string, 
  mode: LearningMode
): Promise<Tutorial> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
      Act as an expert software architect and educator. 
      Analyze the following repository: ${repoName}
      Learning Mode: ${mode}

      README Snippet:
      ${readme.slice(0, 3000)}

      File Structure Summary:
      ${treeSummary}

      Generate a comprehensive step-by-step tutorial. 
      IMPORTANT: Ensure the JSON is complete and valid. 
      All Mermaid diagrams MUST be top-down (graph TD).
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          repoName: { type: Type.STRING },
          description: { type: Type.STRING },
          highLevelArchitecture: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                content: { type: Type.STRING, description: "Markdown content" },
                mermaidDiagram: { type: Type.STRING, description: "Mermaid 'graph TD' diagram" },
                keyFiles: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "title", "summary", "content"]
            }
          }
        },
        required: ["repoName", "description", "chapters", "highLevelArchitecture"]
      }
    }
  });

  return safeJsonParse(response.text);
};

export const traceExecutionFlow = async (
  query: string,
  repoName: string,
  treeSummary: string,
  mode: LearningMode
): Promise<TraceResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
      Trace execution for: "${query}" in ${repoName}
      Mode: ${mode}
      Files:
      ${treeSummary}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING },
          diagram: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.NUMBER },
                component: { type: Type.STRING },
                action: { type: Type.STRING },
                explanation: { type: Type.STRING },
                file: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return safeJsonParse(response.text);
};

export const explainCode = async (
  path: string,
  content: string,
  mode: LearningMode
): Promise<CodeExplanation> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze file: ${path} (Mode: ${mode})\nCode:\n${content.slice(0, 5000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          whatItDoes: { type: Type.STRING },
          whyItExists: { type: Type.STRING },
          dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
          breakageImpact: { type: Type.STRING }
        }
      }
    }
  });
  return safeJsonParse(response.text);
};
