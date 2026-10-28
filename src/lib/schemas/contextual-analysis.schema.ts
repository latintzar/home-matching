import Ajv, { JSONSchemaType } from "ajv";

export type ContextualCategory = {
  category: string; // one of the 12 reno Google Search categories
  stance: string; // 3-5 sentences integrating all relevant info (risks, timelines, permit types, seasonality, cost OOM, etc.) in a fluid paragraph (Spanish)
  evidence: Array<{
    id?: string;
    url: string;
    title?: string;
    publisher?: string;
    date?: string;
    snippet?: string;
    confidence?: "high" | "medium" | "low";
  }>;
  confidence: "high" | "medium" | "low";
};

export interface ContextualAnalysisOutput {
  listing_id: string;
  generated_at: string; // ISO datetime
  categories: ContextualCategory[];
}

const schema: JSONSchemaType<ContextualAnalysisOutput> = {
  $id: "https://leo.casa/schemas/contextual-analysis-output.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "generated_at", "categories"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", minLength: 1 },
    categories: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "stance", "evidence", "confidence"],
        properties: {
          category: { type: "string", minLength: 2 },
          stance: { type: "string", minLength: 10 },
          evidence: {
            type: "array",
            minItems: 0,
            items: {
              type: "object",
              additionalProperties: true,
              required: ["url"],
              properties: {
                id: { type: "string", nullable: true },
                url: { type: "string" },
                title: { type: "string", nullable: true },
                publisher: { type: "string", nullable: true },
                date: { type: "string", nullable: true },
                snippet: { type: "string", nullable: true },
                confidence: { type: "string", enum: ["high", "medium", "low"], nullable: true },
              },
            },
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: false, strict: true });
export const contextualAnalysisValidator = ajv.compile(schema);
export default schema;


