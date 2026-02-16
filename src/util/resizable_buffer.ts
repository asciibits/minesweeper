/**
 * Following adds resizable capabilities to TypeScript's ArrayBuffer. It's not
 * perfect, but it gets the job done for now until
 * https://github.com/microsoft/TypeScript/pull/54637 is resolved.
 */
// eslint-disable-next-line max-len
export interface ResizableArrayBufferConstructor extends ArrayBufferConstructor {
  readonly prototype: ResizableArrayBuffer;
  new (
    byteLength: number,
    options: {maxByteLength: number},
  ): ResizableArrayBuffer;
  new (byteLength: number): ResizableArrayBuffer;
}
export interface ResizableArrayBuffer extends ArrayBuffer {
  maxByteLength: number;
  resizable: boolean;
  resize: (newLength: number) => void;
}
export const ArrBuffer = ArrayBuffer as ResizableArrayBufferConstructor;
