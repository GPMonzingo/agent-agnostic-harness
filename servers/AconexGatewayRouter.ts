import { Router, Request, Response } from 'express';
import multer from 'multer';

export const aconexGatewayRouter = Router();

// Store temporary document files in memory buffer before pushing to Oracle
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file upload limit example
});

/**
 * Helper to dynamically extract the user's delegated OAuth token and Application key
 */
function getDelegatedHeaders(req: Request): Record<string, string> {
  const authHeader = req.header('Authorization');
  const apiKey = process.env.ACONEX_API_KEY || '';

  // Validate that M365 is passing down the user-delegated Bearer token context
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization delegation context. Expected Bearer token.');
  }

  return {
    'Authorization': authHeader, // Dynamically relays the unique user token onward
    'X-Application-Key': apiKey,
    'Accept': 'application/json'
  };
}

/**
 * M365 AGENT GATEWAY ROUTE: GET Documents from Register
 * M365 passes parameters as standard URL Query Parameters
 */
aconexGatewayRouter.get('/projects/:projectId/documents', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);
    const searchTerms = typeof req.query.search === 'string' ? req.query.search : undefined;

    // 1. Dynamic Header extraction instead of a static initialization helper
    const headers = getDelegatedHeaders(req);
    const baseUrl = process.env.ACONEX_BASE_URL || 'https://aconex.com';

    let url = `${baseUrl.replace(/\/\$/, '')}/api/projects/${projectId}/register`;
    if (searchTerms) {
      url += `?search=${encodeURIComponent(searchTerms)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`Oracle Cloud Fetch Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const documents = data.results || [];

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error: any) {
    console.error('[Gateway Fetch Exception]:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve documents from Oracle Aconex register.',
      details: error.message 
    });
  }
});

/**
 * M365 AGENT GATEWAY ROUTE: PUSH / Upload Document to Register
 * M365 passes metadata along with the parsed file object attachment payload
 */
aconexGatewayRouter.post('/projects/:projectId/documents', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { docNo, title, revision, discipline, status } = req.body;

    if (!req.file) {
      res.status(400).json({ success: false, error: 'Missing mandatory physical attachment payload "file".' });
      return;
    }

    if (!docNo || !title) {
      res.status(400).json({ success: false, error: 'Missing core mandatory parameter fields: "docNo" and "title".' });
      return;
    }

    // 2. Dynamic Header extraction for user validation
    const headers = getDelegatedHeaders(req);

    const tempMetadata = { docNo, title, revision: revision || '1', discipline: discipline || 'General', status: status || 'Draft' };
    
    const formData = new FormData();
    formData.append('docNo', tempMetadata.docNo);
    formData.append('title', tempMetadata.title);
    formData.append('revision', tempMetadata.revision);
    formData.append('discipline', tempMetadata.discipline);
    formData.append('status', tempMetadata.status);

    const fileBytes = new ArrayBuffer(req.file.buffer.byteLength);
    new Uint8Array(fileBytes).set(req.file.buffer);
    const fileBlob = new Blob([fileBytes], { type: req.file.mimetype });
    formData.append('file', fileBlob, req.file.originalname);

    const baseUrl = process.env.ACONEX_BASE_URL || 'https://aconex.com';

    const response = await fetch(`${baseUrl.replace(/\/\$/, '')}/api/projects/${projectId}/register`, {
      method: 'POST',
      headers: headers, // Pass dynamic authorization headers (Fetch automatically adds the boundary headers)
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Oracle Cloud Upload Failed: ${response.status} ${response.statusText}`);
    }

    const registeredDoc = await response.json();

    res.status(201).json({
      success: true,
      message: 'Document successfully cataloged and indexed into Oracle Aconex.',
      data: registeredDoc
    });
  } catch (error: any) {
    console.error('[Gateway Push Exception]:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to relay file insertion upstream into Oracle Aconex.',
      details: error.message
    });
  }
});