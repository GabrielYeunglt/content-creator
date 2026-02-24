export type SelectorType = 'css' | 'xpath';

export type ExtractMode = 'text' | 'html' | 'attribute';
export type AttributeUrlMode = 'value' | 'fetch-image-data-url';
export type MetadataFieldType =
  | 'title'
  | 'author'
  | 'volume'
  | 'chapter'
  | 'publisher'
  | 'series'
  | 'subject'
  | 'cover'
  | 'language'
  | 'description'
  | 'other';

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
  navigationMode?: 'url-attribute' | 'click' | 'url-pattern';
  postNavigationDelaySeconds?: number;
};

export type TotalPagesRule = {
  selectorType: SelectorType;
  selector: string;
  attributeName?: string;
};

export type WebsiteProfile = {
  id: string;
  name: string;
  domain: string;
  profileType?: 'single-url' | 'multi-url';
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
  totalPagesRule?: TotalPagesRule;
  stopRules: StopRules;
  multiUrlOverrides?: Partial<Record<MetadataFieldType | 'other', string>>;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionRuleType = 'content' | 'metadata' | 'pagination' | 'total-pages';

export type ExtractionRuleDraft = {
  id: string;
  type: ExtractionRuleType;
  label: string;
  showByDefault: boolean;
  optional?: boolean;
  selectorType: SelectorType;
  selector: string;
  extractMode: ExtractMode;
  attributeName: string;
  attributeUrlMode: AttributeUrlMode;
  fieldName?: string;
  required?: boolean;
  fieldType?: MetadataFieldType;
  customFieldName?: string;
  navigationMode?: 'url-attribute' | 'click' | 'url-pattern';
  postNavigationDelaySeconds?: number;
};

export const defaultSelectorRule: SelectorRule = {
  id: '',
  fieldName: 'body',
  selectorType: 'css',
  selector: '',
  extractMode: 'html',
  required: true
};

function createContentRule(): ExtractionRuleDraft {
  return {
    id: crypto.randomUUID(),
    type: 'content',
    label: 'Primary Content Selector',
    showByDefault: true,
    optional: false,
    selectorType: 'css',
    selector: '',
    extractMode: 'html',
    attributeName: 'href',
    attributeUrlMode: 'value',
    fieldName: 'body',
    required: true
  };
}

function createPaginationRule(): ExtractionRuleDraft {
  return {
    id: crypto.randomUUID(),
    type: 'pagination',
    label: 'Pagination Rule (Next Button)',
    showByDefault: true,
    optional: false,
    selectorType: 'css',
    selector: '',
    extractMode: 'attribute',
    attributeName: 'href',
    attributeUrlMode: 'value',
    navigationMode: 'url-attribute',
    postNavigationDelaySeconds: 0.5
  };
}

function createTotalPagesRule(): ExtractionRuleDraft {
  return {
    id: crypto.randomUUID(),
    type: 'total-pages',
    label: 'Total Pages Rule',
    showByDefault: true,
    optional: true,
    selectorType: 'css',
    selector: '',
    extractMode: 'text',
    attributeName: '',
    attributeUrlMode: 'value'
  };
}

export function createMetadataExtractionRule(): ExtractionRuleDraft {
  return {
    id: crypto.randomUUID(),
    type: 'metadata',
    label: 'Metadata Extraction',
    showByDefault: false,
    optional: true,
    selectorType: 'css',
    selector: '',
    extractMode: 'text',
    attributeName: 'href',
    attributeUrlMode: 'value',
    fieldType: 'title',
    customFieldName: ''
  };
}

export function createDefaultExtractionRules(): ExtractionRuleDraft[] {
  return [createContentRule(), createPaginationRule(), createTotalPagesRule()];
}

export type ProfileDraft = {
  name: string;
  domain: string;
  profileType: 'single-url' | 'multi-url';
  extractionRules: ExtractionRuleDraft[];
  multiUrlOverrides: Partial<Record<MetadataFieldType | 'other', string>>;
  maxPages: number;
};

export function createDefaultProfileDraft(): ProfileDraft {
  return {
    name: '',
    domain: '',
    profileType: 'single-url',
    extractionRules: createDefaultExtractionRules(),
    multiUrlOverrides: {},
    maxPages: 100
  };
}
