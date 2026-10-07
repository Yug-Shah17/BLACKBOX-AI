import type { DemoDocument } from "./api.ts";

export async function readDocuments(files: File[], signal?: AbortSignal): Promise<DemoDocument[]> {
  signal?.throwIfAborted();
  if (!files.length || files.length > 10) throw new Error("Choose between 1 and 10 documents.");
  for (const file of files) {
    if (!/\.(txt|md|pdf|docx)$/i.test(file.name)) throw new Error(`${file.name}: supported files are .txt, .md, .pdf, and .docx; legacy .doc is unsupported.`);
    const binary = /\.(pdf|docx)$/i.test(file.name);
    if (file.size > (binary ? 2000000 : 40000)) throw new Error(`${file.name}: maximum file size is ${binary ? "2 MB" : "40 KB"}.`);
    if (file.name.length > 200) throw new Error("Filenames must be at most 200 characters.");
  }
  const documents: DemoDocument[] = [];
  // Process parsers sequentially to respect the local extraction concurrency limit.
  for (const file of files) {
    signal?.throwIfAborted();
    if (/\.(pdf|docx)$/i.test(file.name)) {
      const requestSignal = AbortSignal.any([AbortSignal.timeout(20000), ...(signal ? [signal] : [])]);
      let response: Response;
      try {
        response = await fetch(`/api/blackbox/document-import?filename=${encodeURIComponent(file.name)}`, {
          method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file, signal: requestSignal });
      } catch (error) {
        signal?.throwIfAborted();
        if (requestSignal.aborted) throw new Error(`${file.name}: extraction request timed out. Please try again.`);
        throw new Error(`${file.name}: could not reach the local extractor. Please try again.`, { cause: error });
      }
      const data = await response.json().catch(() => ({ detail: `Extraction failed (${response.status}).` }));
      signal?.throwIfAborted();
      if (!response.ok) throw new Error(`${file.name}: ${typeof data.detail === "string" ? data.detail : "Could not extract document."}`);
      if (!data || typeof data !== "object" ||
        !["documentId", "title", "topic", "text"].every(key => typeof data[key] === "string" && data[key].trim()) ||
        data.documentId.length > 100 || data.title.length > 200 || data.topic.length > 200 || data.text.length > 10000 || typeof data.current !== "boolean") {
        throw new Error(`${file.name}: invalid extraction response. Please try again.`);
      }
      documents.push(data as DemoDocument);
      continue;
    }
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()).trim(); }
    catch { throw new Error(`${file.name}: could not read UTF-8 text.`); }
    signal?.throwIfAborted();
    if (!text || text.length > 10000) throw new Error(`${file.name}: content must contain 1 to 10,000 characters.`);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error(`${file.name}: binary content is not supported.`);
    documents.push({ documentId: `upload-${crypto.randomUUID()}`, title: file.name,
      topic: `${file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ")} ${text}`.slice(0, 200), text, current: true });
  }
  return documents;
}
