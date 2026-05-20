const MAX_MESSAGE_LENGTH = 4000;

export function validateUserMessage(message: unknown) {
  if (typeof message !== "string" || message.trim().length === 0) {
    return { ok: false as const, status: 400, message: "请输入问题。" };
  }

  const value = message.trim();

  if (value.length > MAX_MESSAGE_LENGTH) {
    return { ok: false as const, status: 400, message: "单次提问不能超过 4000 个字符。" };
  }

  return { ok: true as const, value };
}
