import Groq from 'groq-sdk';
import { selectReasoningModelWithMostTokens } from './modelSelection.js';

/**
 * LLM Helper for categorizing customer support messages
 * Using Groq API for AI-powered categorization
 */

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
});

let cachedModelId = null

async function resolveCategorizationModel() {
  if (cachedModelId) return cachedModelId

  const listing = await groq.models.list()
  const selected = selectReasoningModelWithMostTokens(listing.data)
  if (!selected) {
    throw new Error('No reasoning model is available for this Groq API key')
  }

  cachedModelId = selected.id
  console.info(`Using Groq model ${cachedModelId}`)
  return cachedModelId
}

/**
 * Categorize a customer support message using Groq AI
 * 
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, reasoning: string}>}
 */
export async function categorizeMessage(message) {
  try {
    const model = await resolveCategorizationModel()
    const response = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: `Classify the customer support message below.
Reply with one category on the first line, using exactly one of these labels:
Billing Issue
Technical Problem
Feature Request
General Inquiry
Then add a short explanation.

Message:
${message}`
        }
      ],
      temperature: 0.7,
      max_tokens: 512,
    });

    const choice = response.choices[0].message
    const content = (choice.content || choice.reasoning || '').trim();
    
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
    const firstLine = (lines[0] || '').replace(/^[^A-Za-z]+/, '')
    const knownCategories = ['Billing Issue', 'Technical Problem', 'Feature Request', 'General Inquiry']
    let category = knownCategories.find((label) => firstLine.toLowerCase().startsWith(label.toLowerCase()))

    if (!category && content.toLowerCase().includes('billing')) {
      category = "Billing Issue";
    } else if (!category && (content.toLowerCase().includes('technical') || content.toLowerCase().includes('bug'))) {
      category = "Technical Problem";
    } else if (!category && content.toLowerCase().includes('feature')) {
      category = "Feature Request";
    } else if (!category && (content.toLowerCase().includes('inquiry') || content.toLowerCase().includes('question'))) {
      category = "General Inquiry";
    }

    if (!category) category = "Unknown"
    
    return {
      category,
      reasoning: content
    };
  } catch (error) {
    console.warn('Groq API failed, using mock response:', error.message);
    return getMockCategorization(message);
  }
}

/**
 * Mock categorization for when API is unavailable
 */
function getMockCategorization(message) {
  const lowerMessage = message.toLowerCase();
  
  // Array of possible reasoning variations for each category
  const reasoningVariations = {
    billing: [
      "Based on keywords related to payments and billing, this appears to be a billing-related inquiry. The customer may need assistance with account charges or payment issues.",
      "This message contains billing terminology. The customer is likely experiencing issues with payments, invoices, or account charges.",
      "The message references financial matters related to the customer's account. This suggests a billing or payment concern that requires attention.",
    ],
    technical: [
      "This message describes technical difficulties or system errors. The customer is reporting functionality issues that may require engineering review.",
      "Based on error-related keywords, this appears to be a technical support issue. The customer is experiencing problems with product functionality.",
      "The message indicates a technical problem or bug. This requires investigation from the technical support team.",
      "System-related issues are mentioned in this message. The customer needs technical assistance to resolve functionality problems.",
    ],
    feature: [
      "This message suggests improvements or new functionality. The customer is providing product feedback and feature suggestions.",
      "The customer is requesting enhancements to the product. This appears to be a feature request that should be reviewed by the product team.",
      "Based on the language used, this seems to be a suggestion for product improvements rather than a support issue.",
    ],
    inquiry: [
      "This appears to be a general question about the product or service. The customer is seeking information or clarification.",
      "The message contains questions that don't indicate a specific problem. This is likely a general inquiry requiring informational support.",
      "Based on the question format, this seems to be an information request rather than a technical or billing issue.",
    ],
    positive: [
      "This message contains positive sentiment and appreciation. While not a support request, it may warrant acknowledgment.",
      "The customer is expressing satisfaction or gratitude. This doesn't appear to require immediate support action.",
    ],
    ambiguous: [
      "The message content is unclear or doesn't match standard support categories. Manual review may be needed for proper categorization.",
      "This message doesn't contain clear indicators for automatic categorization. Human review recommended.",
    ]
  };
  
  // Helper to get random reasoning
  const getRandomReasoning = (category) => {
    const reasons = reasoningVariations[category];
    return reasons[Math.floor(Math.random() * reasons.length)];
  };
  
  // Billing-related detection
  if (lowerMessage.includes('bill') || lowerMessage.includes('payment') || 
      lowerMessage.includes('charge') || lowerMessage.includes('invoice') ||
      lowerMessage.includes('credit card') || lowerMessage.includes('subscription') ||
      lowerMessage.includes('refund') || lowerMessage.includes('cancel') && lowerMessage.includes('account')) {
    return {
      category: "Billing Issue",
      reasoning: getRandomReasoning('billing')
    };
  }
  
  // Technical problem detection
  if (lowerMessage.includes('bug') || lowerMessage.includes('error') || 
      lowerMessage.includes('broken') || lowerMessage.includes('not working') ||
      lowerMessage.includes('crash') || lowerMessage.includes('down') || 
      lowerMessage.includes('server') || lowerMessage.includes('loading') ||
      lowerMessage.includes('slow') || lowerMessage.includes('issue') ||
      lowerMessage.includes('problem') && !lowerMessage.includes('no problem')) {
    return {
      category: "Technical Problem",
      reasoning: getRandomReasoning('technical')
    };
  }
  
  // Feature request detection
  if (lowerMessage.includes('feature') || lowerMessage.includes('add') && (lowerMessage.includes('please') || lowerMessage.includes('could')) ||
      lowerMessage.includes('improve') || lowerMessage.includes('would like to see') ||
      lowerMessage.includes('suggestion') || lowerMessage.includes('wish') ||
      lowerMessage.includes('could you') && lowerMessage.includes('add') ||
      lowerMessage.includes('enhancement') || lowerMessage.includes('would be great')) {
    return {
      category: "Feature Request",
      reasoning: getRandomReasoning('feature')
    };
  }
  
  // Positive feedback detection
  if ((lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) &&
      !lowerMessage.includes('but') && !lowerMessage.includes('however')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('positive')
    };
  }
  
  // Question/inquiry detection
  if (lowerMessage.includes('how') || lowerMessage.includes('what') || 
      lowerMessage.includes('when') || lowerMessage.includes('where') ||
      lowerMessage.includes('can i') || lowerMessage.includes('is there') ||
      lowerMessage.includes('?')) {
    return {
      category: "General Inquiry",
      reasoning: getRandomReasoning('inquiry')
    };
  }
  
  // Fallback for ambiguous messages
  return {
    category: "General Inquiry",
    reasoning: getRandomReasoning('ambiguous')
  };
}
