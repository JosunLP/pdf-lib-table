import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CustomFont } from '../models/CustomFont';
import { defaultDesignConfig, DesignConfig } from '../config/DesignConfig';
import { MergedCell } from '../interfaces/MergedCell';
import { TableCellStyle } from '../interfaces/TableCellStyle';
import { TableOptions } from '../interfaces/TableOptions';

/**
 * Pdf table
 * @param {TableOptions} options - Table options
 * @example
 * const pdfTable = new PdfTable({ columns: 3, rows: 3 });
 */
export class PdfTable {
  private options: TableOptions;
  private data: string[][] = [];
  private cellStyles: TableCellStyle[][] = []; // Matrix für Zellenstile
  private mergedCells: MergedCell[] = [];
  private customFont?: CustomFont;
  private designConfig: DesignConfig; // neue Eigenschaft

  constructor(options: TableOptions) {
    // Setze Default-Werte falls nicht vorhanden und mergen Designconfig
    this.options = {
      rowHeight: 20,
      colWidth: 80,
      ...options,
    };
    this.designConfig = { ...defaultDesignConfig, ...options.designConfig };
    this.initData();
  }

  private initData(): void {
    this.data = Array.from({ length: this.options.rows }, () =>
      Array(this.options.columns).fill(''),
    );
    this.cellStyles = Array.from({ length: this.options.rows }, () =>
      Array(this.options.columns).fill({}),
    );
  }

  // Methode zum Befüllen einer Zelle
  setCell(row: number, col: number, value: string): void {
    if (row < this.options.rows && col < this.options.columns) {
      this.data[row][col] = value;
    }
  }

  // Neue Methode zum Setzen eines individuellen Zellen-Stils
  setCellStyle(row: number, col: number, style: TableCellStyle): void {
    if (row < this.options.rows && col < this.options.columns) {
      this.cellStyles[row][col] = { ...this.cellStyles[row][col], ...style };
    }
  }

  // Neue Methode zum Zusammenführen von Zellen mit Validierung
  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): void {
    // Validierung: Startkoordinaten müssen kleiner/gleich Endkoordinaten sein
    if (startRow > endRow || startCol > endCol) {
      throw new Error('Ungültige Zellenkoordinaten für mergeCells');
    }
    // ...weitere Validierungen könnten hier erfolgen...
    this.mergedCells.push({ startRow, startCol, endRow, endCol });
  }

  // Methode zum Setzen eines benutzerdefinierten Fonts
  setCustomFont(font: CustomFont): void {
    if (!this.isValidBase64(font.base64)) {
      throw new Error('Ungültige Base64-Daten');
    }
    this.customFont = font;
  }

  // Methode zum Auslesen des Inhalts einer Zelle
  getCell(row: number, col: number): string {
    if (row < this.options.rows && col < this.options.columns) {
      return this.data[row][col];
    }
    throw new Error('Ungültige Zellenkoordinaten');
  }

  // Methode zum Auslesen des Stils einer Zelle
  getCellStyle(row: number, col: number): TableCellStyle {
    if (row < this.options.rows && col < this.options.columns) {
      return this.cellStyles[row][col];
    }
    throw new Error('Ungültige Zellenkoordinaten');
  }

  // Methode zum Entfernen einer Zelle
  removeCell(row: number, col: number): void {
    if (row < this.options.rows && col < this.options.columns) {
      this.data[row][col] = '';
      this.cellStyles[row][col] = {};
    } else {
      throw new Error('Ungültige Zellenkoordinaten');
    }
  }

  // Methode zum Hinzufügen einer neuen Zeile
  addRow(): void {
    this.options.rows += 1;
    this.data.push(Array(this.options.columns).fill(''));
    this.cellStyles.push(Array(this.options.columns).fill({}));
  }

  // Methode zum Hinzufügen einer neuen Spalte
  addColumn(): void {
    this.options.columns += 1;
    this.data.forEach((row) => row.push(''));
    this.cellStyles.forEach((row) => row.push({}));
  }

  // Methode zum Entfernen einer Zeile
  removeRow(row: number): void {
    if (row < this.options.rows) {
      this.data.splice(row, 1);
      this.cellStyles.splice(row, 1);
      this.options.rows -= 1;
    } else {
      throw new Error('Ungültige Zeilenkoordinate');
    }
  }

  // Methode zum Entfernen einer Spalte
  removeColumn(col: number): void {
    if (col < this.options.columns) {
      this.data.forEach((row) => row.splice(col, 1));
      this.cellStyles.forEach((row) => row.splice(col, 1));
      this.options.columns -= 1;
    } else {
      throw new Error('Ungültige Spaltenkoordinate');
    }
  }

  // Hilfsfunktion zur Validierung von Base64-Daten
  private isValidBase64(base64: string): boolean {
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return base64Regex.test(base64);
  }

  // Hilfsfunktion zur Umwandlung von Base64 in Uint8Array
  private base64ToUint8Array(base64: string): Uint8Array {
    if (!this.isValidBase64(base64)) {
      throw new Error('Ungültige Base64-Daten');
    }
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Neue Methode: Normalisierung von Farbwerten
  private normalizeColor(color: { r: number; g: number; b: number }): {
    r: number;
    g: number;
    b: number;
  } {
    return {
      r: color.r > 1 ? color.r / 255 : color.r,
      g: color.g > 1 ? color.g / 255 : color.g,
      b: color.b > 1 ? color.b / 255 : color.b,
    };
  }

  // Erzeugen eines PDF Dokuments mit der Tabelle inklusive Zell-Styling
  async toPDF(): Promise<PDFDocument> {
    const pdfDoc = await PDFDocument.create();
    let pdfFont; // Wird entweder durch CustomFont oder als Fallback gesetzt
    if (this.customFont) {
      const fontData = this.base64ToUint8Array(this.customFont.base64);
      pdfFont = await pdfDoc.embedFont(fontData, { customName: this.customFont.name });
    } else {
      // Fallback auf einen Standardfont
      pdfFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
    let page = pdfDoc.addPage();
    const { height } = page.getSize();

    // Startposition für die Tabelle
    const startX = 50;
    let currentY = height - 50;
    const { rowHeight = 20, colWidth = 80 } = this.options;

    // Iteriere über jede Zeile und Spalte
    for (let row = 0; row < this.options.rows; row++) {
      // Erzeuge neue Seite, wenn nicht genügend Platz vorhanden ist
      if (currentY - rowHeight < 50) {
        page = pdfDoc.addPage();
        currentY = page.getSize().height - 50;
      }
      let x = startX;
      for (let col = 0; col < this.options.columns; col++) {
        // Prüfe, ob diese Zelle Teil einer zusammengeführten Zelle ist
        const merged = this.mergedCells.find((mc) => mc.startRow === row && mc.startCol === col);
        // Falls zusammengeführt, berechne Gesamthöhe und Breite
        let cellWidth = colWidth;
        let cellHeight = rowHeight;
        if (merged) {
          cellWidth = colWidth * (merged.endCol - merged.startCol + 1);
          cellHeight = rowHeight * (merged.endRow - merged.startRow + 1);
        }

        // Zusammenführen des individuellen Zellenstils mit den Designdefaults
        const style = { ...this.designConfig, ...this.cellStyles[row][col] };

        // Zeichne Hintergrund, Text, Rand etc. nur für nicht übersprungene Zellen
        if (!merged || (merged && row === merged.startRow && col === merged.startCol)) {
          if (style.backgroundColor) {
            const bg = this.normalizeColor(style.backgroundColor);
            page.drawRectangle({
              x,
              y: currentY - cellHeight,
              width: cellWidth,
              height: cellHeight,
              color: rgb(bg.r, bg.g, bg.b),
            });
          }
          const fontSize = style.fontSize || 12;
          const textColor = style.fontColor || { r: 0, g: 0, b: 0 };
          const normTextColor = this.normalizeColor(textColor);
          const text = this.data[row][col];

          // Berechne Textbreite, falls möglich
          let textWidth = text.length * fontSize * 0.6;
          if (pdfFont.widthOfTextAtSize) {
            textWidth = pdfFont.widthOfTextAtSize(text, fontSize);
          }

          // Bestimme den x-Wert basierend auf der Ausrichtung
          let textX = x + 5;
          if (style.alignment === 'center') {
            textX = x + (cellWidth - textWidth) / 2;
          } else if (style.alignment === 'right') {
            textX = x + cellWidth - textWidth - 5;
          }
          // Falls ein CustomFont verfügbar ist, wird dieser genutzt
          page.drawText(text, {
            x: textX,
            y: currentY - cellHeight + (cellHeight - fontSize) / 2,
            size: fontSize,
            color: rgb(normTextColor.r, normTextColor.g, normTextColor.b),
            font: pdfFont, // undefined, wenn kein CustomFont gesetzt
          });
          if (style.borderColor && style.borderWidth) {
            const normBorderColor = this.normalizeColor(style.borderColor);
            page.drawRectangle({
              x,
              y: currentY - cellHeight,
              width: cellWidth,
              height: cellHeight,
              borderColor: rgb(normBorderColor.r, normBorderColor.g, normBorderColor.b),
              borderWidth: style.borderWidth,
              opacity: 0,
            });
          }
        }
        x += colWidth;
      }
      currentY -= rowHeight;
    }

    return pdfDoc;
  }
}
