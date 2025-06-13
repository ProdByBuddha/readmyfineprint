import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CloudUpload, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { uploadDocument, createDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAccessibility } from "@/hooks/useAccessibility";

interface FileUploadProps {
  onDocumentCreated: (documentId: number) => void;
  disabled?: boolean;
  consentAccepted?: boolean;
}

export function FileUpload({ onDocumentCreated, disabled = false, consentAccepted = false }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { announce } = useAccessibility();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['.docx', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (file.size > maxSize) {
      return "File size must be less than 10MB";
    }

    if (!allowedTypes.includes(fileExtension)) {
      return "Only DOCX and TXT files are supported";
    }

    return null;
  };

  const handleFileUpload = async (file: File) => {
    if (!file || disabled) return;

    // Clear previous states
    setUploadError(null);
    setUploadSuccess(false);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      announce(validationError, 'assertive');
      toast({
        title: "Invalid file",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    announce("Uploading file, please wait...", 'polite');

    try {
      const document = await uploadDocument(file);
      onDocumentCreated(document.id);
      setUploadSuccess(true);
      announce(`File ${file.name} uploaded successfully`, 'polite');
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded and is ready for analysis.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      setUploadError(errorMessage);
      announce(`Upload failed: ${errorMessage}`, 'assertive');
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (disabled) return;

    // Clear previous states
    setUploadError(null);
    setUploadSuccess(false);

    if (!textContent.trim()) {
      const errorMessage = "Please enter some text to analyze.";
      setUploadError(errorMessage);
      announce(errorMessage, 'assertive');
      toast({
        title: "No content",
        description: errorMessage,
        variant: "destructive",
      });
      textareaRef.current?.focus();
      return;
    }

    setIsUploading(true);
    announce("Creating document from text, please wait...", 'polite');

    try {
      const document = await createDocument({
        title: "Pasted Document",
        content: textContent,
      });
      onDocumentCreated(document.id);
      setTextContent("");
      setUploadSuccess(true);
      announce("Document created successfully from pasted text", 'polite');
      toast({
        title: "Document created successfully",
        description: "Your text has been saved and is ready for analysis.",
      });
    } catch (error) {
      console.error("Create error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create document";
      setUploadError(errorMessage);
      announce(`Document creation failed: ${errorMessage}`, 'assertive');
      toast({
        title: "Failed to create document",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <Card className={`p-8 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <CardContent className="p-0">
        {!consentAccepted && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Consent Required:</strong> To analyze documents, please accept the terms and privacy policy using the banner below.
              You can still browse sample contracts without consent.
            </p>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Upload Area */}
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-semibold mb-6 text-[#c7d3d9]">Upload Your Document</h3>

            {/* File Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : uploadError
                  ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-950/20"
                  : uploadSuccess
                  ? "border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-950/20"
                  : "border-gray-300 hover:border-primary"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleKeyDown}
              tabIndex={0}
              role="button"
              aria-label="Upload file area. Press Enter or Space to browse for files, or drag and drop files here."
              aria-describedby="file-upload-description file-upload-status"
              aria-invalid={uploadError ? 'true' : 'false'}
            >
              <div className="flex flex-col items-center">
                {uploadError ? (
                  <AlertCircle className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />
                ) : uploadSuccess ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mb-4" aria-hidden="true" />
                ) : (
                  <CloudUpload className="w-12 h-12 text-gray-400 mb-4" aria-hidden="true" />
                )}
                <p className="text-lg font-medium mb-2 text-[#c7d3d9]">
                  {uploadError ? "Upload Failed" : uploadSuccess ? "Upload Successful" : "Drop your file here or click to browse"}
                </p>
                <p id="file-upload-description" className="text-sm text-gray-500 mb-4">
                  Supports DOCX and TXT files up to 10MB
                </p>
                {uploadError && (
                  <p id="file-upload-error" className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
                    {uploadError}
                  </p>
                )}
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={isUploading}
                  aria-describedby="file-upload-description"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                      Choose File
                    </>
                  )}
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              aria-describedby="file-upload-description"
            />

            <div className="text-center my-6" role="separator" aria-label="Alternative upload method">
              <span className="text-gray-500 bg-white px-4 relative">or</span>
              <hr className="border-gray-200 -mt-3 -z-10" aria-hidden="true" />
            </div>

            {/* Text Input */}
            <div>
              <Label 
                htmlFor="contract-text"
                className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block text-sm font-medium mb-3 text-gray-700 dark:text-[#c7d3d9]"
              >
                Paste Your Contract Text
              </Label>
              <Textarea
                id="contract-text"
                ref={textareaRef}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full h-40 resize-none"
                placeholder="Paste your contract or terms of service here..."
                aria-describedby="text-input-description"
                aria-invalid={uploadError && textContent.trim() === '' ? 'true' : 'false'}
              />
              <p id="text-input-description" className="text-xs text-gray-500 mt-2">
                You can paste any contract or legal document text here for analysis.
              </p>
            </div>

            <Button
              onClick={handleTextSubmit}
              className="w-full mt-6 bg-primary text-white hover:bg-primary/90"
              disabled={isUploading || !textContent.trim()}
              aria-describedby="text-submit-description"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                  Analyze Document
                </>
              )}
            </Button>
            <p id="text-submit-description" className="text-xs text-gray-500 mt-2 text-center">
              Click to analyze the pasted text content
            </p>
          </div>

          {/* Features Preview */}
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-[#c7d3d9]">What You'll Get</h3>
            <div className="space-y-4" role="list" aria-label="Analysis features">
              <div className="flex items-start space-x-4 p-4 bg-secondary/10 rounded-lg" role="listitem">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-gray-900 dark:text-[#c7d3d9]">Plain English Summary</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Complex legal jargon translated into clear, understandable language
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4 p-4 bg-secondary/10 rounded-lg" role="listitem">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-gray-900 dark:text-[#c7d3d9]">Key Risk Highlights</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Important clauses and potential issues flagged for your attention
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4 p-4 bg-secondary/10 rounded-lg" role="listitem">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-gray-900 dark:text-[#c7d3d9]">Actionable Insights</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Specific recommendations and things to watch out for
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Screen reader status updates */}
        <div id="file-upload-status" className="sr-only" aria-live="polite" aria-atomic="true">
          {isUploading && "File upload in progress"}
          {uploadSuccess && "File uploaded successfully"}
          {uploadError && `Upload error: ${uploadError}`}
        </div>
      </CardContent>
    </Card>
  );
}
