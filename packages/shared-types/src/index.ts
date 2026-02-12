export type SelectorType = 'css' | 'xpath';

export type SelectorRule = {
  fieldName: string;
  selectorType: SelectorType;
  selector: string;
  extractMode: 'text' | 'html' | 'attribute';
  attributeName?: string;
  required?: boolean;
};

export type WebsiteProfile = {
  id: string;
  name: string;
  domain: string;
  selectorRules: SelectorRule[];
};
