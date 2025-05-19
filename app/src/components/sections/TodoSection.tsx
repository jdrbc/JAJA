import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TodoItem, { TodoItemData } from './TodoItem';
import SectionTitle from './SectionTitle';
import { logger } from '../../utils/logger';

interface TodoSectionProps {
  type: string;
  content: string;
  onContentChange: (content: string) => void;
  title: string;
  placeholder?: string;
}

interface TodoSectionData {
  items: TodoItemData[];
}

const TodoSection: React.FC<TodoSectionProps> = ({
  content,
  onContentChange,
  title,
  placeholder = 'Start typing to create your first todo',
}) => {
  // Parse content JSON or initialize empty array
  const parseTodos = (contentToParse: string): TodoItemData[] => {
    try {
      // Handle empty or whitespace-only content
      if (!contentToParse || contentToParse.trim() === '') {
        return [];
      }
      const data = JSON.parse(contentToParse) as TodoSectionData;
      return data.items || [];
    } catch (e) {
      logger.error('Error parsing todo content:', e);
      return [];
    }
  };

  const [todos, setTodos] = useState<TodoItemData[]>(() => {
    const parsed = parseTodos(content);
    // Ensure there's at least one item
    if (parsed.length === 0) {
      return [createEmptyTodo()];
    }
    return parsed;
  });

  // Create empty todo item
  function createEmptyTodo(): TodoItemData {
    return {
      id: uuidv4(),
      text: '',
      completed: false,
      createdAt: new Date().toISOString(),
    };
  }

  // Update todos and sync to parent
  const updateTodos = (newTodos: TodoItemData[]) => {
    setTodos(newTodos);
    onContentChange(JSON.stringify({ items: newTodos }));
  };

  // Add todo after a specific item
  const addTodoAfter = (currentId: string, newText: string) => {
    const currentIndex = todos.findIndex(todo => todo.id === currentId);
    if (currentIndex === -1) return;

    // update the current todo with the new text
    const updatedTodos = todos.map(todo => {
      if (todo.id === currentId) {
        return { ...todo, text: newText };
      }
      return todo;
    });

    // add a new todo after the current todo
    const newTodo = createEmptyTodo();
    updatedTodos.splice(currentIndex + 1, 0, newTodo);

    updateTodos(updatedTodos);
  };

  // Remove todo if it's empty
  const removeTodo = (id: string) => {
    const newTodos = todos.filter(todo => todo.id !== id);

    // Ensure we always have at least one item
    if (newTodos.length === 0) {
      newTodos.push(createEmptyTodo());
    }

    updateTodos(newTodos);
  };

  // Toggle todo completion
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

  // Delete todo (for non-empty items, convert to empty removal)
  const deleteTodo = (id: string) => {
    const newTodos = todos.filter(todo => todo.id !== id);
    updateTodos(newTodos);
  };

  // Edit todo text
  const editTodo = (id: string, newText: string) => {
    const updatedTodos = todos.map(todo => {
      if (todo.id === id) {
        return {
          ...todo,
          text: newText,
        };
      }
      return todo;
    });

    updateTodos(updatedTodos);
  };

  // Keep UI consistent with received content
  useEffect(() => {
    const parsed = parseTodos(content);
    // Ensure there's at least one item
    if (parsed.length === 0) {
      setTodos([createEmptyTodo()]);
    } else {
      setTodos(parsed);
    }
  }, [content]);

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-6'>
        <div className='todo-list-container'>
          {todos.length === 1 && todos[0].text.trim() === '' ? (
            <p className='text-gray-500 mb-4'>{placeholder}</p>
          ) : null}

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
                autoFocus={
                  todo.text.trim() === '' &&
                  (index === todos.length - 1 || index === todos.length - 2)
                }
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TodoSection;
