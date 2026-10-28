
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'fifth-incentive-471523-b1';
const BUCKET_NAME = `${PROJECT_ID}-rag-data`;

// 1. Pricing Manifest
const pricingDir = 'data/pricing_htmls';
const pricingManifestPath = 'data/pricing_manifest.jsonl';

if (fs.existsSync(pricingDir)) {
  const files = fs.readdirSync(pricingDir).filter(f => f.endsWith('.html'));
  const stream = fs.createWriteStream(pricingManifestPath);
  
  console.log(`Generating Pricing Manifest for ${files.length} files...`);
  
  files.forEach(file => {
    // construct GS URI
    const uri = `gs://${BUCKET_NAME}/pricing/${file}`;
    // construct ID from filename (clean)
    const id = file.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const record = {
      id: id,
      jsonData: "{}", // Required by some import modes
      content: {
        mimeType: 'text/html',
        uri: uri
      }
    };
    stream.write(JSON.stringify(record) + '\n');
  });
  stream.end();
  console.log(`Written ${pricingManifestPath}`);
}

// 2. Legal Manifest
const legalDir = 'RAG Sources';
const legalManifestPath = 'data/legal_manifest.jsonl';

if (fs.existsSync(legalDir)) {
  const files = fs.readdirSync(legalDir).filter(f => f.endsWith('.pdf'));
  const stream = fs.createWriteStream(legalManifestPath);
  
  console.log(`Generating Legal Manifest for ${files.length} files...`);
  
  files.forEach(file => {
    // construct GS URI
    const uri = `gs://${BUCKET_NAME}/legal/${file}`;
    const id = file.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const record = {
      id: id,
      jsonData: "{}", // Required
      content: {
        mimeType: 'application/pdf',
        uri: uri
      }
    };
    stream.write(JSON.stringify(record) + '\n');
  });
  stream.end();
  console.log(`Written ${legalManifestPath}`);
}

