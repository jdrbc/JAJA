import { SectionRegistry } from './core/SectionRegistry';
import { TextSectionDefinition } from './definitions/TextSectionDefinition';
import { TodoSectionDefinition } from './definitions/TodoSectionDefinition';
import { HeaderSectionDefinition } from './definitions/HeaderSectionDefinition';

// Initialize registry with all section types
export function initializeSectionRegistry(): void {
  const registry = SectionRegistry.getInstance();

  registry.register(new TextSectionDefinition());
  registry.register(new TodoSectionDefinition());
  registry.register(new HeaderSectionDefinition());
}

// Export the registry instance for convenience
export const sectionRegistry = SectionRegistry.getInstance();
