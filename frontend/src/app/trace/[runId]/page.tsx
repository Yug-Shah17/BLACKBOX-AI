import TraceWorkspace from "@/components/workspace/trace";
export default async function TracePage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <TraceWorkspace key={runId} runId={runId} />;
}
