'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAIQueryGeneration } from '@/app/hooks/useAIQueryGeneration';
import styles from './queryAgent.module.css';
import { CodeEditor } from '../editor/CodeEditor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  onGeneratingChange?: (generating: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const NaturalLanguageInput: React.FC<Props> = ({
  onGeneratingChange,
  isLoading = false,
  placeholder = "Describe what data you need... e.g., 'Show me all active users with their recent orders'",
}) => {
  const [input, setInput] = useState('');
  const { generateQuery, hasStarted, streamedSQL, agentText, isGenerating, error } = useAIQueryGeneration();

  useEffect(() => { onGeneratingChange?.(isGenerating); }, [isGenerating, onGeneratingChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
  };

  const handleGenerateQuery = useCallback(async () => {
    if (!input.trim()) return;

    try {
      await generateQuery(input);
      setInput('');
    } catch (err) {
      console.error('Error generating query:', err);
    }
  }, [input, generateQuery]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const quickSuggestions = [
    'Show all users from the last 30 days',
    'Get top 10 products by sales',
    'Count orders by customer',
    'Find orders over $100 from 2024',
    'List all active subscriptions',
  ];

  return (
    <div className={styles.nlInputContainer}>
      <div className={styles.inputSection}>
        <label className={styles.label}>What data do you need?</label>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={handleInputChange}
          placeholder={placeholder}
          rows={4}
          disabled={isGenerating || isLoading}
        />

        {error && (
          <div className={styles.error}>
            <span>Error: {error}</span>
          </div>
        )}

        <div className={styles.actionBar}>
          <button
            className={styles.generateBtn}
            onClick={handleGenerateQuery}
            disabled={!input.trim() || isGenerating || isLoading}
          >
            {isGenerating || isLoading ? 'Generating...' : 'Generate Query'}
          </button>

          {input.trim() && (
            <button
              className={styles.clearBtn}
              onClick={() => setInput('')}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      </div>

       <div className={styles.suggestionsSection}>
        <p className={styles.suggestionsLabel}>Quick suggestions:</p>
        <div className={styles.suggestionsList}>
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              className={styles.suggestionChip}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {hasStarted && (
        <section className={styles.mockResults} aria-label="SQL generation preview">
          <strong>{isGenerating ? "Generating SQL…" : error ? "Incomplete SQL" : "Generated SQL"}</strong>
          <div className={styles.sqlEditor}><CodeEditor code={streamedSQL} language="sql" /></div>
        </section>
      )}

      {agentText && (
        <section className={styles.mockResults} aria-label="Agent response">
          <strong>Query response</strong>
          <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{agentText}</ReactMarkdown></div>
        </section>
      )}

      {isGenerating && (
        <div className={styles.generationStatus} role="status" aria-live="polite">
          <span className={styles.generationSpinner} aria-hidden="true" />
          <span>Generating response…</span>
        </div>
      )}

    </div>
  );
};

export default NaturalLanguageInput;
