import { randomUUID } from 'crypto';

export interface SessionData {
  id: string;
  initialized: boolean;
  createdAt: Date;
  // Add any other session-specific data here
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();

  public getOrCreateSession(sessionId?: string | null): [string, SessionData] {
    const id = sessionId || randomUUID();

    let session = this.sessions.get(id);
    if (session) {
      return [id, session];
    }

    session = {
      id,
      initialized: false,
      createdAt: new Date(),
    };
    this.sessions.set(id, session);
    console.log(`[SessionManager] Created new session: ${id}`);
    return [id, session];
  }

  public getStats() {
    return {
      activeSessions: this.sessions.size,
      sessionKeys: Array.from(this.sessions.keys()),
    };
  }

  public destroy(): void {
    this.sessions.clear();
    console.log('[SessionManager] All sessions destroyed.');
  }
}
