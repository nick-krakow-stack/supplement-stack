export type KnowledgeMagazineContractHashes = {
  renderer_style_hash: string;
  fixture_hash: string;
  route_fingerprint: string;
  route_fingerprint_parts: {
    schema: 'knowledge_magazine_route_fingerprint_parts.v2';
    files: Array<{ path: string; byte_hash: string }>;
    resolved_versions: Record<string, string>;
  };
  fixture: {
    schema: string;
    route: string;
    article: {
      slug: string;
      title: string;
      summary: string;
      body: string;
      reviewed_at: string | null;
      published_at: string | null;
      modified_at: string | null;
      featured_image_url: string | null;
      featured_image_r2_key: string | null;
      created_at: string;
      updated_at: string;
      sources: Array<{ source_id: string; label: string; url: string }>;
      ingredients: Array<{ ingredient_id: number; name: string; sort_order?: number }>;
      [key: string]: unknown;
    };
    expected: {
      food_headers: string[];
      food_rows: string[][];
      release_projection: {
        sections: Array<{
          assets: Array<{ src: string; alt: string; caption: string }>;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
};

export function sha256Bytes(bytes: Uint8Array): string;
export function canonicalJsonHash(value: unknown): string;
export function listKnowledgeMagazineRouteFiles(options?: { root?: string }): Promise<string[]>;
export function computeKnowledgeMagazineContractHashes(options?: { root?: string }): Promise<KnowledgeMagazineContractHashes>;
