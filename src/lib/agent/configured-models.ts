export interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

export function getConfiguredModels(): ModelOption[] {
  const models: ModelOption[] = [];

  if (process.env.OPENAI_API_KEY) {
    const defaultModel = process.env.OPENAI_MODEL || "Qwen3.5-35B-A3B";
    models.push({
      value: defaultModel,
      label: defaultModel,
      provider: "openai",
    });
  }

  return models.length > 0 ? models : [
    { value: "Qwen3.5-35B-A3B", label: "Qwen3.5-35B-A3B", provider: "openai" },
  ];
}
