import * as assert from "assert";
import { tryParseModelFromAst } from "../../entityParserAst";

suite("entityParserAst (relations, enum, nullable)", () => {
  test("parses entity with relations, enum column, and optional fields", () => {
    const text = `import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Role } from './role.enum';

@Entity('profiles')
export class Profile {
  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ nullable: true })
  displayName?: string | null;

  @ManyToOne(() => Account, (a) => a.profiles)
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @OneToMany(() => Session, (s) => s.profile)
  sessions: Session[];
}
`;
    const m = tryParseModelFromAst(text);
    assert.ok(m, "AST path should parse");
    assert.strictEqual(m?.className, "Profile");
    assert.strictEqual(m?.collectionName, "profiles");
    const names = new Set(m?.properties.map((p) => p.name));
    assert.ok(names.has("role"), "enum column");
    assert.ok(names.has("displayName"), "nullable col");
    assert.ok(names.has("account"), "many-to-one");
    assert.ok(names.has("sessions"), "one-to-many");
    const role = m?.properties.find((p) => p.name === "role");
    assert.ok(
      role?.decorators.some((d) => d.includes("@Column")),
      "role has @Column",
    );
    const display = m?.properties.find((p) => p.name === "displayName");
    assert.strictEqual(display?.isOptional, true);
  });

  test("merges same-file base class properties for DTOs when includeInherited is true (default)", () => {
    const text = `import { Entity, Column, PrimaryColumn } from 'typeorm';

export abstract class TimeStamped {
  @Column({ name: 'createdAt' })
  createdAt: Date;
}

@Entity('items')
export class Item extends TimeStamped {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  title: string;
}
`;
    const m = tryParseModelFromAst(text, {
      includeInheritedEntityProperties: true,
    });
    assert.ok(m);
    const names = new Set(m?.properties.map((p) => p.name));
    assert.ok(names.has("createdAt"), "inherited from TimeStamped");
    assert.ok(names.has("id"));
    assert.ok(names.has("title"));
  });

  test("omits same-file base properties when includeInherited is false", () => {
    const text = `import { Entity, Column, PrimaryColumn } from 'typeorm';

class Base {
  @Column() inherited: string;
}

@Entity('items')
export class Item extends Base {
  @PrimaryColumn('uuid') id: string;
}
`;
    const m = tryParseModelFromAst(text, {
      includeInheritedEntityProperties: false,
    });
    assert.ok(m);
    const names = m?.properties.map((p) => p.name) ?? [];
    assert.ok(!names.includes("inherited"), "not merged");
    assert.ok(names.includes("id"));
  });
});
