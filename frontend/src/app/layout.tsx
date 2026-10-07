import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import WorkspaceShell from "@/components/workspace/shell";
import "./globals.css";
import "./identity.css";
import "./premium.css";


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Black Box | Document Answers, Execution Traces & Replay",
  description:
    "Ask questions from your documents, inspect execution evidence, and test manual corrections with checkpoint replay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"><body><WorkspaceShell>{children}</WorkspaceShell></body>
    </html>
  );
}
