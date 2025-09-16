import fetch from "node-fetch";

// Keep your exact model choices
const MODEL_MAP = {
  chatgpt: "openai/gpt-oss-20b",
  gemini: "google/gemini-2.0-flash-exp",
  grok: "mistralai/mistral-small-3.2-24b-instruct",
  perplexity: "qwen/qwen3-14b",
  deepseek: "deepseek/deepseek-chat-v3.1",
};

export const handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { model } = event.queryStringParameters || {};
    const body = JSON.parse(event.body || "{}");
    const { prompt, imageBase64 } = body;

    if (!MODEL_MAP[model]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid model: ${model}` }),
      };
    }

    const messages = [
      {
        role: "user",
        content: [],
      },
    ];

    if (prompt) {
      messages[0].content.push({ type: "text", text: prompt });
    }

    if (imageBase64) {
      messages[0].content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      });
    }

    console.log(`Making request to model: ${MODEL_MAP[model]}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://omni-ai-chat.app", // Replace with your actual domain
        "X-Title": "Omni-AI Chat"
      },
      body: JSON.stringify({
        model: MODEL_MAP[model],
        messages: messages,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error for ${model}:`, errorText);
      throw new Error(`API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response format:", data);
      throw new Error("Invalid response format from API");
    }

    const assistantMessage = data.choices[0].message.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: assistantMessage }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Internal Server Error: ${error.message}` }),
    };
  }
};