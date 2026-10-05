'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { QueryAgentResult } from '../types/query.types';

export function useAIQueryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedSQL, setStreamedSQL] = useState('');
  const [agentText, setAgentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = useRef<WebSocket | null>(null);
  useEffect(() => () => { active.current?.close(); }, []);

  const generateQuery = useCallback(async (naturalLanguage: string, onSQL?: (sql: string) => void) => {
    if (active.current) throw new Error('A query is already being generated.');
    setIsGenerating(true);
    setError(null);
    setStreamedSQL('');
    setAgentText('');
    try {
      const result = await new Promise<QueryAgentResult>((resolve, reject) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/api/agent/stream`);
        active.current = socket;
        let settled = false;
        let sql = "";
        
        const timer = setTimeout(() => finish(new Error('Query generation timed out.')), 125_000);
        
        function finish(err?: Error, result?: QueryAgentResult) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.close();
          if (err) reject(err);
          else resolve(result!);
        }

        socket.onopen = () => socket.send(JSON.stringify({ request: naturalLanguage }));
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (settled) return;
            if (message.type === 'sql_start') {
              sql = '';
              setStreamedSQL('');
              onSQL?.('');
            } else if (message.type === 'token' && typeof message.token === 'string') {
              sql += message.token;
              setStreamedSQL(sql);
              onSQL?.(sql);
            } else if (message.type === 'agent_token' && typeof message.token === 'string') {
              setAgentText((text) => text + message.token);
            } else if (message.type === 'result') {
              finish(undefined, message.result);
            } else if (message.type === 'error') {
              finish(new Error(message.error));
            }
          } catch { finish(new Error('Invalid response from query agent.')); }
        };
        socket.onerror = () => finish(new Error('Could not connect to the query agent.'));
        socket.onclose = () => finish(new Error('Query stream closed before completion.'));
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      active.current = null;
      setIsGenerating(false);
    }
  }, []);

  return { streamedSQL, agentText, isGenerating, error, generateQuery };
}

