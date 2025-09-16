import fetch from "node-fetch";

// Using your original free models - these should be free based on your research
const MODEL_MAP = {
  chatgpt: "openai/gpt-oss-120b:free",
  gemini: "google/gemma-3-27b-it:free", 
  grok: "meta-llama/llama-3.3-70b-instruct:free",
  perplexity: "qwen/qwen3-235b-a22b:free",
  deepseek: "deepseek/deepseek-chat-v3.1:free"
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
    // Extract model from the path instead of query parameters
    const pathSegments = event.path.split('/');
    const model = pathSegments[pathSegments.length - 1]; // Gets the last segment (chatgpt, grok, etc.)
    
    console.log(`Extracted model: ${model} from path: ${event.path}`);
    
    const body = JSON.parse(event.body || "{}");
    const { prompt, imageBase64 } = body;

    // Validate model
    if (!MODEL_MAP[model]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid model: ${model}. Available models: ${Object.keys(MODEL_MAP).join(', ')}` }),
      };
    }

    // Validate that we have some input
    if (!prompt && !imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Either prompt or imageBase64 must be provided" }),
      };
    }

    const messages = [
      {
        role: "user",
        content: [],
      },
    ];

    // Add text content if prompt exists
    if (prompt && prompt.trim()) {
      messages[0].content.push({ 
        type: "text", 
        text: prompt.trim() 
      });
    }

    // Add image content if imageBase64 exists
    if (imageBase64) {
      messages[0].content.push({
        type: "image_url",
        image_url: { 
          url: `data:image/jpeg;base64,${imageBase64}` 
        },
      });
    }

    // Ensure we have at least one content item
    if (messages[0].content.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No valid content provided" }),
      };
    }

    console.log(`Making request to model: ${MODEL_MAP[model]}`);
    console.log(`Content items: ${messages[0].content.length}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://omni-ai-chat.netlify.app", 
        "X-Title": "Omni-AI Chat"
      },
      body: JSON.stringify({
        model: MODEL_MAP[model],
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
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
