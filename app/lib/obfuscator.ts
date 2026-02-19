/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ObfuscatorOptions {
  stringArrayEncoding: 'none' | 'base64' | 'rc4';
  stringArrayRotation: boolean;
  stringArrayShuffle: boolean;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  deadCodeInjectionThreshold: number;
  variableRenaming: 'hexadecimal' | 'mangled';
  unicodeEscapeSequence: boolean;
  disableConsoleOutput: boolean;
  selfDefending: boolean;
  compact: boolean;
  numbersToExpressions: boolean;
}

export const defaultObfuscatorOptions: ObfuscatorOptions = {
  stringArrayEncoding: 'base64',
  stringArrayRotation: true,
  stringArrayShuffle: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  deadCodeInjectionThreshold: 0.4,
  variableRenaming: 'hexadecimal',
  unicodeEscapeSequence: false,
  disableConsoleOutput: false,
  selfDefending: false,
  compact: true,
  numbersToExpressions: false,
};

export interface ObfuscationResult {
  code: string;
  timeMs: number;
  error?: string;
}

export async function obfuscateCode(
  source: string,
  options: ObfuscatorOptions
): Promise<ObfuscationResult> {
  const startTime = performance.now();

  try {
    // Dynamic import for browser build
    const JavaScriptObfuscator = (await import('javascript-obfuscator')).default;

    const obfuscatorConfig: any = {
      compact: options.compact,
      controlFlowFlattening: options.controlFlowFlattening,
      controlFlowFlatteningThreshold: options.controlFlowFlattening ? 0.75 : 0,
      deadCodeInjection: options.deadCodeInjection,
      deadCodeInjectionThreshold: options.deadCodeInjectionThreshold,
      identifierNamesGenerator: options.variableRenaming,
      numbersToExpressions: options.numbersToExpressions,
      selfDefending: options.selfDefending,
      stringArray: true,
      stringArrayEncoding: options.stringArrayEncoding === 'none' ? [] : [options.stringArrayEncoding],
      stringArrayRotate: options.stringArrayRotation,
      stringArrayShuffle: options.stringArrayShuffle,
      unicodeEscapeSequence: options.unicodeEscapeSequence,
      disableConsoleOutput: options.disableConsoleOutput,
      target: 'browser',
    };

    const result = JavaScriptObfuscator.obfuscate(source, obfuscatorConfig);
    const timeMs = performance.now() - startTime;

    return {
      code: result.getObfuscatedCode(),
      timeMs,
    };
  } catch (e: any) {
    return {
      code: '',
      timeMs: performance.now() - startTime,
      error: e.message || 'Obfuscation failed',
    };
  }
}
