/**
 * Provider-agnostic AI interface. The rest of the server only talks to this,
 * so the multimodal provider can be swapped without touching routes.
 */

export type Part = { text: string } | { image: { mime: string; base64: string } };

export interface GenerateJSONRequest {
  system: string;
  parts: Part[];
  /** JSON Schema the provider should constrain output to. Output is ALWAYS re-validated by the caller. */
  schema: object;
  temperature?: number;
  maxOutputTokens?: number;
}

export type ProviderErrorKind = 'not_configured' | 'auth' | 'quota' | 'unavailable' | 'timeout' | 'blocked' | 'bad_output' | 'bad_request';

export class ProviderError extends Error {
  constructor(public kind: ProviderErrorKind, message: string, public status?: number) {
    super(message);
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly configured: boolean;
  /** Returns the parsed JSON object produced by the model (unvalidated). */
  generateJSON(req: GenerateJSONRequest): Promise<unknown>;
  /** Cheap real call that proves the key + model work. */
  probe(): Promise<void>;
}
