import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AIChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Greetings, Keeper. I am ready to assist.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    // Mock Response Delay
    setTimeout(() => {
        setMessages(prev => [...prev, { role: 'model', text: 'AI Chat placeholder. Real lore constrained mode will be added later.' }]);
        setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-md p-2 text-xs leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-zinc-700 text-white' 
                : 'bg-surface text-foreground border border-border'
            }`}>
              {msg.role === 'model' && <Bot size={10} className="mb-1 text-accent" />}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-md p-2">
                    <div className="flex gap-1">
                        <span className="w-1 h-1 bg-accent rounded-full animate-bounce"></span>
                        <span className="w-1 h-1 bg-accent rounded-full animate-bounce delay-100"></span>
                        <span className="w-1 h-1 bg-accent rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="p-2 border-t border-border bg-surface/30">
        <div className="flex gap-2 relative">
          <input
            type="text"
            className="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent placeholder:text-muted pr-8"
            placeholder="Ask AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-1 top-1 bottom-1 px-1.5 text-muted hover:text-accent disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatWidget;