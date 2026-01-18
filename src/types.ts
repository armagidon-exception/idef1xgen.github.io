export interface EntityOpts {
  name: string;
  primaryKey: Attribute[];
  attributes: Attribute[];
  weak: boolean;
  div: Element; // Can be HTMLElement or SVGGElement
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Entity {
  name: string;
  primaryKey: Attribute[];
  attributes: Attribute[];
  div: Element;
  height: number;
  weak: boolean;
  width: number;
  x: number;
  y: number;

  constructor(opts: EntityOpts) {
    const { name, primaryKey, attributes, div, height, weak, width, x, y } =
      opts;
    this.name = name;
    this.primaryKey = primaryKey;
    this.weak = weak;
    this.width = width;
    this.x = x;
    this.y = y;
    this.attributes = attributes;
    this.div = div;
    this.height = height;
  }

  getAttribute(name: string): Attribute | null {
    const pk = this.primaryKey.find((e) => e.name === name);
    if (pk) {
      return pk;
    }
    const attr = this.attributes.find((e) => e.name === name);
    if (attr) {
      return attr;
    }

    return null;
  }
}

export class BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;

  constructor(minX: number, minY: number, maxX: number, maxY: number) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  get width(): number {
    return this.maxX - this.minX;
  }

  get height(): number {
    return this.maxY - this.minY;
  }

  intersects(bb: BoundingBox): boolean {
    if (bb.minX <= this.minX && this.minX <= bb.maxX) {
      if (bb.minY <= this.minY && this.minY <= bb.maxY) {
        return true;
      } else if (bb.minY <= this.maxY && this.maxY <= bb.maxY) {
        return true;
      } else {
        return false;
      }
    } else if (bb.minX <= this.minX && this.minX <= bb.maxX) {
      if (bb.minY <= this.minY && this.minY <= bb.maxY) {
        return true;
      } else if (bb.minY <= this.maxY && this.maxY <= bb.maxY) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  static fromRect(rect: DOMRect): BoundingBox {
    return new BoundingBox(rect.left, rect.top, rect.right, rect.bottom);
  }
}

export interface ForeignKey {
  entity: string;
  attributeName: string;
  relName?: string;
}

export interface Attribute {
  name: string;
  many: boolean;
  type: string;
  optional: boolean;
  isPK: boolean;
  fkTarget?: ForeignKey;
}

export interface Generalization {
  generic: string;
  categories: string[];
  discriminator?: string;
  complete: boolean;
}

export interface Relationship {
  source: ForeignKey;
  target: ForeignKey;
}
