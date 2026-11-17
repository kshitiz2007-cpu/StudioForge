export type ProjectKind = "static" | "vite" | "next" | "react" | "vue" | "svelte" | "angular" | "unknown";

export type ProjectFile = {
  path: string;
  size: number;
  mimeType: string;
};

export type ProjectManifest = {
  id: string;
  name: string;
  kind: ProjectKind;
  entrypoint: string | null;
  files: ProjectFile[];
  importedAt: string;
};

export type RuntimeStatus = "not_configured" | "provisioning" | "installing" | "starting" | "running" | "stopped" | "error";

export type VisualElementRole = "section" | "container" | "card" | "text" | "heading" | "image" | "button" | "link" | "input" | "list" | "other";

export type ResponsiveBreakpoint = "base" | "desktop" | "tablet" | "mobile";

export type VisualElementRef = {
  elementId: string;
  selector: string;
  tagName: string;
  role: VisualElementRole;
  textPreview?: string;
  classNames: string[];
  parentElementId?: string;
  bounds: { x: number; y: number; width: number; height: number };
  computed: Record<string, string>;
  source?: { filePath: string; adapter: string; confidence: number; startOffset?: number; endOffset?: number };
};

export type GradientStop = {
  color: string;
  position: number;
};

export type VisualPropertyValue =
  | { kind: "text"; value: string }
  | { kind: "length"; value: number; unit: "px" | "%" | "rem" | "em" | "vw" | "vh" | "auto" }
  | { kind: "color"; value: string }
  | { kind: "gradient"; angle: number; stops: GradientStop[] }
  | { kind: "keyword"; value: string }
  | { kind: "number"; value: number };

export type VisualEditOperation =
  | { type: "set-style"; target: VisualElementRef; property: string; value: VisualPropertyValue; breakpoint: ResponsiveBreakpoint }
  | { type: "set-text"; target: VisualElementRef; value: string }
  | { type: "move"; target: VisualElementRef; parent?: VisualElementRef; beforeElementId?: string; x?: number; y?: number; breakpoint: ResponsiveBreakpoint }
  | { type: "resize"; target: VisualElementRef; width?: VisualPropertyValue; height?: VisualPropertyValue; breakpoint: ResponsiveBreakpoint };

export type VisualEditStatus = "preview-only" | "mapped" | "persisted" | "needs-review" | "unsupported" | "failed";

export type VisualEditRecord = {
  id: string;
  projectId: string;
  operation: VisualEditOperation;
  previousValue?: VisualPropertyValue | string;
  status: VisualEditStatus;
  sourceFiles: string[];
  message?: string;
  createdAt: string;
};

export type FrameworkAdapterCapabilities = {
  projectKind: ProjectKind;
  canDetect: boolean;
  canRun: boolean;
  canMapElements: boolean;
  canEditStyles: boolean;
  canEditStructure: boolean;
  supportedOperations: string[];
  limitations: string[];
};

export type PreviewBridgeMessage =
  | { protocol: "studioforge.preview.v1"; type: "ready"; sessionId: string }
  | { protocol: "studioforge.preview.v1"; type: "element-selected"; sessionId: string; element: VisualElementRef }
  | { protocol: "studioforge.preview.v1"; type: "element-hovered"; sessionId: string; element: VisualElementRef | null }
  | { protocol: "studioforge.preview.v1"; type: "viewport"; sessionId: string; width: number; height: number }
  | { protocol: "studioforge.preview.v1"; type: "operation-result"; sessionId: string; operationId: string; success: boolean; message?: string };
