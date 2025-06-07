import { SectionRegistry } from './core/SectionRegistry';
import { TextSectionDefinition } from './definitions/TextSectionDefinition';
import { TodoSectionDefinition } from './definitions/TodoSectionDefinition';
import { HeaderSectionDefinition } from './definitions/HeaderSectionDefinition';
import { MonthWeekGoalSectionDefinition } from './definitions/MonthWeekGoalSectionDefinition';
import { HabitTrackerSectionDefinition } from './definitions/HabitTrackerSectionDefinition';

// Initialize registry with all section types
export function initializeSectionRegistry(): void {
  const registry = SectionRegistry.getInstance();

  registry.register(new TextSectionDefinition());
  registry.register(new TodoSectionDefinition());
  registry.register(new HeaderSectionDefinition());
  registry.register(new MonthWeekGoalSectionDefinition());
  registry.register(new HabitTrackerSectionDefinition());
}

// Export the registry instance for convenience
export const sectionRegistry = SectionRegistry.getInstance();
