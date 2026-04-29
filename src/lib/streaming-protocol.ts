/**
 * Sentinel that separates streamed model text from a JSON-encoded
 * `EducationResponse` tail emitted at the end of a streaming request.
 */
export const STRUCTURED_TAIL_SENTINEL = "\n\n<<<__GPAI_STRUCTURED__>>>\n";
