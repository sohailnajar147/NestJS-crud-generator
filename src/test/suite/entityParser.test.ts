import * as assert from "assert";
import { analyzeTypeormEntityFile } from "../../entityParserAst";
import { parseModelFromText } from "../../modelParser";

suite("entity parser (AST)", () => {
  test("handles multiline property type", () => {
    const text = `import { Entity, Column } from 'typeorm';

@Entity('widgets')
export class Widget {
  @Column()
  description:
    string;
  @Column()
  count: number;
}
`;
    const m = parseModelFromText(text);
    assert.strictEqual(m.className, "Widget");
    assert.strictEqual(m.collectionName, "widgets");
    const desc = m.properties.find((p) => p.name === "description");
    assert.ok(desc, "description property");
    assert.strictEqual(desc?.type, "string");
    assert.strictEqual(m.properties.find((p) => p.name === "count")?.type, "number");

    const view = analyzeTypeormEntityFile(text);
    assert.strictEqual(view.hasEntity, true);
    assert.ok(view.lines0.length >= 1);
    assert.strictEqual(view.lines0[0], 2);
  });
});
