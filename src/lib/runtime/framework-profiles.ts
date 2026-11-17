import type { FrameworkAdapterCapabilities, ProjectKind } from "@/lib/project/types";

export type FrameworkProfile = FrameworkAdapterCapabilities & {
  displayName: string;
  packageManagerFiles: string[];
  candidateCommands: string[];
  runtimeNotes: string[];
};

/**
 * Product-level support profiles. These describe planned adapter capabilities;
 * they do not assert that a given imported project is runnable or editable yet.
 */
export const FRAMEWORK_PROFILES: Record<ProjectKind, FrameworkProfile> = {
  static: {
    projectKind: "static",
    displayName: "HTML / CSS / JavaScript",
    packageManagerFiles: [],
    candidateCommands: [],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["External services and server APIs are not provided by static hosting."],
    runtimeNotes: ["Serve static files from the isolated preview origin."],
  },
  vite: {
    projectKind: "vite",
    displayName: "Vite",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["dev", "start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Actual source mapping depends on available dev metadata and the selected framework plugin."],
    runtimeNotes: ["Read the package scripts and verify the selected command before launch."],
  },
  next: {
    projectKind: "next",
    displayName: "Next.js",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["dev", "start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Server components, server actions and server-dependent routes require a Node-capable runtime; static rendering is not equivalent."],
    runtimeNotes: ["Use a Node-compatible isolated workspace and project-defined start script."],
  },
  react: {
    projectKind: "react",
    displayName: "React",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["dev", "start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Reliable component-level source mapping requires the matching bundler/plugin adapter."],
    runtimeNotes: ["Determine whether the React project uses Vite, another bundler or a custom start script."],
  },
  vue: {
    projectKind: "vue",
    displayName: "Vue",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["dev", "start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Template and scoped-style writes require Vue SFC-aware parsing."],
    runtimeNotes: ["Use Vue compiler metadata where available for template/source mapping."],
  },
  svelte: {
    projectKind: "svelte",
    displayName: "Svelte",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["dev", "start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Component and style writes require Svelte-aware parsing and source locations."],
    runtimeNotes: ["Support Svelte and SvelteKit as separate runtime profiles when detection is expanded."],
  },
  angular: {
    projectKind: "angular",
    displayName: "Angular",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: ["start"],
    canDetect: true,
    canRun: true,
    canMapElements: true,
    canEditStyles: true,
    canEditStructure: true,
    supportedOperations: ["text", "style", "gradient", "spacing", "resize", "reorder"],
    limitations: ["Template and component-style writes require Angular compiler metadata or parser-backed transforms."],
    runtimeNotes: ["Read angular.json and package scripts; do not assume the default serve target."],
  },
  unknown: {
    projectKind: "unknown",
    displayName: "Unknown project",
    packageManagerFiles: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    candidateCommands: [],
    canDetect: false,
    canRun: false,
    canMapElements: false,
    canEditStyles: false,
    canEditStructure: false,
    supportedOperations: [],
    limitations: ["Project type and run command require manual inspection."],
    runtimeNotes: ["Never execute an inferred command without explicit validation and isolation."],
  },
};

export function getFrameworkProfile(kind: ProjectKind): FrameworkProfile {
  return FRAMEWORK_PROFILES[kind];
}
