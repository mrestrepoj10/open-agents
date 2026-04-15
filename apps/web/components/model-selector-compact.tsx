"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDown } from "lucide-react";
import {
  buildCodexTabModelOptions,
  type ModelOption,
} from "@/lib/model-options";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ModelSelectorCompactProps {
  value: string;
  modelOptions: ModelOption[];
  onChange: (modelId: string) => void;
  openAIAuthSource?: "gateway" | "codex-subscription";
  disabled?: boolean;
  onCloseAutoFocus?: () => void;
}

function isOpenAIModel(option: ModelOption | undefined): boolean {
  return option?.provider === "openai";
}

function renderOpenAIBadgeLabel(source: "gateway" | "codex-subscription") {
  return source === "codex-subscription" ? "Codex" : "Gateway";
}

function OpenAIAuthSourceBadge({
  source,
}: {
  source: "gateway" | "codex-subscription";
}) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
      {renderOpenAIBadgeLabel(source)}
    </span>
  );
}

export function ModelSelectorCompact({
  value,
  modelOptions,
  onChange,
  openAIAuthSource = "gateway",
  disabled = false,
  onCloseAutoFocus,
}: ModelSelectorCompactProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "codex">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const codexModelOptions = useMemo(
    () => buildCodexTabModelOptions(modelOptions),
    [modelOptions],
  );
  const activeModelOptions =
    activeTab === "codex" ? codexModelOptions : modelOptions;

  const focusSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    focusSearchInput();
  }, [focusSearchInput, open]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isModelShortcut =
        event.metaKey &&
        event.altKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        event.code === "Slash";

      if (!isModelShortcut || event.repeat) {
        return;
      }

      event.preventDefault();
      setSearch("");
      setOpen(true);
      focusSearchInput();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, focusSearchInput]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setSearch("");
    setOpen(false);
  };

  const selectedOption = useMemo(() => {
    return (
      modelOptions.find((option) => option.id === value) ??
      codexModelOptions.find((option) => option.id === value)
    );
  }, [codexModelOptions, modelOptions, value]);
  const displayText = selectedOption?.label ?? value;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
          setActiveTab("all");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Change model"
          aria-keyshortcuts="Meta+Alt+/"
          title="Change model (⌘⌥/)"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="max-w-[140px] truncate">{displayText}</span>
          {isOpenAIModel(selectedOption) ? (
            <OpenAIAuthSourceBadge source={openAIAuthSource} />
          ) : null}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusSearchInput();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus?.();
        }}
      >
        <Command>
          <CommandInput
            ref={searchInputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Search models..."
          />
          <div className="border-b px-2 py-2">
            <Tabs
              value={activeTab}
              onValueChange={(nextValue) => {
                if (nextValue === "all" || nextValue === "codex") {
                  setActiveTab(nextValue);
                }
              }}
            >
              <TabsList className="grid h-8 w-full grid-cols-2">
                <TabsTrigger value="all" className="text-xs">
                  All Models
                </TabsTrigger>
                <TabsTrigger value="codex" className="text-xs">
                  Codex
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup>
              {activeModelOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.id} ${option.description ?? ""} ${
                    isOpenAIModel(option)
                      ? renderOpenAIBadgeLabel(openAIAuthSource)
                      : ""
                  }`}
                  onSelect={() => handleSelect(option.id)}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{option.label}</span>
                      {isOpenAIModel(option) ? (
                        <OpenAIAuthSourceBadge source={openAIAuthSource} />
                      ) : null}
                      {option.isVariant && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          variant
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {option.description ?? option.id}
                    </p>
                  </div>
                  {option.id === APP_DEFAULT_MODEL_ID && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      default
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
