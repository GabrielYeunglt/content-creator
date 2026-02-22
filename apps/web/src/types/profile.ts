export type SelectorType = 'css' | 'xpath';

export type ExtractMode = 'text' | 'html' | 'attribute';
export type AttributeUrlMode = 'value' | 'fetch-image-data-url';
<<<<<<< HEAD
export type MetadataFieldType =
  | 'title'
  | 'author'
  | 'chapter'
  | 'publisher'
  | 'series'
  | 'cover'
  | 'language'
  | 'description'
  | 'other';
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3

export type SelectorRule = {
  id: string;
  fieldName: string;
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName?: string;
  attributeUrlMode?: AttributeUrlMode;
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
  metadataRules?: Array<{
    id: string;
    fieldType: MetadataFieldType;
    customFieldName?: string;
    selectorType: SelectorType;
    selector: string;
    extractMode: ExtractMode;
    attributeName?: string;
    attributeUrlMode?: AttributeUrlMode;
  }>;
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
  contentAttributeUrlMode: 'value' as AttributeUrlMode,
<<<<<<< HEAD
  metadataRules: [] as Array<{
    id: string;
    fieldType: MetadataFieldType;
    customFieldName: string;
    selectorType: SelectorType;
    selector: string;
    extractMode: ExtractMode;
    attributeName: string;
    attributeUrlMode: AttributeUrlMode;
  }>,
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
  nextSelectorType: 'css' as SelectorType,
  nextSelector: '',
  nextAttributeName: 'href',
  maxPages: 100
};

export type ProfileDraft = typeof defaultProfileDraft;
