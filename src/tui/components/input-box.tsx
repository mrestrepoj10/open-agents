import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { AutoAcceptMode } from "../types.js";

type InputBoxProps = {
  onSubmit: (value: string) => void;
  autoAcceptMode: AutoAcceptMode;
  onToggleAutoAccept: () => void;
  disabled?: boolean;
};

function getAutoAcceptLabel(mode: AutoAcceptMode): string {
  switch (mode) {
    case "off":
      return "auto-accept off";
    case "edits":
      return "auto-accept edits on";
    case "all":
      return "auto-accept all on";
  }
}

function getAutoAcceptColor(mode: AutoAcceptMode): string {
  switch (mode) {
    case "off":
      return "gray";
    case "edits":
      return "green";
    case "all":
      return "yellow";
  }
}

export function InputBox({ onSubmit, autoAcceptMode, onToggleAutoAccept, disabled = false }: InputBoxProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    // Shift+Tab to cycle auto-accept modes
    if (key.shift && key.tab) {
      onToggleAutoAccept();
    }
  });

  const handleSubmit = (submitValue: string) => {
    if (submitValue.trim() && !disabled) {
      onSubmit(submitValue.trim());
      setValue("");
    }
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Input line */}
      <Box
        borderStyle="round"
        borderColor={disabled ? "gray" : "white"}
        paddingLeft={1}
        paddingRight={1}
      >
        <Text color={disabled ? "gray" : "white"}>&gt; </Text>
        {disabled ? (
          <Text color="gray">Waiting...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder=""
          />
        )}
      </Box>

      {/* Auto-accept indicator */}
      <Box marginTop={0}>
        <Text color={getAutoAcceptColor(autoAcceptMode)}>
          ▸▸ {getAutoAcceptLabel(autoAcceptMode)}
        </Text>
        <Text color="gray"> (shift+tab to cycle)</Text>
      </Box>
    </Box>
  );
}
