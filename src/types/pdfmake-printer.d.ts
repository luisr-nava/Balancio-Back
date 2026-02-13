declare module 'pdfmake' {
  import type { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
  import type PDFKit from 'pdfkit';

  class PdfPrinter {
    constructor(fontDescriptors: TFontDictionary);
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
      options?: PDFKit.PDFDocumentOptions,
    ): PDFKit.PDFDocument;
  }

  export default PdfPrinter;
}
