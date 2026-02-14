export type SelectorType = 'css' | 'xpath';

export type ExtractMode = 'text' | 'html' | 'attribute';

export type SelectorRule = {
  id: string;
  fieldName: string;
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
  required: boolean;
};

export type StopRules = {
  stopWhenNoNextButton: boolean;
  stopWhenUrlVisited: boolean;
  maxPages: number;
};

export type PaginationRule = {
  selectorType: SelectorType;
  selector: string;
  attributeName: string;
};

export type WebsiteProfile = {
  id: string;
  name: string;
  domain: string;
  selectorRules: SelectorRule[];
  paginationRule: PaginationRule;
  stopRules: StopRules;
  createdAt: string;
  updatedAt: string;
};

export const defaultSelectorRule: SelectorRule = {
  id: '',
  fieldName: 'body',
  selectorType: 'css',
  selector: '',
  extractMode: 'html',
  required: true
};

export const defaultProfileDraft = {
  name: '',
  domain: '',
  fieldName: defaultSelectorRule.fieldName,
  selectorType: defaultSelectorRule.selectorType,
  selector: defaultSelectorRule.selector,
  extractMode: defaultSelectorRule.extractMode,
  required: defaultSelectorRule.required,
  contentAttributeName: 'href',
  nextSelectorType: 'css' as SelectorType,
  nextSelector: '',
  nextAttributeName: 'href',
  maxPages: 100
};

export type ProfileDraft = typeof defaultProfileDraft;
