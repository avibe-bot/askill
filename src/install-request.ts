import type { ParsedSource } from './source-parser.ts';

export interface RequestedSkill {
  name: string;
  source: string;
}

export function getRequestedSkill(
  sourceInput: string,
  sourceParsed: Pick<ParsedSource, 'skillFilter'>,
  explicitSkill?: string,
): RequestedSkill | null {
  if (explicitSkill) {
    return {
      name: explicitSkill,
      source: sourceInput,
    };
  }

  if (!sourceParsed.skillFilter) {
    return null;
  }

  const selectorSuffix = `@${sourceParsed.skillFilter}`;
  const source = sourceInput.endsWith(selectorSuffix)
    ? sourceInput.slice(0, -selectorSuffix.length)
    : sourceInput;

  return {
    name: sourceParsed.skillFilter,
    source,
  };
}
