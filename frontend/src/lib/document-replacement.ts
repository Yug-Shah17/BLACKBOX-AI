import type { DemoDocument, DocumentContext, RecordedRun } from "./api";

function words(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

const stopWords = new Set("a an and are as at be can do does for from how i in is it my of on or should the there to what when where who with".split(" "));
function tokens(value: string): Set<string> {
  return new Set(words(value.replaceAll("ß", "ss").replaceAll("ẞ", "ss")).map(word => word.replaceAll("ς", "σ")).filter(word => !stopWords.has(word)));
}
function score(question: string, document: DemoDocument): number {
  const query = tokens(question);
  const overlap = (value: string) => [...tokens(value)].filter(word => query.has(word)).length;
  return 2 * overlap(`${document.title ?? ""} ${document.topic}`) + overlap(document.text);
}

export function documentReplacement(run: RecordedRun, step: number, context?: DocumentContext | null) {
  const retrieval = run.steps.find(item => item.stepType === "retrieval");
  const candidates = (run.steps.find(item => item.stepType === "selection")?.inputData?.documents ?? []) as DemoDocument[];
  const documents = context?.documents ?? candidates;
  const question = context?.question ?? String(retrieval?.inputData?.question ?? "");
  const keywords = new Set(words(question));
  const ranked = run.schemaVersion === "document-qa-v3" && !["word_count", "provided_documents"].includes(String(retrieval?.inputData?.operation));
  const relevant = (document: DemoDocument) => ["word_count", "provided_documents"].includes(String(retrieval?.inputData?.operation)) || words(document.topic).some(word => keywords.has(word));
  if (step === 1) return { documentIds: ranked
    ? documents.map(document => ({ document, score: score(question, document) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.document.documentId)
    : documents.filter(relevant).map(document => document.documentId) };
  if (step === 2) {
    const ids = retrieval?.outputData?.documentIds;
    if (ranked) {
      const retrieved = Array.isArray(ids) ? ids.flatMap(id => documents.find(document => document.documentId === id) ?? []) : candidates;
      return { documentId: retrieved.find(document => document.current)?.documentId ?? "" };
    }
    const retrieved = Array.isArray(ids) ? documents.filter(document => ids.includes(document.documentId)) : candidates;
    return { documentId: retrieved.find(document => document.current && relevant(document))?.documentId ?? "" };
  }
  const generation = run.steps.find(item => item.stepType === "generation");
  const selected = generation?.inputData?.document as DemoDocument | null | undefined;
  const expected = generation?.inputData?.expectedAnswer;
  const evidence = generation?.inputData?.answerEvidence as { quotes?: unknown[] } | undefined;
  const quote = evidence?.quotes?.find(value => typeof value === "string" && selected?.text.includes(value));
  return { answer: typeof expected === "string" ? expected : typeof quote === "string" ? quote : selected?.text ?? "", citation: selected?.documentId ?? "" };
}
