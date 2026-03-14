import path from 'node:path';

import type {
  RepoScaffoldFileLayout,
  RepositoryScaffoldBundle,
} from './repo-scaffold-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

export function normalizeDirectoryList(directories: string[]): string[] {
  return uniqueSorted(
    directories
      .map(normalizePath)
      .filter((directory) => directory.length > 0)
      .map((directory) => directory.replace(/\/+$/, '')),
  );
}

export function normalizeFileList(files: string[]): string[] {
  return uniqueSorted(
    files
      .map(normalizePath)
      .filter((file) => file.length > 0)
      .map((file) => file.replace(/^\/+/, '')),
  );
}

export function deriveDirectoriesFromFiles(files: string[]): string[] {
  return uniqueSorted(
    normalizeFileList(files).map((file) => {
      const directory = path.posix.dirname(file);
      return directory === '.' ? '' : directory;
    }).filter((directory) => directory.length > 0),
  );
}

export function buildRepoScaffoldFileLayout(bundle: RepositoryScaffoldBundle): RepoScaffoldFileLayout {
  const files = normalizeFileList(bundle.files);
  const declaredDirectories = normalizeDirectoryList(bundle.directories);
  const derivedDirectories = deriveDirectoriesFromFiles(files);
  const allDirectories = uniqueSorted([...declaredDirectories, ...derivedDirectories]);

  const fileToDirectory = files.map((file) => {
    const directory = path.posix.dirname(file);
    return {
      file,
      directory: directory === '.' ? '' : directory,
    };
  });

  return {
    bundleId: bundle.bundleId,
    repoTarget: normalizePath(bundle.repoTarget),
    declaredDirectories,
    derivedDirectories,
    allDirectories,
    files,
    fileToDirectory,
  };
}
