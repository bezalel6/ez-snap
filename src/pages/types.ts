export interface CapturedImage {
    id: string;
    dataUrl: string;
    timestamp: Date;
    uid: string;
  }
  
  export interface FilterOptions {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
  }

  export interface ConnectedUser {
    uid: string;
    connectedAt: Date;
  }

  export interface PhotoShare {
    dataUrl: string;
    timestamp: Date;
    fromClient: string;
  }
  