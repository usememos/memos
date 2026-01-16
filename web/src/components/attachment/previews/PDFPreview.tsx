import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  src: string;
  filename: string;
  isLoading?: boolean;
}

export function PDFPreview({ src, filename, isLoading }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF load error:", err);
    setError(err.message);
    setPdfLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <p className="text-muted-foreground text-center">Failed to load PDF: {error}</p>
        <div className="flex items-center gap-3">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Open in new tab
          </a>
          <a
            href={src}
            download={filename}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : "Loading..."}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={scale <= 0.5} className="p-1.5 rounded hover:bg-accent disabled:opacity-30" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 3} className="p-1.5 rounded hover:bg-accent disabled:opacity-30" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Download */}
        <a
          href={src}
          download={filename}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
          title="Download PDF"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto flex justify-center bg-muted/20 p-4">
        <Document
          file={src}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          }
          className="flex justify-center"
        >
          {!pdfLoading && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className="shadow-lg"
              loading={
                <div className="flex items-center justify-center h-64 w-48">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              }
            />
          )}
        </Document>
      </div>
    </div>
  );
}
