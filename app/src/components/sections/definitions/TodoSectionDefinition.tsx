import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TodoItem, { TodoItemData } from '../TodoItem';
import {
  CommonSectionDefinition,
  SectionRenderProps,
  SectionValidationResult,
} from '../core/BaseSectionDefinition';
import { logger } from '../../../utils/logger';

interface TodoData {
  items: TodoItemData[];
}

const TodoDisplay: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
}) => {
  const parseTodos = (contentToParse: string): TodoItemData[] => {
    try {
      if (!contentToParse || contentToParse.trim() === '') {
        return [];
      }
      const data = JSON.parse(contentToParse) as TodoData;
      return data.items || [];
    } catch (e) {
      logger.error('Error parsing todo content:', e);
      return [];
    }
  };

  const todos = parseTodos(content);

  const toggleTodo = (id: string) => {
    const now = new Date().toISOString();
    const updatedTodos = todos.map(todo =>
      todo.id === id
        ? {
            ...todo,
            completed: !todo.completed,
            completedAt: !todo.completed ? now : undefined,
          }
        : todo
    );
    onContentChange(JSON.stringify({ items: updatedTodos }));
  };

  if (todos.length === 0) {
    return <span className='text-gray-400'>No todos yet...</span>;
  }

  return (
    <div className='space-y-2'>
      {todos.map(todo => (
        <div key={todo.id} className='flex items-center space-x-2'>
          <input
            type='checkbox'
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
            className='rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200'
          />
          <span
            className={
              todo.completed ? 'line-through text-gray-500' : 'text-gray-700'
            }
          >
            {todo.text}
          </span>
        </div>
      ))}
    </div>
  );
};

const TodoEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  const isInitializedRef = useRef(false);
  const initialContentRef = useRef(content);

  const parseTodos = (contentToParse: string): TodoItemData[] => {
    try {
      if (!contentToParse || contentToParse.trim() === '') {
        return [];
      }
      const data = JSON.parse(contentToParse) as TodoData;
      return data.items || [];
    } catch (e) {
      logger.error('Error parsing todo content:', e);
      return [];
    }
  };

  function createEmptyTodo(): TodoItemData {
    return {
      id: uuidv4(),
      text: '',
      completed: false,
      createdAt: new Date().toISOString(),
    };
  }

  const [todos, setTodos] = useState<TodoItemData[]>(() => {
    const parsed = parseTodos(content);
    if (parsed.length === 0) {
      const newTodo = createEmptyTodo();
      return [newTodo];
    }
    return parsed;
  });

  const [recentlyCreatedTodoId, setRecentlyCreatedTodoId] = useState<
    string | null
  >(null);

  const updateTodos = (newTodos: TodoItemData[]) => {
    setTodos(newTodos);
    if (isInitializedRef.current) {
      onContentChange(JSON.stringify({ items: newTodos }));
    }
  };

  const addTodoAfter = (currentId: string, newText: string) => {
    const currentIndex = todos.findIndex(todo => todo.id === currentId);
    if (currentIndex === -1) return;

    const updatedTodos = todos.map(todo => {
      if (todo.id === currentId) {
        return { ...todo, text: newText };
      }
      return todo;
    });

    const newTodo = createEmptyTodo();
    setRecentlyCreatedTodoId(newTodo.id);
    updatedTodos.splice(currentIndex + 1, 0, newTodo);

    updateTodos(updatedTodos);
  };

  const removeTodo = (id: string) => {
    const newTodos = todos.filter(todo => todo.id !== id);
    updateTodos(newTodos);
  };

  const toggleTodo = (id: string) => {
    const now = new Date().toISOString();
    const updatedTodos = todos.map(todo =>
      todo.id === id
        ? {
            ...todo,
            completed: !todo.completed,
            completedAt: !todo.completed ? now : undefined,
          }
        : todo
    );
    updateTodos(updatedTodos);
  };

  const deleteTodo = (id: string) => {
    const newTodos = todos.filter(todo => todo.id !== id);
    updateTodos(newTodos);
  };

  const editTodo = (id: string, newText: string) => {
    const updatedTodos = todos.map(todo => {
      if (todo.id === id) {
        return { ...todo, text: newText };
      }
      return todo;
    });
    updateTodos(updatedTodos);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (content !== initialContentRef.current) {
      const parsed = parseTodos(content);
      setTodos(parsed);
      initialContentRef.current = content;
    }
  }, [content]);

  useEffect(() => {
    if (recentlyCreatedTodoId) {
      const timer = setTimeout(() => {
        setRecentlyCreatedTodoId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [recentlyCreatedTodoId]);

  return (
    <div className='todo-list-container'>
      <ul className='space-y-2'>
        {todos.map((todo, index) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={() => toggleTodo(todo.id)}
            onDelete={() => deleteTodo(todo.id)}
            onEdit={editTodo}
            isLast={index === todos.length - 1}
            onEnterPress={(id, text) => addTodoAfter(id, text)}
            onBackspaceDelete={removeTodo}
            autoFocus={todo.id === recentlyCreatedTodoId}
          />
        ))}
      </ul>
    </div>
  );
};

export class TodoSectionDefinition extends CommonSectionDefinition {
  readonly id = 'todo';
  readonly name = 'Todo List';
  readonly description = 'Interactive todo list with checkboxes';

  protected getDefaultPlaceholder(): string {
    return 'No todos yet...';
  }

  isContentEmpty(content: string): boolean {
    try {
      const data: TodoData = JSON.parse(content);
      if (data.items.length === 0) return true;
      if (data.items.length === 1) return !data.items[0].text.trim();
      return false;
    } catch {
      return true;
    }
  }

  validateContent(content: string): SectionValidationResult {
    try {
      const data = JSON.parse(content) as TodoData;
      if (!Array.isArray(data.items)) {
        return { isValid: false, errors: ['Invalid todo format'] };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, errors: ['Invalid JSON format'] };
    }
  }

  parseContent(rawContent: string): TodoData {
    try {
      return JSON.parse(rawContent) || { items: [] };
    } catch {
      return { items: [] };
    }
  }

  serializeContent(data: TodoData): string {
    return JSON.stringify(data);
  }

  getDefaultContent(): string {
    return JSON.stringify({ items: [] });
  }

  formatToMarkdown(title: string, content: string): string {
    const data = this.parseContent(content);
    if (data.items.length === 0) return '';

    const todoItems = data.items
      .map(item => `- [${item.completed ? 'x' : ' '}] ${item.text}`)
      .join('\n');

    return `## ${title}\n\n${todoItems}\n`;
  }

  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <TodoDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <TodoEditor {...props} />;
  }
}
