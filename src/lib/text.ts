// Strips unpaired UTF-16 surrogate code units (e.g. from truncated emoji in
// tweet text) that would otherwise make the Anthropic API reject the request
// body with "no low surrogate in string".
export function stripLoneSurrogates(input: string): string {
  return input.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
}
