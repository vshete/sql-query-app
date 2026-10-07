'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAIQueryGeneration } from '@/app/hooks/useAIQueryGeneration';
import styles from './queryAgent.module.css';
import type { DatabaseQueryResult } from '@/app/types/query.types';

interface Props {
  onQueryGenerated: (query: string) => void;
  onQueryStreaming?: (query: string) => void;
  onGeneratingChange?: (generating: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const NaturalLanguageInput: React.FC<Props> = ({
  onQueryGenerated,
  onQueryStreaming,
  onGeneratingChange,
  isLoading = false,
  placeholder = "Describe what data you need... e.g., 'Show me all active users with their recent orders'",
}) => {
  const [input, setInput] = useState('');
  const [queryResult, setQueryResult] = useState<DatabaseQueryResult | null>(null);
  const { generateQuery, streamedSQL, agentText, isGenerating, error } = useAIQueryGeneration();

  useEffect(() => { onGeneratingChange?.(isGenerating); }, [isGenerating, onGeneratingChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
  };

  const handleGenerateQuery = useCallback(async () => {
    if (!input.trim()) return;

    try {
      setQueryResult(null);
      const result = await generateQuery(input, onQueryStreaming);
      onQueryGenerated(result.generatedSQL);
      setQueryResult(result.queryResult);
      setInput('');
    } catch (err) {
      console.error('Error generating query:', err);
    }
  }, [input, generateQuery, onQueryGenerated, onQueryStreaming]);

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

      {streamedSQL && (
        <section className={styles.mockResults} aria-label="SQL generation preview">
          <strong>{isGenerating ? "Generating SQL…" : error ? "Incomplete SQL" : "Generated SQL"}</strong>
          <pre className={styles.streamText}>{streamedSQL}</pre>
        </section>
      )}

      {agentText && (
        <section className={styles.mockResults} aria-label="Agent response">
          <strong>Agent response</strong>
          <pre className={styles.streamText}>{agentText}</pre>
        </section>
      )}

      {queryResult && (
        <section className={styles.mockResults} aria-live="polite">
          <div className={styles.mockResultsHeader}>
            <strong>PostgreSQL results</strong>
            <span>{queryResult.rowCount} rows{queryResult.truncated ? " (limited)" : ""}</span>
          </div>
          <p>{queryResult.message}</p>
          {queryResult.columns.length > 0 && (
            <div className={styles.mockResultsTableWrap}>
              <table className={styles.mockResultsTable}>
                <thead>
                  <tr>{queryResult.columns.map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {queryResult.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {queryResult.columns.map((column) => (
                        <td key={column}>{row[column] === null ? 'NULL' : String(row[column] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
    </div>
  );
};

export default NaturalLanguageInput;
