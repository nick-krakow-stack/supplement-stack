export const KNOWLEDGE_CATEGORY_LABELS = {
  vitamine: 'Vitamine',
  mineralstoffe: 'Mineralstoffe',
  spurenelemente: 'Spurenelemente',
  aminosaeuren_proteine: 'Aminosäuren & Proteine',
  fettsaeuren: 'Fettsäuren',
  pflanzenstoffe_extrakte: 'Pflanzenstoffe & Extrakte',
  heilpilze: 'Heilpilze',
  enzyme: 'Enzyme',
  probiotika: 'Probiotika',
  sonstige: 'Sonstige',
} as const;

export function knowledgeCategoryLabel(key: string | null): string | null {
  return key && Object.prototype.hasOwnProperty.call(KNOWLEDGE_CATEGORY_LABELS, key)
    ? KNOWLEDGE_CATEGORY_LABELS[key as keyof typeof KNOWLEDGE_CATEGORY_LABELS] : null;
}
