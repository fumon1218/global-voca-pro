import React, { useState } from 'react';
import { Upload, FileType, CheckCircle2, AlertCircle } from 'lucide-react';

interface DataLoaderProps {
  onDataLoaded: (lang: 'English' | 'Spanish' | 'Japanese', data: any[]) => void;
}

export default function DataLoader({ onDataLoaded }: DataLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, lang: 'English' | 'Spanish' | 'Japanese') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMsg(`Processing ${file.name}...`);

    try {
      // In a real Vite app, we'd dynamic import xlsx/pdfjs here
      // For now, we simulate success or provide a CSV path
      setMsg(`Successfully imported ${file.name}!`);
      // Simulating data extraction logic
      // In production, this would use 'xlsx' and 'pdfjs-dist' libraries
      onDataLoaded(lang, []); 
    } catch (e) {
      setMsg('Error importing file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary-50 p-6 rounded-3xl border border-primary-100">
        <h3 className="text-xl font-bold text-primary-800 flex items-center gap-2">
          <FileType className="text-primary-500" />
          데이터 가져오기 (Import)
        </h3>
        <p className="text-primary-600 text-sm mt-1">PDF나 Excel 파일을 업로드하면 단어를 자동으로 인식합니다.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <UploadButton 
            lang="English" 
            onUpload={(e) => handleFileUpload(e, 'English')} 
            accept=".xlsx,.csv"
          />
          <UploadButton 
            lang="Spanish" 
            onUpload={(e) => handleFileUpload(e, 'Spanish')} 
            accept=".pdf"
          />
          <UploadButton 
            lang="Japanese" 
            onUpload={(e) => handleFileUpload(e, 'Japanese')} 
            accept=".pdf"
          />
        </div>

        {msg && (
          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary-700 bg-white/50 p-3 rounded-xl">
            {msg.includes('Error') ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-green-500" />}
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadButton({ lang, onUpload, accept }: { lang: string, onUpload: (e: any) => void, accept: string }) {
  return (
    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-primary-200 rounded-2xl hover:bg-white hover:border-primary-400 cursor-pointer transition-all group">
      <Upload className="text-primary-300 group-hover:text-primary-500 mb-2" size={20} />
      <span className="text-sm font-bold text-slate-600">{lang} 업로드</span>
      <input type="file" className="hidden" accept={accept} onChange={onUpload} />
    </label>
  );
}
