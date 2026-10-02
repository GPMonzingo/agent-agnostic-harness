// test-runner.ts

import { AconexClient } from "../clients/AconexClient";

async function executeLocalPipelineTest() {
  // Point target location at local running mock server instantiation
  const client = new AconexClient('http://localhost:3001', 'mock-app-key-123', 'dXNlcjpwYXNz');
  
  console.log("--- Fetching current registry files ---");
  const docsBefore = await client.getDocuments('PROJ-001');
  console.log(docsBefore);

  console.log("\n--- Testing push file pipeline ---");
  // Ensure 'sample.pdf' exists in directory path root before initialization
  const uploadedDoc = await client.pushDocument('PROJ-001', './sample.pdf', {
    docNo: '2026-MECH-099',
    title: 'HVAC Venting Structural Path Schematic',
    revision: 'B',
    discipline: 'Mechanical',
    status: 'Issued for Construction'
  });
  console.log("Success! Server returned registered item context:", uploadedDoc);
}