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
<<<<<<< HEAD
  metadata?: Record<string, string>;
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
};

export type CanonicalDocument = {
  id: string;
  title: string;
  sourceDomain: string;
  chapters: CanonicalChapter[];
  generatedAt: string;
<<<<<<< HEAD
  metadata: Record<string, string>;
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
};

export type ConsolidationInputPage = {
  url: string;
  content?: string;
  preview: string;
<<<<<<< HEAD
  metadata?: Record<string, string>;
=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
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

<<<<<<< HEAD
  const documentMetadata = mergeDocumentMetadata(pages);

=======
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
  return {
    id: jobId,
    title: profileName,
    sourceDomain: profileDomain,
    generatedAt: new Date().toISOString(),
<<<<<<< HEAD
    metadata: documentMetadata,
    chapters: pages.map((page, index) => ({
      id: `${jobId}-chapter-${index + 1}`,
      sourceUrl: page.url,
      title: page.metadata?.chapter || page.metadata?.title || `Chapter ${index + 1}`,
=======
    chapters: pages.map((page, index) => ({
      id: `${jobId}-chapter-${index + 1}`,
      sourceUrl: page.url,
      title: `Chapter ${index + 1}`,
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
      bodyHtml: page.content ?? page.preview,
      assets: {
        stylesheets: page.stylesheets ?? [],
        scripts: page.scripts ?? []
<<<<<<< HEAD
      },
      metadata: page.metadata
    }))
  };
}

function mergeDocumentMetadata(pages: ConsolidationInputPage[]): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (const page of pages) {
    for (const [key, value] of Object.entries(page.metadata ?? {})) {
      if (!metadata[key] && value.trim()) {
        metadata[key] = value;
      }
    }
  }

  return metadata;
}
=======
      }
    }))
  };
}
>>>>>>> 6d414060f5b901795e0a0f23b51998d2bc638ed3
