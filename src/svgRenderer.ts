import { Entity, Attribute } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface SVGRenderOptions {
  fontFamily?: string;
  fontSize?: number;
  padding?: number;
  lineHeight?: number;
}

const defaultOptions: SVGRenderOptions = {
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  fontSize: 12,
  padding: 8, // Increased from 5 for better text spacing
  lineHeight: 1.3,
};

// Padding constants
const TYPE_PADDING = 3; // Pixels between attribute name and type

export function createSVGEntity(
  entity: Entity,
  options: SVGRenderOptions = {},
): SVGGElement {
  const opts = { ...defaultOptions, ...options };
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-entity-name", entity.name);
  group.setAttribute("class", "entity-container");

  // Calculate dimensions based on content
  const measurements = measureEntity(entity, opts);
  entity.width = measurements.width;
  entity.height = measurements.height;

  // Create background rectangle
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", measurements.width.toString());
  rect.setAttribute("height", measurements.height.toString());
  rect.setAttribute("stroke", "black");
  rect.setAttribute("stroke-width", "2");
  rect.setAttribute("fill", "white");
  if (entity.weak) {
    rect.setAttribute("rx", "10");
    rect.setAttribute("ry", "10");
  }
  group.appendChild(rect);

  // Entity name text (above rectangle)
  const nameText = document.createElementNS(SVG_NS, "text");
  nameText.textContent = entity.name;
  nameText.setAttribute("x", opts.padding!.toString());
  nameText.setAttribute("y", (-opts.padding).toString());
  nameText.setAttribute("font-family", opts.fontFamily);
  nameText.setAttribute("font-size", "14");
  nameText.setAttribute("font-weight", "bold");
  nameText.setAttribute("fill", "black");
  nameText.setAttribute("dominant-baseline", "text-bottom");
  group.appendChild(nameText);

  // Separator line between PK and attributes
  if (entity.primaryKey.length > 0 || entity.attributes.length > 0) {
    const separator = document.createElementNS(SVG_NS, "line");
    separator.setAttribute("x1", "0");
    separator.setAttribute("y1", measurements.pkSectionHeight.toString());
    separator.setAttribute("x2", measurements.width.toString());
    separator.setAttribute("y2", measurements.pkSectionHeight.toString());
    separator.setAttribute("stroke", "black");
    separator.setAttribute("stroke-width", "2");
    group.appendChild(separator);
  }

  // Primary key attributes
  let currentY = opts.padding;
  entity.primaryKey.forEach((pk) => {
    const pkGroup = createAttributeSVG(
      pk,
      true,
      opts.fontFamily!,
      opts.fontSize!,
      measurements.lineHeight,
      measurements.width,
    );
    pkGroup.setAttribute(
      "transform",
      `translate(${opts.padding}, ${currentY})`,
    );
    group.appendChild(pkGroup);
    currentY += measurements.lineHeight;
  });

  // Regular attributes
  currentY = measurements.pkSectionHeight + opts.padding;
  entity.attributes.forEach((attr) => {
    const attrGroup = createAttributeSVG(
      attr,
      false,
      opts.fontFamily!,
      opts.fontSize!,
      measurements.lineHeight,
      measurements.width,
    );
    attrGroup.setAttribute(
      "transform",
      `translate(${opts.padding}, ${currentY})`,
    );
    group.appendChild(attrGroup);
    currentY += measurements.lineHeight;
  });

  // Set transform for positioning
  const posX = entity.x || 0;
  const posY = entity.y || 0;
  group.setAttribute("transform", `translate(${posX}, ${posY})`);

  return group;
}

function createAttributeSVG(
  attr: Attribute,
  isPK: boolean,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  maxWidth: number,
): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");

  // Vertical center of the line
  const textY = lineHeight / 2;

  // Create text for attribute name
  const nameText = document.createElementNS(SVG_NS, "text");
  nameText.textContent = attr.name + (attr.optional ? " (O)" : "");
  nameText.setAttribute("x", "0");
  nameText.setAttribute("y", textY.toString());
  nameText.setAttribute("font-family", fontFamily);
  nameText.setAttribute("font-size", fontSize.toString());
  nameText.setAttribute("font-weight", isPK ? "bold" : "normal");
  nameText.setAttribute("fill", attr.optional ? "#666" : "black");
  nameText.setAttribute("dominant-baseline", "middle");
  if (attr.optional) {
    nameText.setAttribute("font-style", "italic");
  }
  group.appendChild(nameText);

  // Type text
  const typeText = document.createElementNS(SVG_NS, "text");
  typeText.textContent = `: ${attr.type}`;
  // Position type text after name text with padding
  const nameWidth = getTextWidth(
    attr.name + (attr.optional ? " (O)" : ""),
    fontFamily,
    fontSize,
  );
  typeText.setAttribute("x", (nameWidth + TYPE_PADDING).toString());
  typeText.setAttribute("y", textY.toString());
  typeText.setAttribute("font-family", fontFamily);
  typeText.setAttribute("font-size", (fontSize - 1).toString());
  typeText.setAttribute("fill", "#666");
  typeText.setAttribute("dominant-baseline", "middle");
  group.appendChild(typeText);

  return group;
}

interface EntityMeasurements {
  width: number;
  height: number;
  pkSectionHeight: number;
  lineHeight: number;
}

function measureEntity(
  entity: Entity,
  opts: SVGRenderOptions,
): EntityMeasurements {
  // Approximate text widths (could be improved with actual measurement)
  const maxNameWidth = getTextWidth(entity.name, opts.fontFamily!, 14);

  let maxAttrWidth = 0;
  const allAttrs = [...entity.primaryKey, ...entity.attributes];
  allAttrs.forEach((attr) => {
    const name = attr.name + (attr.optional ? " (O)" : "");
    const type = `: ${attr.type}`;
    const totalWidth =
      getTextWidth(name, opts.fontFamily!, opts.fontSize!) +
      TYPE_PADDING + // Space between name and type
      getTextWidth(type, opts.fontFamily!, opts.fontSize! - 1);
    if (totalWidth > maxAttrWidth) maxAttrWidth = totalWidth;
  });

  const padding = opts.padding;
  const lineHeight = Math.round(opts.fontSize * opts.lineHeight);
  const pkLines = entity.primaryKey.length;
  const attrLines = entity.attributes.length;
  const totalLines = pkLines + attrLines;

  const width = Math.max(maxNameWidth, maxAttrWidth) + padding * 2;
  const pkSectionHeight = pkLines * lineHeight + padding;
  const totalHeight =
    padding + // top padding
    totalLines * lineHeight +
    (entity.primaryKey.length > 0 || entity.attributes.length > 0
      ? padding
      : 0) + // separator area
    padding; // bottom padding

  return {
    width: Math.max(width, 120), // minimum width
    height: totalHeight,
    pkSectionHeight: pkSectionHeight,
    lineHeight: lineHeight,
  };
}

function getTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  // Try to use canvas for accurate text measurement
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${fontSize}px ${fontFamily}`;
      return context.measureText(text).width;
    }
  }
  // Fallback: rough approximation with better accuracy
  const avgCharWidth = fontSize * 0.6;
  // Adjust for spaces and typical character widths
  const adjustedLength =
    text.length * 0.9 + text.replace(/[^il1]/g, "").length * 0.3;
  return adjustedLength * avgCharWidth;
}

export function renderEntitiesToSVG(
  entities: Entity[],
  container: SVGSVGElement,
  options?: SVGRenderOptions,
): void {
  container.innerHTML = "";
  entities.forEach((entity) => {
    const svgEntity = createSVGEntity(entity, options);
    container.appendChild(svgEntity);
  });
}

