
export const ModelRegistry = {
  CLUSTERING: 'gemini-3-pro-preview',
  STRATEGY: 'gemini-3-pro-preview',
  SCOPE: 'gemini-3-pro-preview',
  VISUALS: {
    PROMPT: 'gemini-2.5-pro',
    INPAINT: 'gemini-3-pro-image-preview', // Updated to latest 3.0 model
    RENDER: 'gemini-3-pro-image-preview'
  },
  RESEARCH: {
    QUERY: 'gemini-2.5-flash',
    CURATION: 'gemini-2.5-flash-lite'
  },
  TEXT_ANALYSIS: 'gemini-2.5-flash-lite'
} as const;

export type TaskType = 
  | 'clustering' 
  | 'strategy' 
  | 'scope' 
  | 'visuals.prompt' 
  | 'visuals.inpaint' 
  | 'visuals.render' 
  | 'research.query' 
  | 'research.curation'
  | 'text_analysis';

export function getModelForTask(task: TaskType): string {
  switch (task) {
    case 'clustering': return ModelRegistry.CLUSTERING;
    case 'strategy': return ModelRegistry.STRATEGY;
    case 'scope': return ModelRegistry.SCOPE;
    case 'visuals.prompt': return ModelRegistry.VISUALS.PROMPT;
    case 'visuals.inpaint': return ModelRegistry.VISUALS.INPAINT;
    case 'visuals.render': return ModelRegistry.VISUALS.RENDER;
    case 'research.query': return ModelRegistry.RESEARCH.QUERY;
    case 'research.curation': return ModelRegistry.RESEARCH.CURATION;
    case 'text_analysis': return ModelRegistry.TEXT_ANALYSIS;
    default: return 'gemini-2.5-flash'; // Fallback
  }
}

