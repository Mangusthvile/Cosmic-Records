import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertTriangle, X, Bot, Dna } from 'lucide-react';
import { Note, Workspace } from '../types';
import { analyzeCanon, chatWithAssistant, convertNarrativeToRules } from '../services/geminiService';

interface AssistantPanelProps {
  currentNote: Note | null;
  workspace: Workspace;
  isOpen?: boolean; // Optional now as visibility is handled by parent layout
  onClose?: () => void;
  className?: string; // Allow parent to inject layout classes
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AssistantPanel: React.FC<AssistantPanelProps> = ({ currentNote, workspace, isOpen = true, onClose, className }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Greetings, Keeper. I am ready to assist with the Cosmic Records.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatWithAssistant(userMsg, currentNote, workspace, messages);
      if (response) {
        setMessages(prev => [...prev, { role: 'model', text: response }]);
      }
    } catch (error) {
        setMessages(prev => [...prev, { role: 'model', text: 'Communication error with the Cosmos.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeCanon = async () => {
    if (!currentNote) return;
    setMessages(prev => [...prev, { role: 'user', text: 'Analyze this note for canon consistency.' }]);
    setIsLoading(true);
    try {
        const analysis = await analyzeCanon(currentNote, workspace);
        setMessages(prev => [...prev, { role: 'model', text: analysis }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: 'Analysis failed.' }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleConvertToRules = async () => {
      if (!currentNote || currentNote.recordKind !== 'character') return;
      setMessages(prev => [...prev, { role: 'user', text: 'Convert narrative to game rules.' }]);
      setIsLoading(true);
      try {
          const rules = await convertNarrativeToRules(currentNote);
          setMessages(prev => [...prev, { role: 'model', text: rules }]);
      } catch (e) {
          setMessages(prev => [...prev, { role: 'model', text: 'Conversion failed.' }]);
      } finally {
          setIsLoading(false);
      }
  };

  // If explicitly hidden by legacy prop, return null, otherwise render full height container
  if (!isOpen) return null;

  return (
    <div className={`flex flex-col h-full bg-chrome-panel border-l border-chrome-border ${className || ''}`}>
      
      {/* Header */}
      <div className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-chrome-border bg-chrome-panel">
        <div className="flex items-center gap-2 text-accent font-mono text-[var(--fs-sm)] font-bold">
            <Sparkles size={14} />
            <span className="truncate">AI ASSISTANT</span>
        </div>
        {onClose && (
            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                <X size={14} />
            </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-chrome-panel" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-md p-3 text-xs leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-zinc-700 text-white' 
                : 'bg-surface text-foreground border border-border'
            }`}>
              {msg.role === 'model' && <Bot size={12} className="mb-1 text-accent" />}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-md p-3">
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Context Actions */}
      {currentNote && (
          <div className="px-3 py-2 bg-surface/50 border-t border-border flex gap-2 flex-shrink-0">
              <button 
                onClick={handleAnalyzeCanon}
                disabled={isLoading}
                className="flex-1 text-[10px] uppercase font-bold tracking-wide flex items-center justify-center gap-2 py-2 border border-accent/30 rounded text-accent hover:bg-accent/10 transition-colors"
                title="Find Contradictions"
              >
                  <AlertTriangle size={12} /> Canon
              </button>
              
              {currentNote.recordKind === 'character' && (
                  <button 
                    onClick={handleConvertToRules}
                    disabled={isLoading}
                    className="flex-1 text-[10px] uppercase font-bold tracking-wide flex items-center justify-center gap-2 py-2 border border-success/30 rounded text-success hover:bg-success/10 transition-colors"
                    title="Convert Narrative to Rules"
                  >
                      <Dna size={12} /> Rules
                  </button>
              )}
          </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-chrome-panel border-t border-border flex-shrink-0">
        <div className="flex gap-2 relative">
          <input
            type="text"
            className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent placeholder:text-muted pr-10"
            placeholder="Query archives..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-1 top-1 bottom-1 px-2 text-muted hover:text-accent disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;