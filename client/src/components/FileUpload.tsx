import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CloudUpload, FileText, Loader2 } from "lucide-react";
import { uploadDocument, createDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onDocumentCreated: (documentId: number) => void;
}

export function FileUpload({ onDocumentCreated }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const document = await uploadDocument(file);
      onDocumentCreated(document.id);
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded and is ready for analysis.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) {
      toast({
        title: "No content",
        description: "Please enter some text to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const document = await createDocument({
        title: "Pasted Document",
        content: textContent,
      });
      onDocumentCreated(document.id);
      setTextContent("");
      toast({
        title: "Document created successfully",
        description: "Your text has been saved and is ready for analysis.",
      });
    } catch (error) {
      console.error("Create error:", error);
      toast({
        title: "Failed to create document",
        description: error instanceof Error ? error.message : "Failed to create document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-8">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Upload Area */}
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-semibold mb-6 text-[#c7d3d9]">Upload Your Document</h3>
            
            {/* File Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-primary"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center">
                <CloudUpload className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2 text-[#c7d3d9]">
                  Drop your file here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports DOCX and TXT files up to 10MB
                </p>
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Choose File
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            <div className="text-center my-6">
              <span className="text-gray-500 bg-white px-4 relative">or</span>
              <hr className="border-gray-200 -mt-3 -z-10" />
            </div>

            {/* Text Input */}
            <div>
              <Label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block text-sm font-medium mb-3 text-[#c7d3d9]">
                Paste Your Contract Text
              </Label>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full h-40 resize-none"
                placeholder="Paste your contract or terms of service here..."
              />
            </div>

            <Button
              onClick={handleTextSubmit}
              className="w-full mt-6 bg-primary text-white hover:bg-primary/90"
              disabled={isUploading || !textContent.trim()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Analyze Document
            </Button>
          </div>

          {/* Features Preview */}
          <div className="lg:w-1/2">
            <h3 className="text-2xl font-semibold text-text mb-6">What You'll Get</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-secondary/10 rounded-lg">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#c7d3d9]">Plain English Summary</h4>
                  <p className="text-gray-600 text-sm">
                    Complex legal jargon translated into clear, understandable language
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-4 bg-warning/10 rounded-lg">
                <div className="w-8 h-8 bg-warning rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div>
                  <h4 className="font-semibold text-text mb-1">Red Flag Detection</h4>
                  <p className="text-gray-600 text-sm">
                    Automatically identify concerning clauses and potential issues
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-4 bg-primary/10 rounded-lg">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-text mb-1">Key Points Breakdown</h4>
                  <p className="text-gray-600 text-sm">
                    Important terms and conditions highlighted and explained
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-4 bg-secondary/10 rounded-lg">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <CloudUpload className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-text mb-1">Export Summary</h4>
                  <p className="text-gray-600 text-sm">
                    Download your analysis as PDF or share with others
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
