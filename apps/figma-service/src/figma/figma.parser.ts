import { Injectable } from '@nestjs/common';
import type {
  FigmaDesignSchema,
  FigmaPage,
  FigmaFrame,
  FigmaNode,
  FigmaNodeType,
  FigmaComponent,
  DesignTokens,
  ColorToken,
  TypographyToken,
  SpacingToken,
  ShadowToken,
  Fill,
  Stroke,
  Effect,
  Constraints,
  Spacing,
} from '@qa-platform/shared-types';
import { figmaColorToHex, figmaColorToRgba, pxToRem, toPascalCase } from '@qa-platform/shared-utils';

@Injectable()
export class FigmaParser {
  parseFileToSchema(
    fileData: any,
    imagesData: any,
    componentsData: any,
  ): FigmaDesignSchema {
    const doc = fileData.document;

    const pages: FigmaPage[] = doc.children
      .filter((child: any) => child.type === 'CANVAS')
      .map((canvas: any) => this.parsePage(canvas, imagesData));

    const designTokens = this.extractDesignTokens(fileData);
    const components = this.extractComponents(fileData, componentsData);

    return {
      fileId: fileData.id ?? '',
      fileName: fileData.name ?? 'Untitled',
      version: fileData.version ?? '0',
      lastModified: fileData.lastModified ?? new Date().toISOString(),
      pages,
      designTokens,
      components,
    };
  }

  // -----------------------------------------------------------------------
  // Pages & Frames
  // -----------------------------------------------------------------------
  private parsePage(canvas: any, imagesData: any): FigmaPage {
    const frames: FigmaFrame[] = canvas.children
      .filter((child: any) => child.type === 'FRAME' || child.type === 'COMPONENT')
      .map((frame: any) => this.parseFrame(frame, imagesData));

    return {
      id: canvas.id,
      name: canvas.name,
      frames,
    };
  }

  private parseFrame(frame: any, imagesData: any): FigmaFrame {
    return {
      id: frame.id,
      name: frame.name,
      width: frame.absoluteBoundingBox?.width ?? frame.size?.x ?? 0,
      height: frame.absoluteBoundingBox?.height ?? frame.size?.y ?? 0,
      backgroundColor: this.extractBackgroundColor(frame),
      layoutMode: frame.layoutMode ?? 'NONE',
      children: (frame.children ?? []).map((child: any) => this.parseNode(child, imagesData)),
    };
  }

  // -----------------------------------------------------------------------
  // Nodes
  // -----------------------------------------------------------------------
  parseNode(node: any, imagesData: any): FigmaNode {
    const base: FigmaNode = {
      id: node.id,
      name: node.name,
      type: this.normalizeNodeType(node.type),
      x: node.absoluteBoundingBox?.x ?? 0,
      y: node.absoluteBoundingBox?.y ?? 0,
      width: node.absoluteBoundingBox?.width ?? 0,
      height: node.absoluteBoundingBox?.height ?? 0,
      visible: node.visible !== false,
      opacity: node.opacity ?? 1,
      fills: this.parseFills(node.fills),
      strokes: this.parseStrokes(node.strokes),
      effects: this.parseEffects(node.effects),
      constraints: this.parseConstraints(node.constraints),
      borderRadius: node.cornerRadius,
      padding: this.parsePadding(node),
    };

    // Text
    if (node.type === 'TEXT' && node.characters) {
      const style = node.style ?? {};
      base.text = node.characters;
      base.fontFamily = style.fontFamily;
      base.fontSize = style.fontSize;
      base.fontWeight = style.fontWeight;
      base.color = style.fills?.[0]?.color
        ? figmaColorToHex(style.fills[0].color)
        : this.extractFirstSolidFillColor(node.fills);
    }

    // Component instance
    if (node.type === 'INSTANCE') {
      base.componentId = node.componentId;
    }

    // Background color for frames/groups
    if (node.backgroundColor) {
      base.backgroundColor = figmaColorToHex(node.backgroundColor);
    }

    // Children
    if (node.children?.length) {
      base.children = node.children.map((child: any) => this.parseNode(child, imagesData));
    }

    return base;
  }

  // -----------------------------------------------------------------------
  // Design Tokens
  // -----------------------------------------------------------------------
  extractDesignTokens(fileData: any): DesignTokens {
    const colors = this.extractColors(fileData);
    const typography = this.extractTypography(fileData);
    const spacing = this.extractSpacing(fileData);
    const shadows = this.extractShadows(fileData);

    return {
      colors,
      typography,
      spacing,
      shadows,
      borderRadius: this.extractBorderRadius(fileData),
      breakpoints: [
        { name: 'sm', value: 640 },
        { name: 'md', value: 768 },
        { name: 'lg', value: 1024 },
        { name: 'xl', value: 1280 },
        { name: '2xl', value: 1536 },
      ],
    };
  }

  private extractColors(fileData: any): ColorToken[] {
    const colors: ColorToken[] = [];
    const seen = new Set<string>();

    const walkNode = (node: any) => {
      // Extract from fills
      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.type === 'SOLID' && fill.color) {
            const hex = figmaColorToHex(fill.color);
            if (!seen.has(hex)) {
              seen.add(hex);
              colors.push({
                name: node.name ? `${toPascalCase(node.name)}Fill` : `color-${colors.length}`,
                value: figmaColorToRgba(fill.color),
                hex,
                rgba: {
                  r: Math.round(fill.color.r * 255),
                  g: Math.round(fill.color.g * 255),
                  b: Math.round(fill.color.b * 255),
                  a: fill.color.a ?? 1,
                },
              });
            }
          }
        }
      }
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    // Extract from local styles
    const styles = fileData.styles ?? {};
    for (const [, style] of Object.entries(styles) as any) {
      if (style.styleType === 'FILL' && !seen.has(style.name)) {
        // Color names from styles are more semantic
        seen.add(style.name);
      }
    }

    return colors.slice(0, 64); // Cap to avoid noise
  }

  private extractTypography(fileData: any): TypographyToken[] {
    const fonts = new Map<string, TypographyToken>();

    const walkNode = (node: any) => {
      if (node.type === 'TEXT' && node.style) {
        const s = node.style;
        const key = `${s.fontFamily}-${s.fontWeight}-${s.fontSize}`;
        if (!fonts.has(key)) {
          fonts.set(key, {
            name: node.name ?? key,
            fontFamily: s.fontFamily ?? 'Inter',
            fontSize: s.fontSize ?? 16,
            fontWeight: s.fontWeight ?? 400,
            lineHeight: s.lineHeightPx ?? s.fontSize * 1.5,
            letterSpacing: s.letterSpacing,
          });
        }
      }
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    return Array.from(fonts.values()).slice(0, 20);
  }

  private extractSpacing(fileData: any): SpacingToken[] {
    const spacings = new Set<number>();

    const walkNode = (node: any) => {
      if (node.paddingTop) spacings.add(node.paddingTop);
      if (node.paddingBottom) spacings.add(node.paddingBottom);
      if (node.paddingLeft) spacings.add(node.paddingLeft);
      if (node.paddingRight) spacings.add(node.paddingRight);
      if (node.itemSpacing) spacings.add(node.itemSpacing);
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    const sorted = Array.from(spacings).sort((a, b) => a - b);
    return sorted.map((value, i) => ({
      name: `spacing-${i + 1}`,
      value,
      unit: 'px' as const,
    }));
  }

  private extractShadows(fileData: any): ShadowToken[] {
    const shadows: ShadowToken[] = [];
    const seen = new Set<string>();

    const walkNode = (node: any) => {
      if (node.effects) {
        for (const effect of node.effects) {
          if (effect.type === 'DROP_SHADOW' && effect.visible !== false) {
            const key = JSON.stringify(effect);
            if (!seen.has(key)) {
              seen.add(key);
              shadows.push({
                name: `shadow-${shadows.length + 1}`,
                value: `${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${figmaColorToRgba(effect.color ?? { r: 0, g: 0, b: 0, a: 0.2 })}`,
                offsetX: effect.offset?.x ?? 0,
                offsetY: effect.offset?.y ?? 0,
                blur: effect.radius ?? 0,
                spread: effect.spread ?? 0,
                color: figmaColorToRgba(effect.color ?? { r: 0, g: 0, b: 0, a: 0.2 }),
              });
            }
          }
        }
      }
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    return shadows.slice(0, 20);
  }

  private extractBorderRadius(fileData: any) {
    const radii = new Set<number>();

    const walkNode = (node: any) => {
      if (node.cornerRadius) radii.add(node.cornerRadius);
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    const sorted = Array.from(radii).sort((a, b) => a - b);
    return sorted.map((value, i) => ({ name: `radius-${i + 1}`, value }));
  }

  // -----------------------------------------------------------------------
  // Components
  // -----------------------------------------------------------------------
  extractComponents(fileData: any, componentsData: any): import('@qa-platform/shared-types').FigmaComponent[] {
    const components: import('@qa-platform/shared-types').FigmaComponent[] = [];
    const componentMeta = componentsData?.meta?.components ?? [];

    const walkNode = (node: any) => {
      if (node.type === 'COMPONENT') {
        const meta = componentMeta.find((c: any) => c.node_id === node.id);
        components.push({
          id: node.id,
          name: node.name,
          description: meta?.description,
          node: this.parseNode(node, {}),
        });
      }
      if (node.type === 'COMPONENT_SET' && node.children) {
        const variants = node.children.map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          properties: this.parseVariantProperties(variant.name),
        }));

        const firstVariant = node.children[0];
        if (firstVariant) {
          components.push({
            id: node.id,
            name: node.name,
            description: node.description,
            node: this.parseNode(firstVariant, {}),
            variants,
          });
        }
      }
      if (node.children) node.children.forEach(walkNode);
    };

    if (fileData.document?.children) {
      fileData.document.children.forEach((page: any) => {
        if (page.children) page.children.forEach(walkNode);
      });
    }

    return components;
  }

  private parseVariantProperties(variantName: string): Record<string, string> {
    const props: Record<string, string> = {};
    variantName.split(',').forEach((part) => {
      const [key, value] = part.trim().split('=');
      if (key && value) props[key.trim()] = value.trim();
    });
    return props;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  private parseFills(fills: any[]): Fill[] {
    if (!fills) return [];
    return fills.map((f) => ({
      type: f.type,
      color: f.color,
      opacity: f.opacity,
    }));
  }

  private parseStrokes(strokes: any[]): Stroke[] {
    if (!strokes) return [];
    return strokes.map((s) => ({
      type: s.type,
      color: s.color,
      weight: s.weight ?? 1,
    }));
  }

  private parseEffects(effects: any[]): Effect[] {
    if (!effects) return [];
    return effects.map((e) => ({
      type: e.type,
      visible: e.visible !== false,
      radius: e.radius,
      color: e.color,
      offsetX: e.offset?.x,
      offsetY: e.offset?.y,
    }));
  }

  private parseConstraints(constraints: any): Constraints {
    return {
      horizontal: constraints?.horizontal ?? 'LEFT',
      vertical: constraints?.vertical ?? 'TOP',
    };
  }

  private parsePadding(node: any): Spacing {
    return {
      top: node.paddingTop ?? 0,
      right: node.paddingRight ?? 0,
      bottom: node.paddingBottom ?? 0,
      left: node.paddingLeft ?? 0,
    };
  }

  private extractBackgroundColor(node: any): string {
    if (node.backgroundColor) return figmaColorToHex(node.backgroundColor);
    const solidFill = node.fills?.find((f: any) => f.type === 'SOLID');
    return solidFill?.color ? figmaColorToHex(solidFill.color) : 'transparent';
  }

  private extractFirstSolidFillColor(fills: any[]): string | undefined {
    if (!fills) return undefined;
    const solid = fills.find((f) => f.type === 'SOLID' && f.color);
    return solid ? figmaColorToHex(solid.color) : undefined;
  }

  private normalizeNodeType(type: string): FigmaNodeType {
    const valid = new Set(['FRAME', 'GROUP', 'TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'COMPONENT', 'INSTANCE', 'IMAGE', 'BOOLEAN_OPERATION']);
    return valid.has(type) ? (type as FigmaNodeType) : 'RECTANGLE';
  }

  // -----------------------------------------------------------------------
  // Export: generate Tailwind theme from design tokens
  // -----------------------------------------------------------------------
  generateTailwindTheme(tokens: DesignTokens): string {
    const colors: Record<string, string> = {};
    tokens.colors.forEach((c, i) => {
      colors[`design-${i}`] = c.hex;
    });

    const fontSizes: Record<string, [string, Record<string, string>]> = {};
    tokens.typography.forEach((t, i) => {
      fontSizes[`design-${i}`] = [
        pxToRem(t.fontSize),
        { lineHeight: pxToRem(t.lineHeight), fontWeight: String(t.fontWeight) },
      ];
    });

    const spacing: Record<string, string> = {};
    tokens.spacing.forEach((s, i) => {
      spacing[`design-${i}`] = `${s.value}${s.unit}`;
    });

    const theme = {
      colors,
      fontSize: fontSizes,
      spacing,
    };

    return JSON.stringify(theme, null, 2);
  }
}
