import {
  BaseSectionDefinition,
  SectionValidationResult,
} from './BaseSectionDefinition';

export class SectionRegistry {
  private static instance: SectionRegistry;
  private sections: Map<string, BaseSectionDefinition> = new Map();

  static getInstance(): SectionRegistry {
    if (!SectionRegistry.instance) {
      SectionRegistry.instance = new SectionRegistry();
    }
    return SectionRegistry.instance;
  }

  register(definition: BaseSectionDefinition): void {
    this.sections.set(definition.id, definition);
  }

  get(contentType: string): BaseSectionDefinition | undefined {
    return this.sections.get(contentType);
  }

  getAll(): BaseSectionDefinition[] {
    return Array.from(this.sections.values());
  }

  getAllTypes(): Array<{ value: string; label: string }> {
    return Array.from(this.sections.values()).map(def => ({
      value: def.id,
      label: def.name,
    }));
  }

  // Business logic delegation
  isContentEmpty(contentType: string, content: string): boolean {
    const definition = this.get(contentType);
    return definition ? definition.isContentEmpty(content) : !content.trim();
  }

  validateContent(
    contentType: string,
    content: string
  ): SectionValidationResult {
    const definition = this.get(contentType);
    return definition ? definition.validateContent(content) : { isValid: true };
  }

  formatToMarkdown(
    contentType: string,
    title: string,
    content: string
  ): string {
    const definition = this.get(contentType);
    return definition
      ? definition.formatToMarkdown(title, content)
      : `## ${title}\n\n${content}\n`;
  }

  getDefaultContent(contentType: string): string {
    const definition = this.get(contentType);
    return definition ? definition.getDefaultContent() : '';
  }
}
