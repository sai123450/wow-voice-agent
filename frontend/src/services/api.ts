const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface ExtractedInfo {
  intent: string | null;
  location_fit: boolean | null;
  budget_fit: boolean | null;
  timeline_fit: boolean | null;
}

export interface QualificationResult {
  qualified: boolean;
  status: string;
  reason: string;
}

export interface DebugInfo {
  stage: string;
  extracted: ExtractedInfo;
  qualification: QualificationResult;
}

export async function startConversation(): Promise<{ session_id: string; message: string }> {
  const res = await fetch(`${API_URL}/conversation/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to start conversation');
  return res.json();
}

export async function sendMessage(sessionId: string, message: string): Promise<{ reply: string; stage: string }> {
  const res = await fetch(`${API_URL}/conversation/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function getQualification(sessionId: string): Promise<QualificationResult> {
  const res = await fetch(`${API_URL}/conversation/${sessionId}/qualification`);
  if (!res.ok) throw new Error('Failed to fetch qualification');
  return res.json();
}

export async function getDebugInfo(sessionId: string): Promise<DebugInfo> {
  const res = await fetch(`${API_URL}/conversation/${sessionId}/debug`);
  if (!res.ok) throw new Error('Failed to fetch debug info');
  return res.json();
}
