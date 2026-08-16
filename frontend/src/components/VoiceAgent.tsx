import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneCall, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { startConversation, sendMessage, getDebugInfo } from '../services/api';
import type { DebugInfo } from '../services/api';

interface Message {
  role: 'agent' | 'user';
  text: string;
}

export const VoiceAgent: React.FC = () => {
  const [supported, setSupported] = useState<boolean>(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !window.speechSynthesis) {
      setSupported(false);
      return;
    }

    const loadVoices = () => {
      if (synthRef.current?.getVoices().length) {
        console.log('[TTS] Voices loaded');
      }
    };
    
    console.log('[VOICE] Speech recognition initialized');
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; 

    recognition.onstart = () => {
      console.log('[VOICE] Recognition started');
      setIsListening(true);
    };
    recognition.onend = () => {
      console.log('[VOICE] Recognition ended');
      setIsListening(false);
    };
    
    // We will bind onresult later to avoid stale closures
    
    recognition.onerror = (e: any) => {
      console.error('[ERROR] Recognition error:', e.error);
      setIsListening(false);
      setVoiceError(e.error);
    }

    recognitionRef.current = recognition;
    synthRef.current = window.speechSynthesis;


    
    loadVoices();
    if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // Fix stale closure for event handlers
  const handleUserMessageRef = useRef<any>(null);
  
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStart = async () => {
    try {
      const data = await startConversation();
      setSessionId(data.session_id);
      setMessages([{ role: 'agent', text: data.message }]);
      speak(data.message, data.session_id);
      fetchDebug(data.session_id);
      setVoiceError(null);
    } catch (error) {
      console.error(error);
      alert('Failed to connect to the backend server. Make sure it is running.');
    }
  };

  const handleUserMessage = async (text: string) => {
    if (!sessionId) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    
    try {
      const data = await sendMessage(sessionId, text);
      console.log('[CONVERSATION] Agent response:', data.reply);
      setMessages(prev => [...prev, { role: 'agent', text: data.reply }]);
      speak(data.reply, sessionId);
      fetchDebug(sessionId);
    } catch (error) {
      console.error('[ERROR] Unable to process the conversation response:', error);
      alert("Unable to process the conversation response. Please try again.");
    }
  };
  
  // Update the ref whenever the function changes
  useEffect(() => {
    handleUserMessageRef.current = handleUserMessage;
  }, [handleUserMessage]);

  // Bind onresult using the ref to always get the latest closure
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = async (event: any) => {
        console.log('[VOICE] Speech detected');
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          console.log('[VOICE] Final transcript:', transcript);
          console.log('[VOICE] Sending transcript to backend:', transcript);
          if (handleUserMessageRef.current) {
            handleUserMessageRef.current(transcript);
          }
        }
      };
    }
  }, []);

  const applyPronunciation = (text: string) => {
    let t = text;
    const dictionary: Record<string, string> = {
      "Divyasree": "Div-ya-shree",
      "Devanahalli": "Day-van-a-halli",
      "Nandi": "Nan-dee",
      "WOW": "Wow"
    };
    for (const [word, phonetic] of Object.entries(dictionary)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      t = t.replace(regex, phonetic);
    }
    return t;
  };

  const speak = (text: string, currentSession: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel(); 

    const phoneticText = applyPronunciation(text);
    const utterance = new SpeechSynthesisUtterance(phoneticText);
    
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => (v.lang.includes('en-IN') || v.lang.includes('en-US')) && v.name.includes('Female')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 1.05;

    console.log('[TTS] Starting speech synthesis');
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      console.log('[TTS] Speech synthesis completed');
      setIsSpeaking(false);
      fetchDebug(currentSession).then(dbg => {
        if (dbg && dbg.stage !== 'END') {
           if (recognitionRef.current) {
              try {
                console.log('[TTS] Restarting recognition');
                recognitionRef.current.start();
              } catch (e) {
                console.log('[ERROR] Failed to start recognition:', e);
              }
           }
        }
      });
    };
    
    synthRef.current.speak(utterance);
  };

  const fetchDebug = async (id: string) => {
    try {
      const dbg = await getDebugInfo(id);
      setDebugInfo(dbg);
      return dbg;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (synthRef.current) synthRef.current.cancel(); 
      try {
        console.log('[VOICE] Starting recognition manually');
        recognitionRef.current.start();
      } catch (e) {
        console.log('[ERROR] Failed to start recognition manually:', e);
      }
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center justify-center h-screen p-4 text-center">
        <div className="bg-[#1e1e1e] p-8 rounded-2xl max-w-md border border-red-900/50">
          <h2 className="text-xl font-semibold mb-4 text-red-400">Browser Not Supported</h2>
          <p className="text-gray-300">
            The Web Speech API is required for this application. Please use Google Chrome or a Chromium-based browser on desktop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#121212] text-[#f0f0f0]">
      
      {/* Main Conversation Column */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto p-6 lg:p-12 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-wide text-[#d4af37] mb-2 uppercase">Whispers of the Wind</h1>
          <p className="text-sm text-gray-400 tracking-widest uppercase">Premium Property Consultation</p>
        </div>

        {!sessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center">
             <div className="w-48 h-48 rounded-full bg-[#1e1e1e] flex items-center justify-center border border-[#333] shadow-2xl mb-8">
                <PhoneCall size={64} className="text-[#d4af37]" />
             </div>
             <button 
                onClick={handleStart}
                className="px-8 py-4 bg-[#d4af37] text-black font-semibold tracking-wide uppercase text-sm rounded hover:bg-[#ebd075] transition-colors"
             >
               Start Consultation
             </button>
             <p className="mt-4 text-xs text-gray-500">Please allow microphone access when prompted.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            
            {/* Status Indicator */}
            <div className="flex items-center justify-between bg-[#1e1e1e] p-4 rounded-lg mb-6 border border-[#333]">
               <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-blue-400 animate-pulse' : isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-sm font-medium tracking-wide">
                    {isSpeaking ? 'Agent is speaking...' : isListening ? 'Listening...' : 'Standing by'}
                  </span>
               </div>
               
               <button 
                 onClick={toggleListen}
                 className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
               >
                 {isListening ? <MicOff size={20} /> : <Mic size={20} />}
               </button>
            </div>
            
            {voiceError && (
              <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm flex items-center justify-between">
                <span><strong>Microphone Error:</strong> {voiceError}</span>
                <button onClick={() => setVoiceError(null)} className="text-red-300 hover:text-white">✕</button>
              </div>
            )}

            {/* Transcript */}
            <div 
              ref={transcriptRef}
              className="flex-1 overflow-y-auto space-y-6 pr-4 mb-6"
              style={{ maxHeight: '60vh' }}
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-lg text-sm leading-relaxed ${m.role === 'user' ? 'bg-[#2a2a2a] text-white border border-[#444]' : 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30'}`}>
                    <span className="block text-[10px] uppercase tracking-widest opacity-50 mb-1">
                      {m.role === 'user' ? 'You' : 'WOW Consultant'}
                    </span>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

      {/* Demo Mode / Debug Sidebar */}
      {sessionId && debugInfo && (
        <div className="w-full md:w-80 bg-[#1a1a1a] border-t md:border-t-0 md:border-l border-[#333] p-6 flex flex-col h-screen overflow-y-auto">
          <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-6 flex items-center"><ChevronRight size={14}/> Demo Mode (Debug)</h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Current Stage</p>
              <div className="text-sm font-medium bg-[#222] p-2 rounded text-[#d4af37]">{debugInfo.stage}</div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Extracted Data</p>
              <div className="space-y-2 bg-[#222] p-3 rounded text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Intent:</span>
                  <span className={debugInfo.extracted.intent ? 'text-white' : 'text-gray-600'}>
                    {debugInfo.extracted.intent || 'pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Location Fit:</span>
                  <span className={debugInfo.extracted.location_fit !== null ? 'text-white' : 'text-gray-600'}>
                    {debugInfo.extracted.location_fit === true ? 'Yes' : debugInfo.extracted.location_fit === false ? 'No' : 'pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Budget Fit:</span>
                  <span className={debugInfo.extracted.budget_fit !== null ? 'text-white' : 'text-gray-600'}>
                    {debugInfo.extracted.budget_fit === true ? 'Yes' : debugInfo.extracted.budget_fit === false ? 'No' : 'pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Timeline Fit:</span>
                  <span className={debugInfo.extracted.timeline_fit !== null ? 'text-white' : 'text-gray-600'}>
                    {debugInfo.extracted.timeline_fit === true ? 'Yes' : debugInfo.extracted.timeline_fit === false ? 'No' : 'pending'}
                  </span>
                </div>
              </div>
            </div>

            <div>
               <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Qualification State</p>
               <div className={`p-4 rounded border ${
                 debugInfo.qualification.status === 'HOT' ? 'bg-green-900/20 border-green-900/50 text-green-400' :
                 debugInfo.qualification.status === 'WARM' ? 'bg-yellow-900/20 border-yellow-900/50 text-yellow-400' :
                 debugInfo.qualification.status === 'COLD' ? 'bg-red-900/20 border-red-900/50 text-red-400' :
                 'bg-[#222] border-[#333] text-gray-400'
               }`}>
                 <div className="flex items-center space-x-2 mb-2">
                   {debugInfo.qualification.status === 'HOT' ? <CheckCircle size={16}/> : 
                    debugInfo.qualification.status === 'WARM' ? <CheckCircle size={16} className="opacity-70"/> :
                    debugInfo.qualification.status === 'COLD' ? <XCircle size={16}/> : 
                    <XCircle size={16} className="opacity-50"/>}
                   <span className="font-semibold text-sm">
                     {debugInfo.qualification.status ? debugInfo.qualification.status : 'PENDING'}
                   </span>
                 </div>
                 <p className="text-xs opacity-80">{debugInfo.qualification.reason}</p>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
