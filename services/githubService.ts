
import { RepoInfo, FileNode } from '../types';

export const parseGithubUrl = (url: string) => {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
};

export const fetchRepoInfo = async (owner: string, repo: string): Promise<RepoInfo> => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!response.ok) throw new Error('Failed to fetch repository information. It might be private or non-existent.');
  return response.json();
};

export const fetchRepoTree = async (owner: string, repo: string, branch: string = 'main'): Promise<FileNode[]> => {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url);
  
  if (!response.ok) {
     if (branch === 'main') {
       return fetchRepoTree(owner, repo, 'master');
     }
     throw new Error(`Failed to fetch repository tree for branch: ${branch}`);
  }
  
  const data = await response.json();
  return data.tree;
};

/**
 * Tries to find the actual path in the tree that best matches a suggested path.
 * Handles case-insensitivity, missing extensions, and filename-only matches.
 */
export const resolveActualPath = (suggestedPath: string, tree: FileNode[]): string | null => {
  if (!suggestedPath || !tree.length) return null;

  const normalizedSuggested = suggestedPath.toLowerCase().trim();
  const pathParts = suggestedPath.split('/');
  const fileNameOnly = pathParts[pathParts.length - 1].toLowerCase();

  // 1. Exact match (case insensitive)
  const exact = tree.find(n => n.path.toLowerCase() === normalizedSuggested && n.type === 'blob');
  if (exact) return exact.path;

  // 2. Direct filename match (ignoring directories)
  const fileOnlyMatch = tree.find(n => {
    const parts = n.path.toLowerCase().split('/');
    return parts[parts.length - 1] === fileNameOnly && n.type === 'blob';
  });
  if (fileOnlyMatch) return fileOnlyMatch.path;

  // 3. Filename with common extensions
  const extensions = ['', '.py', '.js', '.ts', '.md', '.html', '.css', '.json', '.txt', '.cpp', '.h', '.java', '.go', '.tsx', '.jsx'];
  for (const ext of extensions) {
    const target = (fileNameOnly.includes('.') ? fileNameOnly : fileNameOnly + ext).toLowerCase();
    const match = tree.find(n => {
      const parts = n.path.toLowerCase().split('/');
      return parts[parts.length - 1] === target && n.type === 'blob';
    });
    if (match) return match.path;
  }

  // 4. Deep path suffix match (e.g. docs/passes/01-lower.md matches compiler/packages/.../docs/passes/01-lower.md)
  if (pathParts.length > 1) {
    const suffix = pathParts.slice(-2).join('/').toLowerCase();
    const suffixMatch = tree.find(n => n.path.toLowerCase().endsWith(suffix) && n.type === 'blob');
    if (suffixMatch) return suffixMatch.path;
  }

  // 5. Partial filename match (at least 4 characters)
  if (fileNameOnly.length >= 4) {
    const partial = tree.find(n => n.path.toLowerCase().includes(fileNameOnly) && n.type === 'blob');
    if (partial) return partial.path;
  }

  return null;
};

/**
 * Decodes a base64 string to a UTF-8 string reliably.
 */
const decodeBase64 = (str: string) => {
  try {
    const binary = atob(str.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error("Base64 decode failed", e);
    return atob(str.replace(/\s/g, ''));
  }
};

export const fetchFileContent = async (owner: string, repo: string, path: string, branch?: string): Promise<string> => {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
  if (branch) {
    url.searchParams.set('ref', branch);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`File not found: ${path}. The AI might have suggested a file that doesn't exist or is in a different location.`);
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error(`Failed to fetch file: ${path} (Status: ${response.status})`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    throw new Error(`'${path}' is a directory, not a file.`);
  }
  if (!data.content) {
    throw new Error(`No content found for file: ${path}`);
  }
  return decodeBase64(data.content);
};
