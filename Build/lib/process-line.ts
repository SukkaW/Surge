import { TransformStream } from 'node:stream/web';

export function processLine(line: string): string | null {
  const trimmed: string = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const line_0 = trimmed.charCodeAt(0);

  if (
    // line_0 === 32 /** [space] */
    // || line_0 === 13 /** \r */
    // || line_0 === 10 /** \n */
    line_0 === 33 /** ! */
    || (line_0 === 47 /** / */ && trimmed.charCodeAt(1) === 47 /** / */)
  ) {
    return null;
  }

  if (line_0 === 35 /** # */) {
    if (trimmed.charCodeAt(1) !== 35 /** # */) {
      // # Comment
      return null;
    }
    if (trimmed.charCodeAt(2) === 35 /** # */ && trimmed.charCodeAt(3) === 35) {
      // ################## EOF ##################
      return null;
    }
    /**
     * AdGuard Filter can be:
     *
     * ##.class
     * ##tag.class
     * ###id
     */
  }

  return trimmed;
}

export class ProcessLineStream extends TransformStream<string, string> {
  // private __buf = '';
  constructor() {
    super({
      transform(l, controller) {
        const line = processLine(l);
        if (line) {
          controller.enqueue(line);
        }
      }
    });
  }
}

// export class ProcessLineNodeStream extends Transform {
//   _transform(chunk: string, encoding: BufferEncoding, callback: TransformCallback) {
//     // Convert chunk to string and then to uppercase
//     const upperCased = chunk.toUpperCase();
//     // Push transformed data to readable side
//     this.push(upperCased);
//     // Call callback when done
//     callback();
//   }
// }
