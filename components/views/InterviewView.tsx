
import React, { useState, useEffect } from 'react';
import { Workspace, Note, InterviewQuestion, InterviewState } from '../../types';
import { Button, Input } from '../ui/Primitives';
import { ArrowLeft, ArrowRight, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { conductInterview } from '../../services/geminiService';

interface InterviewViewProps {
    note: Note;
    workspace: Workspace;
    onUpdate: (note: Note) => void;
    onComplete: () => void;
}

const InterviewView: React.FC<InterviewViewProps> = ({ note, workspace, onUpdate, onComplete }) => {
    // Determine template based on note type
    const noteType = workspace.templates.noteTypes.find(t => t.typeId === note.type);
    const template = noteType?.templates.find(t => t.templateId === noteType.defaultTemplateId);
    const questions = template?.interviewQuestions || [];

    const interviewState: InterviewState = note.aiInterview || {
        isActive: true,
        step: 'start',
        currentQuestionIndex: 0,
        answers: {},
        transcript: []
    };

    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateState = (partial: Partial<InterviewState>) => {
        const newState = { ...interviewState, ...partial };
        onUpdate({ ...note, aiInterview: newState });
    };

    const handleStart = () => {
        updateState({ step: 'questions', currentQuestionIndex: 0 });
    };

    const handleNext = () => {
        const qId = questions[interviewState.currentQuestionIndex].id;
        const newAnswers = { ...interviewState.answers, [qId]: currentAnswer };
        
        const nextIndex = interviewState.currentQuestionIndex + 1;
        
        if (nextIndex >= questions.length) {
            updateState({ answers: newAnswers, step: 'review' });
        } else {
            updateState({ answers: newAnswers, currentQuestionIndex: nextIndex });
            setCurrentAnswer((interviewState.answers[questions[nextIndex].id] as string) || '');
        }
    };

    const handleBack = () => {
        const prevIndex = interviewState.currentQuestionIndex - 1;
        if (prevIndex >= 0) {
            updateState({ currentQuestionIndex: prevIndex });
            setCurrentAnswer((interviewState.answers[questions[prevIndex].id] as string) || '');
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const modules = await conductInterview(interviewState.answers, questions, workspace);
            
            // Construct new content structure
            // We need to inject the modules into the document.
            // For HybridEditor, this means adding `moduleBlock` nodes.
            const content = {
                type: 'doc',
                content: modules.map(mod => ({
                    type: 'moduleBlock',
                    attrs: {
                        moduleId: crypto.randomUUID(),
                        moduleType: mod.type,
                        data: mod.data,
                        collapsed: false
                    }
                }))
            };

            // Setup Character State
            const characterState = {
                activeFormId: 'base',
                forms: [],
                snapshots: []
            };

            // Final Update: Remove interview state, set content
            onUpdate({ 
                ...note, 
                content, 
                metadata: { ...note.metadata, characterState, kind: 'character' },
                aiInterview: { ...interviewState, isActive: false, step: 'complete' } 
            });
            onComplete();

        } catch (e: any) {
            setError(e.message || "Failed to generate character profile.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (questions.length === 0) {
        return <div className="p-8 text-center text-text2">No interview template found for this note type.</div>;
    }

    const currentQ = questions[interviewState.currentQuestionIndex];

    return (
        <div className="flex flex-col h-full bg-deep-space text-text items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-panel border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[400px]">
                
                {/* Header */}
                <div className="bg-panel2 border-b border-border p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Sparkles size={24} className="text-accent" />
                        <h2 className="text-xl font-bold">Character Interview</h2>
                    </div>
                    {interviewState.step === 'questions' && (
                        <span className="text-xs font-mono text-text2">
                            Step {interviewState.currentQuestionIndex + 1} of {questions.length}
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 p-8 flex flex-col justify-center">
                    
                    {interviewState.step === 'start' && (
                        <div className="text-center space-y-4">
                            <p className="text-lg text-text2">
                                I will ask you a few questions to build your character profile.
                                The answers will be used to generate a structured sheet.
                            </p>
                            <Button onClick={handleStart} className="px-8 py-3 text-lg">Start Interview</Button>
                        </div>
                    )}

                    {interviewState.step === 'questions' && currentQ && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <h3 className="text-2xl font-bold leading-tight">{currentQ.text}</h3>
                            <Input 
                                autoFocus
                                value={currentAnswer}
                                onChange={e => setCurrentAnswer(e.target.value)}
                                className="text-lg p-4 h-auto"
                                placeholder="Type your answer..."
                                onKeyDown={e => e.key === 'Enter' && handleNext()}
                            />
                            <div className="flex justify-between pt-4">
                                <Button variant="ghost" onClick={handleBack} disabled={interviewState.currentQuestionIndex === 0}>
                                    <ArrowLeft size={16} className="mr-2" /> Back
                                </Button>
                                <Button onClick={handleNext}>
                                    Next <ArrowRight size={16} className="ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {interviewState.step === 'review' && (
                        <div className="space-y-6 text-center">
                            <h3 className="text-2xl font-bold">Ready to Generate?</h3>
                            <p className="text-text2">I have enough information to construct the profile.</p>
                            
                            {error && (
                                <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded text-sm flex items-center justify-center gap-2">
                                    <AlertTriangle size={16} /> {error}
                                </div>
                            )}

                            <div className="flex justify-center gap-4 pt-4">
                                <Button variant="ghost" onClick={() => updateState({ step: 'questions', currentQuestionIndex: questions.length - 1 })}>
                                    Go Back
                                </Button>
                                <Button onClick={handleGenerate} disabled={isGenerating} className="px-8 py-3 text-lg bg-accent text-bg hover:bg-accent/90">
                                    {isGenerating ? (
                                        <><Sparkles size={18} className="mr-2 animate-spin" /> Generating...</>
                                    ) : (
                                        <><Sparkles size={18} className="mr-2" /> Generate Profile</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default InterviewView;
