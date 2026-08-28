export interface FileTreeItem {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
}

// In-memory only, by design: generated site code is never written to disk.
// It lives only as long as this server process's memory, and the frontend
// explicitly clears it (via reset()) on every page load/refresh so a
// generated site never silently outlives the browser session.
let files = new Map<string, string>();

function normalizePath(rawPath: string): string {
  const cleaned = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = cleaned.split("/").filter((s) => s && s !== ".");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }

  return resolved.join("/");
}

export function reset(): void {
  files = new Map();
}

export function fileExists(rawPath: string): boolean {
  return files.has(normalizePath(rawPath));
}

export function readFile(rawPath: string): string {
  const content = files.get(normalizePath(rawPath));
  if (content === undefined) {
    throw new Error(`File not found: ${rawPath}`);
  }
  return content;
}

export function writeFile(rawPath: string, content: string): void {
  files.set(normalizePath(rawPath), content);
}

export function updateFile(
  rawPath: string,
  oldString: string,
  newString: string
): void {
  const content = readFile(rawPath);
  if (!content.includes(oldString)) {
    throw new Error("Old string not found in file");
  }
  files.set(normalizePath(rawPath), content.replace(oldString, newString));
}

export function deleteFile(rawPath: string): void {
  const path = normalizePath(rawPath);
  if (!files.has(path)) {
    throw new Error(`File not found: ${rawPath}`);
  }
  files.delete(path);
}

export function listFiles(
  dirPath: string = ""
): Array<{ name: string; type: "file" | "directory" }> {
  const prefix = normalizePath(dirPath);
  const seen = new Set<string>();
  const result: Array<{ name: string; type: "file" | "directory" }> = [];

  for (const filePath of files.keys()) {
    if (prefix && !filePath.startsWith(`${prefix}/`)) continue;

    const rest = prefix ? filePath.slice(prefix.length + 1) : filePath;
    const [first, ...remainder] = rest.split("/");
    if (!first || seen.has(first)) continue;

    seen.add(first);
    result.push({
      name: first,
      type: remainder.length > 0 ? "directory" : "file",
    });
  }

  return result;
}

export function listFilesTree(dirPath: string = ""): FileTreeItem[] {
  return listFiles(dirPath).map((entry) => {
    const entryPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

    if (entry.type === "directory") {
      return {
        name: entry.name,
        path: entryPath,
        type: "directory",
        children: listFilesTree(entryPath),
      };
    }

    return { name: entry.name, path: entryPath, type: "file" };
  });
}
