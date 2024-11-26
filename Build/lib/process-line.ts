import { TransformStream } from 'node:stream/web';

export function processLine(line: string): string | null {
  if (!line) {
    return null;
  }

  const trimmed: string = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const line_0: string = trimmed[0];

  if (
    line_0 === ' '
    || line_0 === '\r'
    || line_0 === '\n'
    || line_0 === '!'
    || (line_0 === '/' && trimmed[1] === '/')
  ) {
    return null;
  }

  if (line_0 === '#') {
    if (trimmed[1] !== '#') {
      // # Comment
      return null;
    }
    if (trimmed[2] === '#' && trimmed[3] === '#') {
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
