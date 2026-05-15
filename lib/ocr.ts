import { createWorker } from 'tesseract.js';

export interface ScanResult {
  amounts: number[];
  total: number;
  rawText: string;
}

export const scanReceipt = async (image: string | Blob): Promise<ScanResult> => {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();

  // Extract all dollar amounts from the text
  const amountMatches = text.match(/\$?\d+\.\d{2}/g) || [];
  const amounts = amountMatches.map(match => parseFloat(match.replace('$', '')));
  
  // Find the largest amount (likely the total)
  const total = amounts.length > 0 ? Math.max(...amounts) : 0;

  return { 
    amounts, 
    total,
    rawText: text 
  };
};
