const PII_PATTERNS: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  {
    pattern: /1[3-9]\d{9}/g,
    label: "phone",
    replacement: "[PHONE_REDACTED]",
  },
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    label: "email",
    replacement: "[EMAIL_REDACTED]",
  },
  {
    pattern: /\b\d{6}(18|19|20)?\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    label: "id_card",
    replacement: "[ID_CARD_REDACTED]",
  },
  {
    pattern: /[^\u0000-\u007F]{2,4}(银行|银行账户|银行卡|卡号|账号)[：:\s]*\d{10,25}/g,
    label: "bank_account",
    replacement: "[BANK_ACCOUNT_REDACTED]",
  },
];

const SENSITIVE_KEYWORDS = [
  "密码", "口令", "password", "passwd", "secret",
  "私钥", "private.key", "token",
  "身份证号", "社保号",
];

export interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: string[];
  sanitizedContent: string;
}

export function detectPII(content: string): PIIDetectionResult {
  const detectedTypes: string[] = [];
  let sanitized = content;

  for (const { pattern, label } of PII_PATTERNS) {
    if (pattern.test(content)) {
      detectedTypes.push(label);
    }
    pattern.lastIndex = 0;
  }

  for (const keyword of SENSITIVE_KEYWORDS) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      if (!detectedTypes.includes("sensitive_keyword")) {
        detectedTypes.push("sensitive_keyword");
      }
      break;
    }
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
    sanitizedContent: sanitized,
  };
}

export function sanitizePII(content: string): string {
  let sanitized = content;

  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
    pattern.lastIndex = 0;
  }

  return sanitized;
}

export function shouldEncrypt(content: string): boolean {
  const result = detectPII(content);
  return result.hasPII;
}
