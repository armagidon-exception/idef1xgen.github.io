import { Entity, Generalization, Relationship } from "./types.js";

import { createSVGEntity } from "./svgRenderer";

export function renderDiagram({
  entities,
  relationships,
  generalizations,
}: any) {
  const diagramArea = document.getElementById(
    "diagram-objects",
  ) as unknown as SVGSVGElement;
  const connections = document.getElementById("connections") as SVGSVGElement & HTMLElement;

  diagramArea.innerHTML = "";
  connections.innerHTML = "";

  entities.forEach((entity: Entity) => {
    const svgEntity = createSVGEntity(entity);
    diagramArea.appendChild(svgEntity);
    entity.div = svgEntity;
  });

  drawConnections({ entities, relationships, generalizations });
  drawGeneralizations({ entities, generalizations });
}

function drawConnections({ entities, relationships }: any) {
  const svg = document.getElementById("connections");
  relationships.forEach((rel: Relationship) => {
    const sourceEntity: Entity = entities.find(
      (e: Entity) => e.name === rel.source.entity,
    );
    const targetEntity: Entity = entities.find(
      (e: Entity) => e.name === rel.target.entity,
    );

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
      throw new Error("Invalid connection points:" + sourcePoint + targetPoint);
    }

    const isIdentifying = targetEntity.primaryKey.some(
      (pk) =>
        pk.fkTarget &&
        pk.fkTarget.entity === sourceEntity.name &&
        pk.fkTarget.attributeName === rel.source.attributeName,
    );

    const pathInfo = drawLine(sourcePoint, targetPoint, isIdentifying);

    const sourceAttr = sourceEntity.attributes.find(
      (e) => e.name == rel.source.attributeName,
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
      label.setAttribute("x", pathInfo.mid.x.toString());
      label.setAttribute("y", (pathInfo.mid.y - 12).toString());
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "black");
      label.setAttribute("font-family", '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif');
      label.setAttribute("font-weight", "500");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("pointer-events", "none");
      label.textContent =
        rel.source.relName ||
        `${rel.source.attributeName} →  ${rel.target.attributeName}`;
      svg.appendChild(label);
    }
  });
}

function getConnectionPoint(fromEntity: Entity, toEntity: Entity) {
  const fromRect = fromEntity.div.getBoundingClientRect();
  const toRect = toEntity.div.getBoundingClientRect();
  const diagramArea = document.getElementById("diagram-objects");
  const diagramRect = diagramArea.getBoundingClientRect();

  const fromCenterX = fromRect.left + fromRect.width / 2 - diagramRect.left;
  const fromCenterY = fromRect.top + fromRect.height / 2 - diagramRect.top;
  const toCenterX = toRect.left + toRect.width / 2 - diagramRect.left;
  const toCenterY = toRect.top + toRect.height / 2 - diagramRect.top;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  let pointX, pointY;

  if (Math.abs(dx) > Math.abs(dy)) {
    pointX = fromCenterX + (dx > 0 ? fromRect.width / 2 : -fromRect.width / 2);
    pointY = fromCenterY + (fromRect.height / 2) * (dy / Math.abs(dx));
  } else {
    pointY =
      fromCenterY + (dy > 0 ? fromRect.height / 2 : -fromRect.height / 2);
    pointX = fromCenterX + (fromRect.width / 2) * (dx / Math.abs(dy));
  }

  const borderOffset = 1;
  if (Math.abs(dx) > Math.abs(dy)) {
    pointX += dx > 0 ? -borderOffset : borderOffset;
  } else {
    pointY += dy > 0 ? -borderOffset : borderOffset;
  }

  return { x: pointX, y: pointY };
}

function drawLine(startPoint: any, endPoint: any, isIdentifying: boolean) {
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
    const midX = startPoint.x + dx / 2;
    d = `M ${startPoint.x} ${startPoint.y} H ${midX} V ${endPoint.y} H ${endPoint.x}`;
    mid = { x: midX, y: (startPoint.y + endPoint.y) / 2 };
  } else {
    const midY = startPoint.y + dy / 2;
    d = `M ${startPoint.x} ${startPoint.y} V ${midY} H ${endPoint.x} V ${endPoint.y}`;
    mid = { x: (startPoint.x + endPoint.x) / 2, y: midY };
  }

  path.setAttribute("d", d);
  path.setAttribute("stroke", "black");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("fill", "none");
  path.setAttribute("pointer-events", "none");
  if (!isIdentifying) {
    path.setAttribute("stroke-dasharray", "5,3");
  }

  svg.appendChild(path);

  return { path, mid };
}

function drawRelationshipSymbols(
  targetPoint: any,
  sourcePoint: any,
  optional: boolean,
  many: boolean,
  isIdentifying: boolean,
) {
  const svg = document.getElementById("connections");
  let offsetX;
  let offsetY;

  let dx = targetPoint.x - sourcePoint.x;
  let dy = targetPoint.y - sourcePoint.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    dx = dx / Math.abs(dx);
    offsetX = 8;
    offsetY = 16;
    offsetX *= -dx;
  } else {
    offsetX = 16;
    offsetY = 8;
    dy = dy / Math.abs(dy);
    offsetY *= -dy;
  }

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", targetPoint.x + offsetX);
  text.setAttribute("y", targetPoint.y + offsetY);
  text.setAttribute("font-size", "11");
  text.setAttribute("fill", "black");
  text.setAttribute("font-family", '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif');
  text.setAttribute("font-weight", "bold");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
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
    dot.setAttribute("r", (4).toString());
    dot.setAttribute("fill", "black");
    dot.setAttribute("pointer-events", "none");
    svg.appendChild(dot);
    svg.appendChild(text);
  }

  if (optional && !isIdentifying) {
    const rhombus = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    rhombus.setAttribute("x", "-4");
    rhombus.setAttribute("y", "-4");
    rhombus.setAttribute("width", "8");
    rhombus.setAttribute("height", "8");
    rhombus.setAttribute("fill", "white");
    rhombus.setAttribute("stroke", "black");
    rhombus.setAttribute("stroke-width", "1");
    rhombus.setAttribute("transform", `translate(${sourcePoint.x}, ${sourcePoint.y}) rotate(45)`);
    svg.appendChild(rhombus);
  }
}

function drawGeneralizations({ entities, generalizations }: any) {
  const svg = document.getElementById("connections");
  generalizations.forEach((gen: Generalization) => {
    const generic = entities.find((e: Entity) => e.name === gen.generic);
    if (!generic || !generic.div) return;

    const genericRect = generic.div.getBoundingClientRect();
    const diagramArea = document.getElementById("diagram-objects");
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
    circle.setAttribute("cx", circleCX.toString());
    circle.setAttribute("cy", circleCY.toString());
    circle.setAttribute("r", circleR.toString());
    circle.setAttribute("fill", "white");
    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("pointer-events", "none");
    svg.appendChild(circle);

    // подчеркивающие линии
    const underlineY1 = circleCY + circleR + 8;
    const underlineHalfWidth = 20;

    const line1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    line1.setAttribute("x1", (circleCX - underlineHalfWidth).toString());
    line1.setAttribute("y1", underlineY1.toString());
    line1.setAttribute("x2", (circleCX + underlineHalfWidth).toString());
    line1.setAttribute("y2", underlineY1.toString());
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
      line2.setAttribute("x1", (circleCX - underlineHalfWidth).toString());
      line2.setAttribute("y1", underlineY2.toString());
      line2.setAttribute("x2", (circleCX + underlineHalfWidth).toString());
      line2.setAttribute("y2", underlineY2.toString());
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
      discr.setAttribute("x", (circleCX + circleR + 12).toString());
      discr.setAttribute("y", (circleCY + 4).toString()); // +4 чтобы текст визуально центрировался
      discr.setAttribute("text-anchor", "start");
      discr.setAttribute("font-size", "11");
      discr.setAttribute("fill", "black");
      discr.setAttribute("font-family", '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif');
      discr.setAttribute("dominant-baseline", "middle");
      discr.setAttribute("pointer-events", "none");
      discr.textContent = gen.discriminator;
      svg.appendChild(discr);
    }

    // линии к категориям — ортогональные
    gen.categories.forEach((catName) => {
      const cat = entities.find((e: Entity) => e.name === catName);
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
}: any) {
  const connections = document.getElementById("connections");
  connections.innerHTML = "";
  drawConnections({ entities, relationships, generalizations });
  drawGeneralizations({ entities, relationships, generalizations });
}
