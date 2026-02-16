export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ScrapeJob = {
  id: string;
  profileId: string;
  startUrl: string;
  status: JobStatus;
};

export type CanonicalChapter = {
  id: string;
  sourceUrl: string;
  title: string;
  bodyHtml: string;
  assets: {
    stylesheets: string[];
    scripts: string[];
  };
};

export type CanonicalDocument = {
  id: string;
  title: string;
  sourceDomain: string;
  chapters: CanonicalChapter[];
  generatedAt: string;
};

export type ConsolidationInputPage = {
  url: string;
  preview: string;
  stylesheets?: string[];
  scripts?: string[];
};

export function buildCanonicalDocument(params: {
  jobId: string;
  profileName: string;
  profileDomain: string;
  pages: ConsolidationInputPage[];
}): CanonicalDocument {
  const { jobId, profileName, profileDomain, pages } = params;

  return {
    id: jobId,
    title: profileName,
    sourceDomain: profileDomain,
    generatedAt: new Date().toISOString(),
    chapters: pages.map((page, index) => ({
      id: `${jobId}-chapter-${index + 1}`,
      sourceUrl: page.url,
      title: `Chapter ${index + 1}`,
      bodyHtml: page.preview,
      assets: {
        stylesheets: page.stylesheets ?? [],
        scripts: page.scripts ?? []
      }
    }))
  };
}
