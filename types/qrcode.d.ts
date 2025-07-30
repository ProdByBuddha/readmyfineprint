declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: {
      dark?: string;
      light?: string;
    };
  }

  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  function toDataURL(text: string, callback: (error: Error | null, url: string) => void): void;
  function toDataURL(text: string, options: QRCodeOptions, callback: (error: Error | null, url: string) => void): void;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export = QRCode;
}