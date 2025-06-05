import { apiKeyService } from './apiKeyStorage';
import { logger } from '../utils/logger';

export class GeminiService {
  private readonly API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
  private debounceTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 500; // 500ms delay

  async getSuggestion(
    goalText: string,
    goalType: 'Monthly Goal' | 'Weekly Goal',
    contextData: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      // Set new timeout
      this.debounceTimeout = setTimeout(async () => {
        try {
          const suggestion = await this.fetchSuggestion(
            goalText,
            goalType,
            contextData
          );
          resolve(suggestion);
        } catch (error) {
          reject(error);
        }
      }, this.DEBOUNCE_DELAY);
    });
  }

  private async fetchSuggestion(
    goalText: string,
    goalType: 'Monthly Goal' | 'Weekly Goal',
    contextData: string
  ): Promise<string> {
    const apiKey = await apiKeyService.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = this.buildPrompt(goalText, goalType, contextData);

    try {
      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 150,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Gemini API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!suggestion) {
        throw new Error('No suggestion received from Gemini');
      }

      return suggestion.trim();
    } catch (error) {
      logger.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  private buildPrompt(
    goalText: string,
    goalType: string,
    contextData: string
  ): string {
    let context = '';

    try {
      const data = JSON.parse(contextData);

      // Build context from monthly goals
      if (data.monthlyGoals && data.monthlyGoals.length > 0) {
        context += '\nMonthly Goals:\n';
        data.monthlyGoals.forEach((goal: any) => {
          const rating = goal.rating ? ` [${goal.rating}]` : '';
          context += `- ${goal.text}${rating}\n`;
        });
      }

      // Build context from weekly goals
      if (data.weeks && data.weeks.length > 0) {
        const weekGoals = data.weeks.filter(
          (week: any) => week.goals && week.goals.length > 0
        );
        if (weekGoals.length > 0) {
          context += '\nWeekly Goals:\n';
          weekGoals.forEach((week: any) => {
            context += `- ${week.label}: ${week.goals.join(', ')}\n`;
          });
        }
      }
    } catch (error) {
      // If context parsing fails, continue without context
      logger.warn('Failed to parse context data:', error);
    }

    return `Rewrite this goal in SMART format, keeping consistent with the user's style of writing (Specific, Measurable, Achievable, Relevant, Time-bound):

Goal Type: ${goalType}
Current Goal: "${goalText}"

Context - Other goals in this section:${context}

Please provide only the rewritten SMART goal, no explanation or additional text. Keep it concise and actionable.`;
  }

  // Method to test API key validity
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Test message',
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error('Error testing Gemini API key:', error);
      return false;
    }
  }

  // Cancel any pending requests
  cancelPendingRequests(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }
}

export const geminiService = new GeminiService();
