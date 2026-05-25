import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  FigmaDesignSchema,
  FigmaFrame,
  FigmaNode,
  FigmaComponent,
  GeneratedComponent,
  GeneratedPage,
  GeneratedProject,
  DesignTokens,
} from '@qa-platform/shared-types';
import { toPascalCase, toKebabCase, pxToRem } from '@qa-platform/shared-utils';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('codegen-service');

export interface CodegenInput {
  runId: string;
  projectId: string;
  designSchema: FigmaDesignSchema;
}

@Injectable()
export class CodegenService {
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: config.get('OPENAI_API_KEY'),
    });
  }

  async generateProject(input: CodegenInput): Promise<GeneratedProject> {
    const { runId, projectId, designSchema } = input;
    if (!designSchema) throw new Error('designSchema is required');
    logger.info('Starting code generation', { runId, projectId });

    const tokens = designSchema.designTokens ?? {
      colors: [], typography: [], spacing: [], shadows: [], borderRadius: [], breakpoints: [],
    };

    // 1. Generate design tokens file
    const designTokenFile = this.generateDesignTokensFile(tokens);
    const tailwindConfig = this.generateTailwindConfig(tokens);

    // 2. Generate components (AI-powered)
    const components: GeneratedComponent[] = await this.generateComponents(
      designSchema.components ?? [],
      tokens,
    );

    // 3. Generate pages
    const pages: GeneratedPage[] = await this.generatePages(
      designSchema.pages?.[0]?.frames ?? [],
      components,
      tokens,
    );

    // 4. Generate package.json for the generated Next.js project
    const packageJson = this.generatePackageJson(projectId);

    logger.info('Code generation complete', {
      runId,
      components: components.length,
      pages: pages.length,
    });

    return {
      id: uuid(),
      projectId,
      runId,
      components,
      pages,
      designTokenFile,
      tailwindConfig,
      packageJson,
    };
  }

  // -----------------------------------------------------------------------
  // AI Component Generation
  // -----------------------------------------------------------------------
  private async generateComponents(
    figmaComponents: FigmaComponent[],
    tokens: DesignTokens,
  ): Promise<GeneratedComponent[]> {
    const generated: GeneratedComponent[] = [];

    // Process in batches of 5 to avoid rate limits
    const batches = this.chunkArray(figmaComponents, 5);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((comp) => this.generateSingleComponent(comp, tokens)),
      );
      generated.push(...batchResults.filter(Boolean) as GeneratedComponent[]);
    }

    return generated;
  }

  private async generateSingleComponent(
    component: FigmaComponent,
    tokens: DesignTokens,
  ): Promise<GeneratedComponent | null> {
    const componentName = toPascalCase(component.name);
    const node = component.node;

    const prompt = this.buildComponentPrompt(componentName, node, tokens);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.get('OPENAI_MODEL', 'gpt-4o'),
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You are an expert React/TypeScript/TailwindCSS developer.
Generate clean, accessible, production-ready React components from Figma design data.
Rules:
- Use TypeScript with proper interfaces
- Use TailwindCSS for styling (no inline styles)
- Make components accessible (proper ARIA, semantic HTML)
- Export a named component and a default export
- Include className prop for overrides
- Keep it concise — no comments or explanations, only code
- Wrap the component in a single code block with language "tsx"`,
          },
          { role: 'user', content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (!content) return null;

      const code = this.extractCodeBlock(content);
      if (!code) return null;

      // Calculate a reusability score based on component properties
      const reusabilityScore = this.calculateReusabilityScore(node, component);

      return {
        id: uuid(),
        name: componentName,
        filePath: `src/components/${componentName}.tsx`,
        code,
        figmaNodeId: component.id,
        reusabilityScore,
        dependencies: this.extractDependencies(code),
      };
    } catch (error: any) {
      logger.warn('AI generation failed, using fallback', { component: componentName, error: error.message });
      return this.generateFallbackComponent(component, tokens);
    }
  }

  private buildComponentPrompt(
    name: string,
    node: FigmaNode,
    tokens: DesignTokens,
  ): string {
    const width = node.width;
    const height = node.height;
    const hasText = this.hasTextChildren(node);
    const hasImage = this.hasImageChildren(node);
    const childCount = node.children?.length ?? 0;
    const primaryColor = tokens.colors[0]?.hex ?? '#6366f1';

    return `Generate a React TypeScript component named "${name}" based on this Figma design:

Layout: ${width}x${height}px, ${node.type}
Layout mode: ${(node as any).layoutMode ?? 'NONE'}
Padding: top:${node.padding?.top ?? 0} right:${node.padding?.right ?? 0} bottom:${node.padding?.bottom ?? 0} left:${node.padding?.left ?? 0}
Children: ${childCount} child elements
Has text: ${hasText}
Has image: ${hasImage}
Border radius: ${node.borderRadius ?? 0}px
Background: ${node.backgroundColor ?? 'transparent'}
Primary color: ${primaryColor}
Font family: ${tokens.typography[0]?.fontFamily ?? 'Inter'}

Variant properties: ${component.variants?.map(v => v.name).join(', ') ?? 'none'}

Generate a complete, working React component with TailwindCSS styling that closely matches this design.`;
  }

  // -----------------------------------------------------------------------
  // Fallback Component (when AI fails/is unavailable)
  // -----------------------------------------------------------------------
  private generateFallbackComponent(
    component: FigmaComponent,
    tokens: DesignTokens,
  ): GeneratedComponent {
    const name = toPascalCase(component.name);
    const node = component.node;
    const bg = node.backgroundColor ?? 'transparent';
    const br = node.borderRadius ? `rounded-[${node.borderRadius}px]` : '';
    const pt = node.padding?.top ?? 0;
    const pr = node.padding?.right ?? 0;
    const pb = node.padding?.bottom ?? 0;
    const pl = node.padding?.left ?? 0;

    const code = `import React from 'react';
import clsx from 'clsx';

interface ${name}Props {
  className?: string;
  children?: React.ReactNode;
}

export function ${name}({ className, children }: ${name}Props) {
  return (
    <div
      className={clsx(
        'relative flex flex-col',
        '${br}',
        className,
      )}
      style={{
        backgroundColor: '${bg}',
        padding: '${pt}px ${pr}px ${pb}px ${pl}px',
      }}
    >
      {children}
    </div>
  );
}

export default ${name};
`;

    return {
      id: uuid(),
      name,
      filePath: `src/components/${name}.tsx`,
      code,
      figmaNodeId: component.id,
      reusabilityScore: 50,
      dependencies: ['react', 'clsx'],
    };
  }

  // -----------------------------------------------------------------------
  // Page Generation
  // -----------------------------------------------------------------------
  private async generatePages(
    frames: FigmaFrame[],
    components: GeneratedComponent[],
    tokens: DesignTokens,
  ): Promise<GeneratedPage[]> {
    return frames.map((frame) => {
      const pageName = toPascalCase(frame.name);
      const route = `/${toKebabCase(frame.name)}`;
      const componentImports = components
        .slice(0, 5)
        .map((c) => `import { ${c.name} } from '@/components/${c.name}';`)
        .join('\n');

      const code = `import React from 'react';
${componentImports}

export default function ${pageName}Page() {
  return (
    <main
      className="min-h-screen"
      style={{ width: ${frame.width}, maxWidth: '100%', margin: '0 auto' }}
    >
      {/* Generated from Figma frame: ${frame.name} */}
      <div className="flex flex-col gap-4 p-8">
        ${this.generatePageChildren(frame.children, components)}
      </div>
    </main>
  );
}
`;

      return {
        id: uuid(),
        name: pageName,
        route,
        filePath: `src/app${route}/page.tsx`,
        code,
        figmaFrameId: frame.id,
      };
    });
  }

  private generatePageChildren(nodes: FigmaNode[], components: GeneratedComponent[]): string {
    if (!nodes?.length) return '<div />';
    return nodes
      .slice(0, 10)
      .map((node) => {
        const matchingComp = components.find((c) => c.figmaNodeId === node.id);
        if (matchingComp) return `<${matchingComp.name} />`;
        if (node.type === 'TEXT') return `<p className="text-foreground">${node.text ?? ''}</p>`;
        return `<div className="w-full h-${Math.min(Math.round(node.height / 4), 96)}" />`;
      })
      .join('\n        ');
  }

  // -----------------------------------------------------------------------
  // Design Tokens
  // -----------------------------------------------------------------------
  generateDesignTokensFile(tokens: DesignTokens): string {
    const colorObj = Object.fromEntries(
      tokens.colors.map((c) => [toKebabCase(c.name), c.hex]),
    );

    const typographyObj = Object.fromEntries(
      tokens.typography.map((t) => [
        toKebabCase(t.name),
        {
          fontFamily: t.fontFamily,
          fontSize: pxToRem(t.fontSize),
          fontWeight: t.fontWeight,
          lineHeight: pxToRem(t.lineHeight),
        },
      ]),
    );

    const spacingObj = Object.fromEntries(
      tokens.spacing.map((s) => [s.name, `${s.value}${s.unit}`]),
    );

    return `// Auto-generated design tokens from Figma
// DO NOT EDIT MANUALLY

export const colors = ${JSON.stringify(colorObj, null, 2)} as const;

export const typography = ${JSON.stringify(typographyObj, null, 2)} as const;

export const spacing = ${JSON.stringify(spacingObj, null, 2)} as const;

export const shadows = ${JSON.stringify(tokens.shadows.map(s => ({ [s.name]: s.value })), null, 2)} as const;

export type ColorToken = keyof typeof colors;
export type TypographyToken = keyof typeof typography;
export type SpacingToken = keyof typeof spacing;
`;
  }

  generateTailwindConfig(tokens: DesignTokens): string {
    const colors = Object.fromEntries(
      tokens.colors.map((c) => [toKebabCase(c.name), c.hex]),
    );
    const fontFamily = Object.fromEntries(
      tokens.typography
        .filter((t, i, arr) => arr.findIndex(x => x.fontFamily === t.fontFamily) === i)
        .map((t) => [toKebabCase(t.name), [t.fontFamily, 'sans-serif']]),
    );

    return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 6).replace(/^/gm, '      ')},
      fontFamily: ${JSON.stringify(fontFamily, null, 6).replace(/^/gm, '      ')},
    },
  },
  plugins: [],
};

export default config;
`;
  }

  generatePackageJson(projectId: string): string {
    return JSON.stringify({
      name: `generated-project-${projectId.slice(0, 8)}`,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0',
        'react-dom': '^18.3.0',
        clsx: '^2.1.0',
        'tailwind-merge': '^2.3.0',
      },
      devDependencies: {
        typescript: '^5.4.0',
        tailwindcss: '^3.4.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
      },
    }, null, 2);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  private extractCodeBlock(text: string): string | null {
    const match = text.match(/```(?:tsx?|jsx?|typescript|javascript)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  private extractDependencies(code: string): string[] {
    const matches = code.matchAll(/from ['"]([^'"./][^'"]*)['"]/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }

  private calculateReusabilityScore(node: FigmaNode, component: FigmaComponent): number {
    let score = 50;
    if (component.variants && component.variants.length > 1) score += 20;
    if (component.description) score += 10;
    if (node.type === 'COMPONENT') score += 10;
    if ((node.children?.length ?? 0) > 3) score += 10;
    return Math.min(score, 100);
  }

  private hasTextChildren(node: FigmaNode): boolean {
    if (node.type === 'TEXT') return true;
    return node.children?.some(this.hasTextChildren.bind(this)) ?? false;
  }

  private hasImageChildren(node: FigmaNode): boolean {
    if (node.type === 'IMAGE') return true;
    if (node.fills?.some((f: any) => f.type === 'IMAGE')) return true;
    return node.children?.some(this.hasImageChildren.bind(this)) ?? false;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

// Circular ref fix for buildComponentPrompt
const component = { variants: undefined as any };
