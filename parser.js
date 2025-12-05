export function parseMarkup(markup) {
  const entities = [];
  const relationships = [];
  const generalizations = [];

  const lines = markup
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

  let i = 0;

  function parseEntityHeader(line) {
    const m = line.match(/^Entity\s+("?[\wА-Яа-я0-9_]+"?)\s*\{\s*$/);
    return m ? m[1].replace(/^"|"$/g, "") : null;
  }

  function parseGeneralizationHeader(line) {
    const m = line.match(/^Generalization\s+("?[\wА-Яа-я0-9_]+"?)\s*\{\s*$/);
    return m ? m[1].replace(/^"|"$/g, "") : null;
  }

  function parseAttribute(line) {
    const attrRE =
      /^([*]?)([+?]?)([\wА-Яа-я0-9_]+)\s*:\s*([\wА-Яа-я0-9_]+)(?:\s*FK\s*->\s*([\wА-Яа-я0-9_]+)\.([\wА-Яа-я0-9_]+)\s*(?::\s*"(.*)")?)?$/;

    const m = line.match(attrRE);
    if (!m) return null;

    let [, many, mod, name, type, fkEntity, fkAttr, relName] = m;

    return {
      many: many !== "*",
      name,
      type,
      optional: mod === "?",
      isPK: mod === "+",
      isFK: !!fkEntity,
      fkTarget: fkEntity
        ? { entity: fkEntity, attribute: fkAttr, relName: relName || null }
        : null,
    };
  }

  while (i < lines.length) {
    let line = lines[i];

    // ----------- ENTITY ----------
    let entityName = parseEntityHeader(line);
    if (entityName) {
      i++;
      let pk = [];
      let attrs = [];

      while (i < lines.length && !lines[i].startsWith("}")) {
        const attr = parseAttribute(lines[i]);
        if (!attr) throw new Error("Invalid attribute: " + lines[i]);

        if (attr.isPK) pk.push(attr);
        else attrs.push(attr);

        i++;
      }
      i++; // skip closing }

      entities.push({
        name: entityName,
        pk,
        attrs,
        weak: false,
        div: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });

      continue;
    }

    // ---------- RELATIONSHIP ----------
    let relMatch = line.match(
      /^Relationship\s+([\wА-Яа-я0-9_]+)\.([\wА-Яа-я0-9_]+)\s*->\s*([\wА-Яа-я0-9_]+)\.([\wА-Яа-я0-9_]+)\s*(?::\s*"(.*)")?$/,
    );
    if (relMatch) {
      const [, sEnt, sAttr, tEnt, tAttr, relName] = relMatch;
      relationships.push({
        source: { entity: sEnt, attribute: sAttr, relName: relName },
        target: { entity: tEnt, attribute: tAttr, relName: relName },
      });
      i++;
      continue;
    }

    // ---------- GENERALIZATION ----------
    let genName = parseGeneralizationHeader(line);
    if (genName) {
      i++;
      let categories = [];

      while (i < lines.length && !lines[i].startsWith("}")) {
        categories.push(lines[i]);
        i++;
      }

      // next line: complete discriminator=Role
      const tail = lines[i] || "";
      const complete = tail.includes("complete");
      const m = tail.match(/discriminator\s*=\s*([\wА-Яа-я0-9_]+)/);
      const discriminator = m ? m[1] : null;

      generalizations.push({
        generic: genName,
        categories,
        discriminator,
        complete,
        symbol: null,
      });

      i++;
      continue;
    }

    throw new Error("Unknown syntax: " + line);
  }

  // auto-generate relationships from FK attributes
  for (const e of entities) {
    for (const a of [...e.pk, ...e.attrs]) {
      if (a.isFK && a.fkTarget) {
        relationships.push({
          source: {
            entity: e.name,
            attribute: a.name,
            relName: a.fkTarget.relName,
          },
          target: {
            entity: a.fkTarget.entity,
            attribute: a.fkTarget.attribute,
            relName: a.fkTarget.relName,
          },
        });
      }
    }
  }

  return { entities, relationships, generalizations };
}
