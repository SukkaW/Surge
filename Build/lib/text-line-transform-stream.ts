// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// Modified by Sukka (https://skk.moe) to increase compatibility and performance with Bun.

import { TransformStream } from 'node:stream/web';

interface TextLineStreamOptions {
  /** Allow splitting by solo \r */
  allowCR?: boolean
}

/** Transform a stream into a stream where each chunk is divided by a newline,
 * be it `\n` or `\r\n`. `\r` can be enabled via the `allowCR` option.
 *
 * ```ts
 * const res = await fetch('https://example.com');
 * const lines = res.body!
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new TextLineStream());
 * ```
 */
export class TextLineStream extends TransformStream<string, string> {
  // private __buf = '';
  constructor({
    allowCR = false
  }: TextLineStreamOptions = {}) {
    let __buf = '';

    super({
      transform(chunk, controller) {
        chunk = __buf + chunk;

        for (; ;) {
          const lfIndex = chunk.indexOf('\n');

          if (allowCR) {
            const crIndex = chunk.indexOf('\r');

            if (
              crIndex !== -1 && crIndex !== (chunk.length - 1)
              && (lfIndex === -1 || (lfIndex - 1) > crIndex)
            ) {
              controller.enqueue(chunk.slice(0, crIndex));
              chunk = chunk.slice(crIndex + 1);
              continue;
            }
          }

          if (lfIndex !== -1) {
            let crOrLfIndex = lfIndex;
            if (chunk[lfIndex - 1] === '\r') {
              crOrLfIndex--;
            }
            controller.enqueue(chunk.slice(0, crOrLfIndex));
            chunk = chunk.slice(lfIndex + 1);
            continue;
          }

          break;
        }

        __buf = chunk;
      },
      flush(controller) {
        if (__buf.length > 0) {
          // eslint-disable-next-line sukka-ts/string/prefer-string-starts-ends-with -- performance
          if (allowCR && __buf[__buf.length - 1] === '\r') {
            controller.enqueue(__buf.slice(0, -1));
          } else {
            controller.enqueue(__buf);
          }
        }
      }
    });
  }
}
