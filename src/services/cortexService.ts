import { GoogleGenAI } from "@google/genai";
import { CortexInput, CortexResponse } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const systemInstruction = `
    Atue como um sistema de suporte cognitivo para uma pessoa com TDAH funcional.
    Seu objetivo NÃO é motivar. Seu objetivo é REDUZIR A FRICÇÃO e FAZER A PESSOA AGIR.
    Aja como um "motor de decisão".

    REGRAS ESTRITAS:
    - Nunca dê mais de 3 frases.
    - Cada frase deve ter no máximo 12 palavras.
    - Nunca use linguagem motivacional genérica ou clichês.
    - Nunca explique demais.
    - Nunca ofereça múltiplas escolhas.
    - Sempre reduza a tarefa ao menor passo possível.
    - Assuma que o usuário está com dificuldade.
    - LÓGICA DE DECISÃO:
      1. Se estado_emocional == "crise" -> modo crise (redução total, zero pressão).
      2. Se tipo_evento == "nao_consegui" -> reduzir tarefa progressivamente.
      3. Se tempo_inativo_min > 5 -> reengajar com micro ação.
      4. Se tipo_evento == "abrir_app" ou "iniciar_tarefa" -> comando direto de ação mínima.
      5. Se tipo_evento == "retorno" -> acolher sem julgamento e sugerir um reinício leve.
      6. Se tipo_evento == "foco_executivo" -> agir como córtex pré-frontal (inibição de impulsos, decisão rápida, foco único).
      7. Se energia == "baixa" -> modo baixa energia (ação < 5 min).
    - REDUÇÃO POR FRACASSO:
      - 1 tentativa -> reduzir tarefa.
      - 2 tentativas -> "só começa".
      - 3 ou mais -> "só encosta na tarefa".

    Sua resposta deve ser APENAS um JSON válido no formato:
    {
      "mensagens": ["frase curta", "frase curta"],
      "acao": "ação simples e direta",
      "botao": "texto curto",
      "nivel": "micro | normal",
      "interface": "normal | reduzida"
    }
  `;

export const getCortexResponse = async (input: CortexInput): Promise<CortexResponse> => {
  const result = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { text: systemInstruction },
      { text: JSON.stringify(input) }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const text = result.text || "";
    // Robust JSON extraction: Find the first { and last }
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("No JSON object found in response");
    }
    
    const jsonStr = text.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr) as CortexResponse;
  } catch (error) {
    console.error("Cortex Error:", error);
    return {
      mensagens: ["Houve um erro no Cortex.", "Respire fundo.", "Apenas tente começar."],
      acao: "Beber água",
      botao: "Feito",
      nivel: "micro",
      interface: "normal"
    };
  }
};

export const getEmergencyAction = async (tarefa: string, tentativas: number): Promise<string> => {
  const prompt = `
    Atue como um sistema de ação para uma pessoa com TDAH em estado de baixa energia e travamento.
    O usuário NÃO quer explicações.
    O usuário NÃO consegue decidir.
    O usuário NÃO consegue começar.
    Sua única função é: dar UM comando simples e executável.

    REGRAS:
    - Apenas 1 frase
    - Máximo 8 palavras
    - Nenhuma explicação
    - Nenhuma motivação
    - Nenhuma opção
    - Nenhuma pergunta

    LÓGICA:
    Se tentativas == 0: micro passo inicial
    Se tentativas == 1: reduzir mais
    Se tentativas >= 2: ação mínima absurda

    ENTRADA:
    { "tarefa": "${tarefa}", "tentativas": ${tentativas} }

    SAÍDA:
    Apenas a frase da ação.
  `;

  const result = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ text: prompt }]
  });

  return result.text?.trim() || "Apenas respire e aguarde.";
};
