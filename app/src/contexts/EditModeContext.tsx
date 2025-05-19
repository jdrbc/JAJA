import React, { createContext, useContext, useState, ReactNode } from 'react';

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  selectedItem: { type: 'column' | 'section'; id: string } | null;
  setSelectedItem: (
    item: { type: 'column' | 'section'; id: string } | null
  ) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

const EditModeContext = createContext<EditModeContextType | undefined>(
  undefined
);

interface EditModeProviderProps {
  children: ReactNode;
}

export const EditModeProvider: React.FC<EditModeProviderProps> = ({
  children,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    type: 'column' | 'section';
    id: string;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const toggleEditMode = () => {
    setIsEditMode(prev => {
      if (prev) {
        // Exiting edit mode - clear selection and dirty state
        setSelectedItem(null);
        setIsDirty(false);
      }
      return !prev;
    });
  };

  const value: EditModeContextType = {
    isEditMode,
    toggleEditMode,
    selectedItem,
    setSelectedItem,
    isDirty,
    setIsDirty,
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
};

// Specialized provider for template management that automatically enables edit mode
export const TemplateEditModeProvider: React.FC<EditModeProviderProps> = ({
  children,
}) => {
  const [selectedItem, setSelectedItem] = useState<{
    type: 'column' | 'section';
    id: string;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Always in edit mode for template management
  const value: EditModeContextType = {
    isEditMode: true,
    toggleEditMode: () => {}, // No-op since we're always in edit mode
    selectedItem,
    setSelectedItem,
    isDirty,
    setIsDirty,
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = (): EditModeContextType => {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
};
