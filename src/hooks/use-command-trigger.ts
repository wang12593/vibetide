"use client";

import { useState, useCallback, useRef } from "react";

interface UseCommandTriggerOptions {
  triggerChar: string;
}

interface UseCommandTriggerReturn {
  visible: boolean;
  filterText: string;
  isComposing: boolean;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  handleChange: (value: string, selectionStart: number | null) => void;
  handleSelect: () => void;
  resetTrigger: () => void;
}

export function useCommandTrigger({
  triggerChar,
}: UseCommandTriggerOptions): UseCommandTriggerReturn {
  const [visible, setVisible] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const composingRef = useRef(false);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    setIsComposing(false);
  }, []);

  const handleChange = useCallback(
    (value: string, selectionStart: number | null) => {
      if (composingRef.current) {
        setVisible(false);
        setFilterText("");
        return;
      }

      const cursor = selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursor);
      const escapedChar = triggerChar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`${escapedChar}([^\\s${escapedChar}]*)$`);
      const match = textBeforeCursor.match(regex);

      if (match) {
        const charIndex = textBeforeCursor.length - match[0].length;
        const isAtLineStart = charIndex === 0;
        const precededBySpace = charIndex > 0 && textBeforeCursor[charIndex - 1] === " ";

        if (isAtLineStart || precededBySpace) {
          setVisible(true);
          setFilterText(match[1]);
          return;
        }
      }

      if (visible) {
        setVisible(false);
        setFilterText("");
      }
    },
    [triggerChar, visible]
  );

  const handleSelect = useCallback(() => {
    setVisible(false);
    setFilterText("");
  }, []);

  const resetTrigger = useCallback(() => {
    setVisible(false);
    setFilterText("");
  }, []);

  return {
    visible,
    filterText,
    isComposing,
    handleCompositionStart,
    handleCompositionEnd,
    handleChange,
    handleSelect,
    resetTrigger,
  };
}
