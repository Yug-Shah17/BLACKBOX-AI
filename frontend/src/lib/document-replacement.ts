import type { DemoDocument, DocumentContext, RecordedRun } from "./api";

function words(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

export function documentReplacement(run: RecordedRun, step: number, context?: DocumentContext | null) {
  const retrieval = run.steps.find(item => item.stepType === "retrieval");
  const candidates = (run.steps.find(item => item.stepType === "selection")?.inputData?.documents ?? []) as DemoDocument[];
  const documents = context?.documents ?? candidates;
  const question = context?.question ?? String(retrieval?.inputData?.question ?? "");
  const keywords = new Set(words(question));
  const relevant = (document: DemoDocument) => ["word_count", "provided_documents"].includes(String(retrieval?.inputData?.operation)) || words(document.topic).some(word => keywords.has(word));
  if (step === 1) return { documentIds: documents.filter(relevant).map(document => document.documentId) };
  if (step === 2) {
    const ids = retrieval?.outputData?.documentIds;
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
