
import React, { createContext, useContext } from 'react';
import { Workspace, CharacterForm } from '../../types';

interface EditorContextProps {
    workspace: Workspace;
    onOpenNote: (id: string) => void;
    onOpenTerm?: (id: string) => void; 
    
    // Milestone 6: Character State
    activeFormId?: string;
    forms?: CharacterForm[];
    onUpdateFormOverride?: (moduleId: string, data: any) => void;
}

const EditorContext = createContext<EditorContextProps | null>(null);

export const EditorContextProvider: React.FC<{ children: React.ReactNode, value: EditorContextProps }> = ({ children, value }) => (
    <EditorContext.Provider value={value}>
        {children}
    </EditorContext.Provider>
);

export const useEditorContext = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error("useEditorContext must be used within EditorContextProvider");
    }
    return context;
};
