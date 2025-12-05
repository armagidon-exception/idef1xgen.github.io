import { toPx, div, span } from "utils.js";
const WEAK_ENTITY_CLASS = "weak-entity";
const STRONG_ENTITY_CLASS = "strong-entity";
const ENTITY_NAME_CLASS = "entity-name";

function createEntityBox({ weak, x, y, name }) {
  const container = div()
    .withStyles({ left: toPx(x), right: toPx(y) })
    .withClasses(
      "entity-container",
      weak ? WEAK_ENTITY_CLASS : STRONG_ENTITY_CLASS,
    )
    .withChild(div().withClass(ENTITY_NAME_CLASS).withText(name));

  return container;
}

function createAttribute({ name, optional, type }) {
  return div()
    .withClasses("attribute", optional ? "optional" : "")
    .withChild(span().withText(name + (optional ? " (O)" : "")))
    .withChild(span().withClass("attribute-type").withText(`: ${type}`));
}

function createPkAttribute({ name, type }) {
  return div()
    .withClass("pk-attribute")
    .withChild(document.createElement("span").withClass("pk").withText(name))
    .withChild(
      document
        .createElement("span")
        .withClass("attribute-type")
        .withText(` : ${type}`),
    );
}

export function renderDiagram({ entities, relationships, generalizations }) {
  const diagramArea = document.getElementById("diagram-area");
  const connections = document.getElementById("connections");

  diagramArea.innerHTML = "";
  connections.innerHTML = "";

  // Рендерим сущности
  entities.forEach((entity) => {
    // Создаем контейнер для сущности

    const entityBox = createEntityBox(entity);
    const entityContents = div().withClass("entity-box");
    entityBox.appendChild(entityContents);
    const pkSection = div().withClass("pk-section");
    const attrsSection = div().withClass("attributes-section");

    for (const pk of entity.pk) {
      pkSection.appendChild(createPkAttribute(pk));
    }

    entityContents.appendChild(pkSection);

    // Разделительная линия (без точек)
    if (entity.pk.length > 0 || entity.attrs.length > 0) {
      entityContents.appendChild(div().withClass("separator"));
    }

    for (const attr of entity.attrs) {
      attrsSection.appendChild(createAttribute(attr));
    }

    entityContents.appendChild(attrsSection);

    diagramArea.appendChild(entityBox);

    entity.div = entityBox;

    return connections;
  });

  drawConnections({ entities, relationships, generalizations });
  drawGeneralizations({ entities, relationships, generalizations });
}

function drawConnections({ entities, relationships, generalizations }) {
  const svg = document.getElementById("connections");
  relationships.forEach((rel) => {
    const sourceEntity = entities.find((e) => e.name === rel.source.entity);
    const targetEntity = entities.find((e) => e.name === rel.target.entity);

    if (
      !sourceEntity ||
      !targetEntity ||
      !sourceEntity.div ||
      !targetEntity.div
    )
      throw new Error("Одной из сущностей не хватает");

    // Получаем точки соединения на границах сущностей
    const sourcePoint = getConnectionPoint(sourceEntity, targetEntity);
    const targetPoint = getConnectionPoint(targetEntity, sourceEntity);

    // Проверяем на NaN значения
    if (
      isNaN(sourcePoint.x) ||
      isNaN(sourcePoint.y) ||
      isNaN(targetPoint.x) ||
      isNaN(targetPoint.y)
    ) {
      throw new Error("Invalid connection points:", sourcePoint, targetPoint);
    }

    // Определяем тип связи (идентифицирующая/неидентифицирующая)
    const isIdentifying = targetEntity.pk.some(
      (pk) =>
        pk.isFK &&
        pk.fkTarget &&
        pk.fkTarget.entity === sourceEntity.name &&
        pk.fkTarget.attribute === rel.source.attribute,
    );

    const pathInfo = drawLine(sourcePoint, targetPoint, isIdentifying);

    // Добавляем символы кардинальности у целевой стороны (и при желании — у исходной)
    const sourceAttr = sourceEntity.attrs.find(
      (e) => e.name == rel.source.attribute,
    );
    drawRelationshipSymbols(
      targetPoint,
      sourcePoint,
      sourceAttr.optional,
      sourceAttr.many,
      isIdentifying,
    );

    if (pathInfo && pathInfo.mid) {
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      label.setAttribute("x", pathInfo.mid.x);
      label.setAttribute("y", pathInfo.mid.y - 12);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "11");
      label.setAttribute("class", "relationship-center-label");
      label.setAttribute("pointer-events", "none");
      label.textContent =
        rel.source.relName ||
        `${rel.source.attribute} →  ${rel.target.attribute}`;
      svg.appendChild(label);
    }
  });
}

function getConnectionPoint(fromEntity, toEntity) {
  const fromRect = fromEntity.div.getBoundingClientRect();
  const toRect = toEntity.div.getBoundingClientRect();
  const diagramArea = document.getElementById("diagram-area");
  const diagramRect = diagramArea.getBoundingClientRect();

  const fromCenterX = fromRect.left + fromRect.width / 2 - diagramRect.left;
  const fromCenterY = fromRect.top + fromRect.height / 2 - diagramRect.top;
  const toCenterX = toRect.left + toRect.width / 2 - diagramRect.left;
  const toCenterY = toRect.top + toRect.height / 2 - diagramRect.top;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  let pointX, pointY;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Горизонтальное направление преобладает
    pointX = fromCenterX + (dx > 0 ? fromRect.width / 2 : -fromRect.width / 2);
    pointY = fromCenterY + (fromRect.height / 2) * (dy / Math.abs(dx));
  } else {
    // Вертикальное направление преобладает
    pointY =
      fromCenterY + (dy > 0 ? fromRect.height / 2 : -fromRect.height / 2);
    pointX = fromCenterX + (fromRect.width / 2) * (dx / Math.abs(dy));
  }

  // Корректируем для получения точки на границе
  const borderOffset = 1;
  if (Math.abs(dx) > Math.abs(dy)) {
    pointX += dx > 0 ? -borderOffset : borderOffset;
  } else {
    pointY += dy > 0 ? -borderOffset : borderOffset;
  }

  return { x: pointX, y: pointY };
}

function drawLine(startPoint, endPoint, isIdentifying) {
  // Рисуем ортогональную линию и возвращаем точку посередине для подписи
  const svg = document.getElementById("connections");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  let d;
  let mid = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };

  if (Math.abs(dx) > Math.abs(dy)) {
    // Горизонтальное преобладает
    const midX = startPoint.x + dx / 2;
    d = `M ${startPoint.x} ${startPoint.y} H ${midX} V ${endPoint.y} H ${endPoint.x}`;
    mid = { x: midX, y: (startPoint.y + endPoint.y) / 2 };
  } else {
    // Вертикальное преобладает
    const midY = startPoint.y + dy / 2;
    d = `M ${startPoint.x} ${startPoint.y} V ${midY} H ${endPoint.x} V ${endPoint.y}`;
    mid = { x: (startPoint.x + endPoint.x) / 2, y: midY };
  }

  path.setAttribute("d", d);
  path.setAttribute(
    "class",
    `relationship-line ${isIdentifying ? "identifying-line" : "non-identifying-line"}`,
  );
  path.setAttribute("fill", "none");
  path.setAttribute("pointer-events", "none");

  svg.appendChild(path);

  return { path, mid };
}

function drawRelationshipSymbols(
  targetPoint,
  sourcePoint,
  optional,
  many,
  isIdentifying,
) {
  // Добавляем обозначение кардинальности рядом с точкой (не поверх)
  const svg = document.getElementById("connections");
  let offsetX;
  let offsetY;

  let dx = targetPoint.x - sourcePoint.x;
  let dy = targetPoint.y - sourcePoint.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    dx = dx / Math.abs(dx);
    offsetX = 8
    offsetY = 16
    offsetX *= -dx;
  } else {
    offsetX = 16
    offsetY = 8
    dy = dy / Math.abs(dy);
    offsetY *= -dy;
  }

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", targetPoint.x + offsetX);
  text.setAttribute("y", targetPoint.y + offsetY);
  text.setAttribute("class", "cardinality-label");
  text.setAttribute("font-size", "11");
  text.setAttribute("pointer-events", "none");
  if (!optional && !many) {
    text.textContent = "";
  } else if (!optional && many) {
    text.textContent = "P";
  } else if (optional && !many) {
    text.textContent = "Z";
  } else if (optional && many) {
    text.textContent = "";
  }

  if (optional || many) {
    const dot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    dot.setAttribute("cx", targetPoint.x);
    dot.setAttribute("cy", targetPoint.y);
    dot.setAttribute("r", 4);
    dot.setAttribute("class", "cardinality-dot");
    dot.setAttribute("pointer-events", "none");
    svg.appendChild(dot);
    svg.appendChild(text);
  }

  if (optional && !isIdentifying) {
    const rhombus = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    rhombus.setAttribute("x", sourcePoint.x);
    rhombus.setAttribute("y", sourcePoint.y);
    rhombus.setAttribute("width", "8");
    rhombus.setAttribute("height", "8");
    rhombus.setAttribute("class", "nonidentifying-optional");
    svg.appendChild(rhombus);
  }
}

function drawGeneralizations({ entities, generalizations }) {
  const svg = document.getElementById("connections");
  generalizations.forEach((gen) => {
    const generic = entities.find((e) => e.name === gen.generic);
    if (!generic || !generic.div) return;

    const genericRect = generic.div.getBoundingClientRect();
    const diagramArea = document.getElementById("diagram-area");
    const diagramRect = diagramArea.getBoundingClientRect();

    const centerX = Math.round(
      genericRect.left + genericRect.width / 2 - diagramRect.left,
    );
    const bottomY = Math.round(
      genericRect.top + genericRect.height - diagramRect.top,
    );

    const circleR = 8;
    const gapBelowEntity = 18;
    const circleCX = centerX;
    const circleCY = Math.round(bottomY + gapBelowEntity);

    // круг
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", circleCX);
    circle.setAttribute("cy", circleCY);
    circle.setAttribute("r", circleR);
    circle.setAttribute("class", "generalization-circle");
    circle.setAttribute("pointer-events", "none");
    svg.appendChild(circle);

    // подчеркивающие линии
    const underlineY1 = circleCY + circleR + 8;
    const underlineHalfWidth = 20;

    const line1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    line1.setAttribute("x1", circleCX - underlineHalfWidth);
    line1.setAttribute("y1", underlineY1);
    line1.setAttribute("x2", circleCX + underlineHalfWidth);
    line1.setAttribute("y2", underlineY1);
    line1.setAttribute("stroke", "black");
    line1.setAttribute("stroke-width", "2");
    line1.setAttribute("stroke-linecap", "round");
    line1.setAttribute("pointer-events", "none");
    svg.appendChild(line1);

    if (gen.complete) {
      const underlineY2 = underlineY1 + 6;
      const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line2.setAttribute("x1", circleCX - underlineHalfWidth);
      line2.setAttribute("y1", underlineY2);
      line2.setAttribute("x2", circleCX + underlineHalfWidth);
      line2.setAttribute("y2", underlineY2);
      line2.setAttribute("stroke", "black");
      line2.setAttribute("stroke-width", "2");
      line2.setAttribute("stroke-linecap", "round");
      line2.setAttribute("pointer-events", "none");
      svg.appendChild(line2);
    }

    // дискриминатор — справа от кружка (по центру по высоте)
    if (gen.discriminator) {
      const discr = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      discr.setAttribute("x", circleCX + circleR + 12);
      discr.setAttribute("y", circleCY + 4); // +4 чтобы текст визуально центрировался
      discr.setAttribute("text-anchor", "start");
      discr.setAttribute("font-size", "11");
      discr.setAttribute("pointer-events", "none");
      discr.setAttribute("class", "generalization-discriminator");
      discr.textContent = gen.discriminator;
      svg.appendChild(discr);
    }

    // линии к категориям — ортогональные
    gen.categories.forEach((catName) => {
      const cat = entities.find((e) => e.name === catName);
      if (!cat || !cat.div) return;

      const catRect = cat.div.getBoundingClientRect();
      const catPoint = {
        x: Math.round(catRect.left + catRect.width / 2 - diagramRect.left),
        y: Math.round(catRect.top - diagramRect.top),
      };

      const startX = circleCX;
      const startY = underlineY1;

      const midY = Math.round(startY + (catPoint.y - startY) / 2);

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const d = `M ${startX} ${startY} V ${midY} H ${catPoint.x} V ${catPoint.y}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", "black");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("pointer-events", "none");
      svg.appendChild(path);
    });
  });
}

export function redrawConnections({
  entities,
  relationships,
  generalizations,
}) {
  const connections = document.getElementById("connections");
  connections.innerHTML = "";
  drawConnections({ entities, relationships, generalizations });
  drawGeneralizations({ entities, relationships, generalizations });
}
