import React, { useState, useEffect, useRef } from 'react';
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
  // Track if component has been initialized to prevent saves during initial mount
  const isInitializedRef = useRef(false);
  const initialContentRef = useRef(content);

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
    return parseTodos(content);
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

    // Only trigger onContentChange if the component has been initialized
    // This prevents saves during initial component mount/navigation
    if (isInitializedRef.current) {
      onContentChange(JSON.stringify({ items: newTodos }));
    }
  };

  // Add first todo when user clicks to start
  const addFirstTodo = () => {
    const newTodo = createEmptyTodo();
    updateTodos([newTodo]);
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

  // Mark component as initialized after first render
  useEffect(() => {
    // Set initialized flag after a short delay to ensure all initial renders are complete
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Keep UI consistent with received content
  useEffect(() => {
    // Only update if content has actually changed from the initial content
    if (content !== initialContentRef.current) {
      const parsed = parseTodos(content);
      setTodos(parsed);
      initialContentRef.current = content;
    }
  }, [content]);

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-6'>
        <div className='todo-list-container'>
          {todos.length === 0 ? (
            <div className='text-center py-8'>
              <p className='text-gray-500 mb-4'>{placeholder}</p>
              <button
                onClick={addFirstTodo}
                className='px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Add First Todo
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoSection;
