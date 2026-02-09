
export type LearningMode = 'beginner' | 'advanced';

export interface RepoInfo {
  owner: string;
  repo: string;
  full_name: string;
  description: string;
  html_url: string;
  default_branch: string;
}

export interface FileNode {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  content: string; // Markdown
  mermaidDiagram?: string;
  keyFiles: string[];
}

export interface Tutorial {
  repoName: string;
  description: string;
  chapters: Chapter[];
  highLevelArchitecture: string;
}

export interface TraceStep {
  step: number;
  component: string;
  action: string;
  explanation: string;
  file?: string;
}

export interface TraceResult {
  query: string;
  steps: TraceStep[];
  diagram: string;
}

export interface CodeExplanation {
  whatItDoes: string;
  whyItExists: string;
  dependencies: string[];
  breakageImpact: string;
}
