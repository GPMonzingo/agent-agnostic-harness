import express, { Request, Response } from 'express';
import multer from 'multer';
import { AconexDocument } from '../clients/AconexClient';

const app = express();
const port = 3001;

// Configure disk or memory-based file multi-part parsing middleware
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// In-Memory Database State for Mock environment verification
const mockDocumentDatabase: Record<string, AconexDocument[]> = {
  "PROJ-001": [
    {
      documentId: "DOC-9981",
      documentNo: "001-ARCH-DWG-001",
      title: "Ground Floor Layout Design Plan",
      revision: "A",
      discipline: "Architectural",
      status: "For Approval",
      uploadDate: new Date().toISOString()
    }
  ]
};

/**
 * Authentication Validator Middleware Mimicking Gateway Key Checks
 */
const validateAconexHeaders = (req: Request, res: Response, next: () => void) => {
  const apiKey = req.header('X-Application-Key');
  const auth = req.header('Authorization');

  if (!apiKey || !auth) {
     res.status(401).json({ error: "Missing authenticating parameters 'X-Application-Key' or 'Authorization'." });
     return;
  }
  next();
};

app.use(validateAconexHeaders);

/**
 * MOCK ENDPOINT: GET Documents
 */
app.get('/api/projects/:projectId/register', (req: Request, res: Response) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const searchQuery = req.query.search as string;

  const projectDocs = mockDocumentDatabase[projectId] || [];

  if (searchQuery) {
    const filtered = projectDocs.filter(doc => 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      doc.documentNo.toLowerCase().includes(searchQuery.toLowerCase())
    );
     res.json({ results: filtered });
     return;
  }

   res.json({ results: projectDocs });
});

/**
 * MOCK ENDPOINT: POST (Push) Document Multi-part
 */
app.post('/api/projects/:projectId/register', upload.single('file'), (req: Request, res: Response) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  
  // Extract form input strings populated alongside file
  const { docNo, title, revision, discipline, status } = req.body;

  if (!req.file) {
     res.status(400).json({ error: "Multi-part processing exception: Primary multipart file asset missing." });
     return;
  }

  if (!docNo || !title) {
     res.status(400).json({ error: "Missing required core meta parameter elements 'docNo' or 'title'." });
     return;
  }

  // Map simulated cloud storage write lifecycle
  const newUploadedDocument: AconexDocument = {
    documentId: `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
    documentNo: docNo,
    title: title,
    revision: revision || "1",
    discipline: discipline || "General",
    status: status || "Draft",
    uploadDate: new Date().toISOString()
  };

  // Push to local database instance tracker arrays
  if (!mockDocumentDatabase[projectId]) {
    mockDocumentDatabase[projectId] = [];
  }
  mockDocumentDatabase[projectId].push(newUploadedDocument);

  console.log(`[Mock Server Log] Successfully accepted file upload: ${req.file.originalname} (${req.file.size} bytes)`);

  res.status(201).json(newUploadedDocument);
});

app.listen(port, () => {
  console.log(`🚀 Mock Aconex Instance API listening natively at http://localhost:${port}`);
});