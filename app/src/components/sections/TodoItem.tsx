import React, { useState, useRef, useEffect } from 'react';

export interface TodoItemData {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

interface TodoItemProps {
  todo: TodoItemData;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (id: string, newText: string) => void;
  isLast?: boolean;
  onEnterPress?: (id: string, text: string) => void;
  onBackspaceDelete?: (id: string) => void;
  autoFocus?: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onEdit,
  onEnterPress,
  onBackspaceDelete,
  autoFocus = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoFocused = useRef(false);

  // Focus input when entering edit mode or auto-focus is requested
  useEffect(() => {
    if (autoFocus && !hasAutoFocused.current) {
      setIsEditing(true);
      hasAutoFocused.current = true;
    }
    if ((isEditing || autoFocus) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, autoFocus]);

  const handleEdit = () => {
    if (!todo.completed) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    onEdit(todo.id, editText.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onEnterPress) {
      onEnterPress(todo.id, editText.trim());
      setIsEditing(false);
    } else if (e.key === 'Backspace' && editText === '' && onBackspaceDelete) {
      e.preventDefault();
      onBackspaceDelete(todo.id);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditText(e.target.value);
  };

  return (
    <li className='flex items-center rounded shadow-sm' data-testid='todo-item'>
      <input
        type='checkbox'
        checked={todo.completed}
        onChange={onToggle}
        className='h-5 w-5 text-blue-600 rounded focus:ring-blue-500'
        data-testid='todo-checkbox'
      />

      {isEditing ? (
        <div className='flex-grow ml-3'>
          <input
            ref={inputRef}
            type='text'
            value={editText}
            onChange={handleChange}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={`w-full p-1 border-0 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300`}
            data-testid='edit-todo-input'
          />
        </div>
      ) : (
        <span
          className={`flex-grow ml-3 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
          onClick={handleEdit}
          role='button'
          tabIndex={0}
          data-testid='todo-text'
        >
          {todo.text} &nbsp;
        </span>
      )}
    </li>
  );
};

export default TodoItem;
