/**
 * Custom font model
 * @param name: string - font name
 * @param base64: string - base64 string
 * @param extension: string - font extension
 * @class CustomFont
 * @constructor
 * @example
 * const customFont = new CustomFont('Roboto', 'base64string', 'ttf');
 */
export class CustomFont {
  constructor(public name: string, public base64: string, public extension: string = 'ttf') {}
}
