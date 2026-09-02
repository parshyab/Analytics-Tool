export type FigmaApiComponent = {
  key: string;
  file_key: string;
  node_id: string;
  name: string;
  description: string;
  containing_frame?: { name?: string };
  component_set_id?: string;
};

export type FigmaApiStyle = {
  key: string;
  file_key: string;
  node_id: string;
  name: string;
  description: string;
  style_type: "FILL" | "TEXT" | "EFFECT" | "GRID";
};

export type FigmaApiVariable = {
  id: string;
  key: string;
  name: string;
  resolvedType: string;
  variableCollectionId: string;
};

export class FigmaLibraryClient {
  constructor(private token: string) {}

  private async request<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Figma API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async fetchFileComponents(fileKey: string): Promise<FigmaApiComponent[]> {
    const data = await this.request<{ meta?: { components?: Record<string, FigmaApiComponent> } }>(
      `https://api.figma.com/v1/files/${fileKey}/components`
    );
    return Object.values(data.meta?.components ?? {});
  }

  async fetchFileStyles(fileKey: string): Promise<FigmaApiStyle[]> {
    const data = await this.request<{ meta?: { styles?: Record<string, FigmaApiStyle> } }>(
      `https://api.figma.com/v1/files/${fileKey}/styles`
    );
    return Object.values(data.meta?.styles ?? {});
  }

  async fetchFileVariables(fileKey: string): Promise<{
    variables: FigmaApiVariable[];
    collections: Record<string, { name: string }>;
  }> {
    try {
      const data = await this.request<{
        meta?: {
          variables?: Record<string, FigmaApiVariable>;
          variableCollections?: Record<string, { name: string }>;
        };
      }>(`https://api.figma.com/v1/files/${fileKey}/variables/local`);
      return {
        variables: Object.values(data.meta?.variables ?? {}),
        collections: data.meta?.variableCollections ?? {},
      };
    } catch {
      return { variables: [], collections: {} };
    }
  }
}
