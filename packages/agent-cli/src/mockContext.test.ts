import {
  createMockContextRepository,
  parseArgs,
} from "./mockContext.js";

const options = parseArgs([
  "write",
  "--mock-context",
  "--novel-id=novel-cli",
  "--novel-title=雾都回声",
  "--genre=都市异能",
  "--novel-hook=主角能听见城市里死者留下的回声。",
  "--chapter-no=3",
  "--chapter-title=地铁里的第二声",
  "--chapter-objective=主角确认第二个回声来自同一名凶手。",
  "--chapter-hook=他听见自己的名字从隧道深处传来。",
  "--previous-summary=主角第一次发现回声不是幻觉。",
  "--next-objective=主角追查地铁站旧案。",
  "--canon-fact=主角已经听见过第一段死者回声。",
  "--canon-fact=回声只能在案发地点附近出现。",
  "--world-rule=回声不会直接说出凶手姓名。",
  "--style-guidance=短段落，冷硬，动作优先。",
  "--forbidden-expression=命运的齿轮开始转动",
  "--target-words=2200",
]);

assertEqual(options.mockContext, true);
assertEqual(options.mock, false);
assertEqual(options.novelTitle, "雾都回声");
assertEqual(options.canonFacts.length, 2);
assertEqual(options.worldRules[0], "回声不会直接说出凶手姓名。");

const repository = createMockContextRepository(options);
const assets = repository.assembleChapterProductionContext({
  novelId: "novel-cli",
  chapterNo: 3,
  authorIntent: "这一章要更悬疑。",
});

assertEqual(assets.novel.title, "雾都回声");
assertEqual(assets.chapterNo, 3);
assertEqual(assets.chapterPlan?.title, "地铁里的第二声");
assertEqual(assets.context.previousChapterSummary, "主角第一次发现回声不是幻觉。");
assertEqual(assets.context.canonFacts?.length, 2);
assertEqual(assets.context.ragSnippets?.[0], "作者本章想法：这一章要更悬疑。");
assertEqual(assets.sourceRefs.some((ref) => ref.id === "mock-context:cli"), true);

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
