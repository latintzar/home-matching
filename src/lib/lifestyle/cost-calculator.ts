import { PRICING as CENTRAL_PRICING } from '../pricing-config';

// Map central pricing to local interface for backward compatibility if needed,
// or just use CENTRAL_PRICING directly.
const PRICING = {
  GEMINI_3_PRO: CENTRAL_PRICING.VERTEX_AI.GEMINI_3_PRO,
  GEMINI_2_5_FLASH: CENTRAL_PRICING.VERTEX_AI.GEMINI_2_5_FLASH,
  SCRAPING_DOG: CENTRAL_PRICING.APIS.SCRAPING_DOG,
  GEOAPIFY: CENTRAL_PRICING.APIS.GEOAPIFY
};

export interface UsageStats {
  geminiPro: { inputChars: number; outputChars: number };
  geminiFlash: { inputChars: number; outputChars: number };
  scrapingDogCalls: number;
  geoapifyCalls: number;
}

export class CostTracker {
  private stats: UsageStats = {
    geminiPro: { inputChars: 0, outputChars: 0 },
    geminiFlash: { inputChars: 0, outputChars: 0 },
    scrapingDogCalls: 0,
    geoapifyCalls: 0
  };

  trackGeminiPro(inputChars: number, outputChars: number) {
    this.stats.geminiPro.inputChars += inputChars;
    this.stats.geminiPro.outputChars += outputChars;
  }

  trackGeminiFlash(inputChars: number, outputChars: number) {
    this.stats.geminiFlash.inputChars += inputChars;
    this.stats.geminiFlash.outputChars += outputChars;
  }

  trackScrapingDog(calls: number = 1) {
    this.stats.scrapingDogCalls += calls;
  }

  trackGeoapify(calls: number = 1) {
    this.stats.geoapifyCalls += calls;
  }

  // Helper: Convert Chars to Tokens (Roughly 4 chars = 1 token)
  private estimateTokens(chars: number): number {
    return Math.ceil(chars / 4);
  }

  calculateTotal(): string {
    // Gemini 3 Pro (Profiler/Strategist)
    const proInputTokens = this.estimateTokens(this.stats.geminiPro.inputChars);
    const proOutputTokens = this.estimateTokens(this.stats.geminiPro.outputChars);
    const proCost = 
      (proInputTokens / 1_000_000) * PRICING.GEMINI_3_PRO.inputPer1MTokens +
      (proOutputTokens / 1_000_000) * PRICING.GEMINI_3_PRO.outputPer1MTokens;

    // Gemini 2.5 Flash (Scout)
    const flashInputTokens = this.estimateTokens(this.stats.geminiFlash.inputChars);
    const flashOutputTokens = this.estimateTokens(this.stats.geminiFlash.outputChars);
    const flashCost = 
      (flashInputTokens / 1_000_000) * PRICING.GEMINI_2_5_FLASH.inputPer1MTokens +
      (flashOutputTokens / 1_000_000) * PRICING.GEMINI_2_5_FLASH.outputPer1MTokens;

    // APIs
    const scrapingCost = this.stats.scrapingDogCalls * PRICING.SCRAPING_DOG.perRequest;
    const geoapifyCost = 0; // Free tier

    const total = proCost + flashCost + scrapingCost + geoapifyCost;

    return total.toFixed(5); // 5 decimal places for precision with micro-costs
  }

  getBreakdown() {
    // Helper to calc single component cost
    const calcGeminiCost = (charsIn: number, charsOut: number, priceIn: number, priceOut: number) => {
      const tokensIn = this.estimateTokens(charsIn);
      const tokensOut = this.estimateTokens(charsOut);
      return ((tokensIn / 1_000_000) * priceIn + (tokensOut / 1_000_000) * priceOut).toFixed(5);
    };

    return {
      gemini3Pro: {
        usage_chars: `${this.stats.geminiPro.inputChars} in / ${this.stats.geminiPro.outputChars} out`,
        est_tokens: `${this.estimateTokens(this.stats.geminiPro.inputChars)} in / ${this.estimateTokens(this.stats.geminiPro.outputChars)} out`,
        cost: calcGeminiCost(
          this.stats.geminiPro.inputChars, 
          this.stats.geminiPro.outputChars, 
          PRICING.GEMINI_3_PRO.inputPer1MTokens, 
          PRICING.GEMINI_3_PRO.outputPer1MTokens
        )
      },
      gemini2_5Flash: {
        usage_chars: `${this.stats.geminiFlash.inputChars} in / ${this.stats.geminiFlash.outputChars} out`,
        est_tokens: `${this.estimateTokens(this.stats.geminiFlash.inputChars)} in / ${this.estimateTokens(this.stats.geminiFlash.outputChars)} out`,
        cost: calcGeminiCost(
          this.stats.geminiFlash.inputChars, 
          this.stats.geminiFlash.outputChars, 
          PRICING.GEMINI_2_5_FLASH.inputPer1MTokens, 
          PRICING.GEMINI_2_5_FLASH.outputPer1MTokens
        )
      },
      scrapingDog: {
        calls: this.stats.scrapingDogCalls,
        cost: (this.stats.scrapingDogCalls * PRICING.SCRAPING_DOG.perRequest).toFixed(5)
      },
      total: this.calculateTotal()
    };
  }
}

export const globalCostTracker = new CostTracker();
