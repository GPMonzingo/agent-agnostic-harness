import * as fs from 'fs';
import * as path from 'path';

// Define typed structures for Aconex API Data Contracts
export interface AconexDocument {
  documentId: string;
  documentNo: string;
  title: string;
  revision: string;
  discipline: string;
  status: string;
  uploadDate: string;
}

export interface DocumentUploadMetadata {
  docNo: string;
  title: string;
  revision: string;
  discipline: string; // e.g., 'Mechanical', 'Structural'
  status: string;     // e.g., 'For Approval', 'Issued for Construction'
}

export class AconexClient {
  private baseUrl: string;
  private apiKey: string;
  private authHeaderValue: string;

  constructor(baseUrl: string, apiKey: string, base64Credentials: string) {
    this.baseUrl = baseUrl.replace(/\/\$/, ''); // Strip trailing slash
    this.apiKey = apiKey;
    this.authHeaderValue = `Basic ${base64Credentials}`;
  }

  /**
   * Helper to construct standard Aconex request headers
   */
  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': this.authHeaderValue,
      'X-Application-Key': this.apiKey,
      'Accept': 'application/json'
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /**
   * FETCH Documents from the Registry
   */
  async getDocuments(projectId: string, searchTerms?: string): Promise<AconexDocument[]> {
    let url = `${this.baseUrl}/api/projects/${projectId}/register`;
    if (searchTerms) {
      url += `?search=${encodeURIComponent(searchTerms)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Aconex Fetch Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Maps Aconex typical list envelopes down to pure typed interfaces
    return data.results || [];
  }

  /**
   * PUSH Documents via Multipart Form Data into the Registry
   */
  async pushDocument(projectId: string, filePath: string, metadata: DocumentUploadMetadata): Promise<AconexDocument> {
    const url = `${this.baseUrl}/api/projects/${projectId}/register`;
    
    // Create native Form Data structure to isolate binary fields vs json params
    const formData = new FormData();
    
    // Append the file payload metadata strings
    formData.append('docNo', metadata.docNo);
    formData.append('title', metadata.title);
    formData.append('revision', metadata.revision);
    formData.append('discipline', metadata.discipline);
    formData.append('status', metadata.status);

    // Read file binary stream and append to multipart payload
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    
    formData.append('file', fileBlob, fileName);

    // Fetch handles standard multipart headers automatically when boundary flags aren't hardcoded
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(), // Do NOT pass 'multipart/form-data' explicitly here, fetch will auto-infer boundary
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Aconex Upload Failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as AconexDocument;
  }
}