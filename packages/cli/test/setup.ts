for (const key of Object.keys(process.env)) {
  if (key.startsWith("GIT_") || key.startsWith("TLL_") || key === "CLAUDE_ENV_FILE") Reflect.deleteProperty(process.env, key);
}
