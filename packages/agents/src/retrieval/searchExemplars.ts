import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type ExemplarType = "开头钩子" | "主角亮相" | "高张力对白" | "结尾余韵";

export interface Exemplar {
  id: string;
  title: string;
  type: ExemplarType;
  tags: string[];
  text: string;
}

let cache: Exemplar[] | undefined;

function loadExemplars(): Exemplar[] {
  if (!cache) {
    const path = fileURLToPath(new URL("../../resources/exemplars.json", import.meta.url));
    try {
      cache = JSON.parse(readFileSync(path, "utf8")) as Exemplar[];
    } catch {
      cache = []; // 语料库缺失时降级为无范文，不阻塞写作
    }
  }
  return cache;
}

/** 按标签交集排序检索范文摘录；tags 为空时按类型随机采样 */
export function searchExemplars(options: {
  type?: ExemplarType;
  tags?: string[];
  limit?: number;
}): Exemplar[] {
  const { type, tags = [], limit = 3 } = options;
  const candidates = loadExemplars().filter(
    (exemplar) => !type || exemplar.type === type,
  );

  if (tags.length === 0) {
    return candidates.slice(0, limit);
  }

  return candidates
    .map((exemplar) => ({
      exemplar,
      hits: exemplar.tags.filter((tag) => tags.includes(tag)).length,
    }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((entry) => entry.exemplar);
}

export function listExemplarTags(): string[] {
  return [...new Set(loadExemplars().flatMap((exemplar) => exemplar.tags))].sort();
}
