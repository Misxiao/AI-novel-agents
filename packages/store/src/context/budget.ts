/** 在段落边界截取文本尾部，保留约 maxChars 个字符 */
export function tailAtParagraph(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const tail = text.slice(-maxChars);
  const paragraphStart = tail.indexOf("\n\n");
  const cut = paragraphStart >= 0 ? tail.slice(paragraphStart + 2) : tail;
  return `（前文已截断）\n${cut}`;
}

/** 从列表尾部逐项裁剪，使各项内容总字数不超过 maxChars；保序返回 */
export function trimListToBudget<T>(
  items: T[],
  sizeOf: (item: T) => number,
  maxChars: number,
): T[] {
  let total = items.reduce((sum, item) => sum + sizeOf(item), 0);
  const result = [...items];
  while (result.length > 0 && total > maxChars) {
    const removed = result.shift()!;
    total -= sizeOf(removed);
  }
  return result;
}
