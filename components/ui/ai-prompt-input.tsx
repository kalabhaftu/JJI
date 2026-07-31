import * as React from "react";
import logger from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

const SendIcon = (props: React.SVGProps<SVGSVGElement>) => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}> <path d="M12 5.25L12 18.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> <path d="M18.75 12L12 5.25L5.25 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> </svg> );
const MicIcon = (props: React.SVGProps<SVGSVGElement>) => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}> <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path> <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path> <line x1="12" y1="19" x2="12" y2="23"></line> </svg> );
const StopCircleIcon = (props: React.SVGProps<SVGSVGElement>) => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}> <circle cx="12" cy="12" r="10"></circle> <rect x="9" y="9" width="6" height="6" rx="1"></rect> </svg> );

export interface PromptBoxProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit?: (message: string, tool: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Extend Window for SpeechRecognition
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export const PromptBox = React.forwardRef<HTMLTextAreaElement, PromptBoxProps>(
  ({ value: externalValue, onChange, onSubmit, placeholder = "Message...", disabled }, ref) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = React.useState("");
    const [isRecording, setIsRecording] = React.useState(false);
    const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

    const isControlled = externalValue !== undefined;
    const value = isControlled ? externalValue : localValue;

    React.useImperativeHandle(ref, () => internalTextareaRef.current!, []);

    React.useLayoutEffect(() => {
      const textarea = internalTextareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
      }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setLocalValue(e.target.value);
      }
      if (onChange) onChange(e);
    };

    const handleSend = () => {
      if (disabled) return;
      const finalMsg = value.trim();
      if (!finalMsg) return;

      if (onSubmit) {
        onSubmit(finalMsg, null);
      }

      if (!isControlled) {
        setLocalValue("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    // Voice Typing via Web Speech API
    const toggleRecording = () => {
      if (isRecording) {
        // Stop recording
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsRecording(false);
        return;
      }

      // Start recording
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error('Voice typing is not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result || !result[0]) continue;
          
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          if (isControlled) {
            // For controlled mode, simulate a change event
            const textarea = internalTextareaRef.current;
            if (textarea) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
              )?.set;
              const newValue = (externalValue || '') + finalTranscript;
              nativeInputValueSetter?.call(textarea, newValue);
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else {
            setLocalValue(prev => prev + finalTranscript);
          }
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event: { error: string }) => {
        logger.error({ err: new Error(event.error) }, 'Speech recognition error:');
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    };

    // Clean up on unmount
    React.useEffect(() => {
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
        }
      };
    }, []);

    const hasValue = value.trim().length > 0;

    return (
      <div className={cn(
        "flex flex-col rounded-2xl p-2 shadow-sm transition-colors border border-border/60 bg-muted/50 cursor-text",
        disabled && "opacity-60 pointer-events-none"
      )}>
        <textarea
          ref={internalTextareaRef}
          aria-label="AI prompt"
          rows={1}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="custom-scrollbar w-full resize-none border-0 bg-transparent p-3 text-foreground placeholder:text-muted-foreground focus:ring-0 focus-visible:outline-none min-h-12 text-sm"
          disabled={disabled}
        />
        
        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center justify-end gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                    onClick={toggleRecording}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isRecording
                        ? "bg-destructive/15 text-destructive animate-pulse"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {isRecording ? (
                      <StopCircleIcon className="h-5 w-5" />
                    ) : (
                      <MicIcon className="h-5 w-5" />
                    )}
                    <span className="sr-only">{isRecording ? 'Stop recording' : 'Record voice'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow={true}>
                  <p>{isRecording ? 'Stop recording' : 'Voice input'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Send message"
                    onClick={handleSend}
                    disabled={!hasValue || disabled}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    <SendIcon className="h-5 w-5" />
                    <span className="sr-only">Send message</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow={true}><p>Send</p></TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);
PromptBox.displayName = "PromptBox";
