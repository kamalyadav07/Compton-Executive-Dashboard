import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileCheck2, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  ShieldCheck,
  Layers
} from 'lucide-react';
import { parseExcelFile, validateAndSanitizeData } from '../../engine/dataParser';
import type { DealRecord, UploadValidationReport } from '../../types/sales';

interface FileUploadSectionProps {
  onDataLoaded: (won: DealRecord[], lost: DealRecord[], progress: DealRecord[], report: UploadValidationReport) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onDataLoaded,
  isLoading,
  setIsLoading
}) => {
  const [wonFile, setWonFile] = useState<File | null>(null);
  const [lostFile, setLostFile] = useState<File | null>(null);
  const [progressFile, setProgressFile] = useState<File | null>(null);

  const [wonParsed, setWonParsed] = useState<DealRecord[]>([]);
  const [lostParsed, setLostParsed] = useState<DealRecord[]>([]);
  const [progressParsed, setProgressParsed] = useState<DealRecord[]>([]);

  const [uploadReport, setUploadReport] = useState<UploadValidationReport | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'won' | 'lost' | 'progress'>('won');

  const handleFileUpload = async (file: File, type: 'won' | 'lost' | 'in_progress') => {
    setIsLoading(true);
    try {
      const { records } = await parseExcelFile(file, type);
      
      let newWon = wonParsed;
      let newLost = lostParsed;
      let newProgress = progressParsed;

      if (type === 'won') {
        setWonFile(file);
        setWonParsed(records);
        newWon = records;
      } else if (type === 'lost') {
        setLostFile(file);
        setLostParsed(records);
        newLost = records;
      } else if (type === 'in_progress') {
        setProgressFile(file);
        setProgressParsed(records);
        newProgress = records;
      }

      const { report } = validateAndSanitizeData(newWon, newLost, newProgress);
      setUploadReport(report);
      onDataLoaded(newWon, newLost, newProgress, report);
    } catch (err: any) {
      console.error("Error parsing file:", err);
      alert("Error reading Excel file. Please ensure it is a valid .xlsx or .xls file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = (type: 'won' | 'lost' | 'progress') => {
    let newWon = wonParsed;
    let newLost = lostParsed;
    let newProgress = progressParsed;

    if (type === 'won') {
      setWonFile(null);
      setWonParsed([]);
      newWon = [];
    } else if (type === 'lost') {
      setLostFile(null);
      setLostParsed([]);
      newLost = [];
    } else if (type === 'progress') {
      setProgressFile(null);
      setProgressParsed([]);
      newProgress = [];
    }

    const { report } = validateAndSanitizeData(newWon, newLost, newProgress);
    setUploadReport(report);
    onDataLoaded(newWon, newLost, newProgress, report);
  };

  return (
    <div className="w-full glass-panel p-5 rounded-2xl border border-slate-800/90 shadow-xl mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-extrabold text-slate-100 tracking-tight">
              Upload Excel Sales Files
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload your 3 deal files: Won Deals, Lost Deals, and In Progress Deals. Column headers are detected automatically.
          </p>
        </div>

        {uploadReport && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Data</span>
            </button>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Data Loaded Successfully</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FileSlotCard
          title="1. Won Deals"
          file={wonFile}
          recordCount={wonParsed.length}
          accentColor="emerald"
          badgeText="Direct Income Valuation"
          onFileSelect={(file) => handleFileUpload(file, 'won')}
          onRemove={() => handleRemoveFile('won')}
          isLoading={isLoading}
        />

        <FileSlotCard
          title="2. Lost Deals"
          file={lostFile}
          recordCount={lostParsed.length}
          accentColor="rose"
          badgeText="Loss Reason Tracked"
          onFileSelect={(file) => handleFileUpload(file, 'lost')}
          onRemove={() => handleRemoveFile('lost')}
          isLoading={isLoading}
        />

        <FileSlotCard
          title="3. In Progress Deals"
          file={progressFile}
          recordCount={progressParsed.length}
          accentColor="blue"
          badgeText="Pipeline & Probabilities"
          onFileSelect={(file) => handleFileUpload(file, 'in_progress')}
          onRemove={() => handleRemoveFile('progress')}
          isLoading={isLoading}
        />
      </div>

      {uploadReport && (
        <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Total Won Rows</span>
            <span className="text-emerald-400 font-extrabold text-sm">{uploadReport.wonCount} records</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Total Lost Rows</span>
            <span className="text-rose-400 font-extrabold text-sm">{uploadReport.lostCount} records</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Total Pipeline Rows</span>
            <span className="text-blue-400 font-extrabold text-sm">{uploadReport.progressCount} records</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Dates Normalized</span>
            <span className="text-amber-400 font-extrabold text-sm">{uploadReport.formattedDatesNormalized} entries</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Duplicates Resolved</span>
            <span className="text-purple-400 font-extrabold text-sm">{uploadReport.duplicatesRemoved} fixed</span>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-5xl w-full border border-slate-700 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Data Quality & Data Audit Inspector</h3>
                  <p className="text-xs text-slate-400">Inspecting auto-mapped headers and clean records</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>

            <div className="flex space-x-2 my-4">
              <button
                onClick={() => setPreviewTab('won')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'won' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                Won Deals ({wonParsed.length})
              </button>
              <button
                onClick={() => setPreviewTab('lost')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'lost' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                Lost Deals ({lostParsed.length})
              </button>
              <button
                onClick={() => setPreviewTab('progress')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  previewTab === 'progress' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300'
                }`}
              >
                In Progress Deals ({progressParsed.length})
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-2">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Deal ID</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Gross Revenue</th>
                    <th className="p-2.5">GST (18%)</th>
                    <th className="p-2.5">Net Revenue</th>
                    <th className="p-2.5">Sales Rep</th>
                    <th className="p-2.5">Industry</th>
                    <th className="p-2.5">Solution</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {(previewTab === 'won' ? wonParsed : previewTab === 'lost' ? lostParsed : progressParsed).slice(0, 30).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-900/50">
                      <td className="p-2.5 font-mono text-blue-400">{r.id}</td>
                      <td className="p-2.5 text-slate-100">{r.customer}</td>
                      <td className="p-2.5">₹{r.grossRevenue.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-amber-400">₹{r.gstAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">₹{r.netRevenue.toLocaleString('en-IN')}</td>
                      <td className="p-2.5">{r.salesRep}</td>
                      <td className="p-2.5">{r.industry}</td>
                      <td className="p-2.5">{r.solution}</td>
                      <td className="p-2.5">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FileSlotCardProps {
  title: string;
  file: File | null;
  recordCount: number;
  accentColor: 'emerald' | 'rose' | 'blue';
  badgeText: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  isLoading?: boolean;
}

const FileSlotCard: React.FC<FileSlotCardProps> = ({
  title,
  file,
  recordCount,
  accentColor,
  badgeText,
  onFileSelect,
  onRemove
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const colorStyles = {
    emerald: {
      border: 'hover:border-emerald-500/50',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: 'text-emerald-400',
    },
    rose: {
      border: 'hover:border-rose-500/50',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: 'text-rose-400',
    },
    blue: {
      border: 'hover:border-blue-500/50',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: 'text-blue-400',
    }
  }[accentColor];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`relative p-4 rounded-xl border-2 border-dashed transition-all ${
        isDragOver ? 'border-blue-500 bg-blue-500/10' : file ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/40'
      } ${colorStyles.border}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-200">{title}</span>
        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-md ${colorStyles.badge}`}>
          {badgeText}
        </span>
      </div>

      {file ? (
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-3 overflow-hidden">
            <FileCheck2 className={`w-8 h-8 ${colorStyles.icon} shrink-0`} />
            <div className="truncate">
              <p className="text-xs font-bold text-slate-100 truncate">{file.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {recordCount} parsed records • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0 ml-2">
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete File"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center py-4 cursor-pointer">
          <UploadCloud className={`w-8 h-8 mb-2 ${colorStyles.icon} opacity-80 animate-bounce`} />
          <span className="text-xs font-semibold text-slate-300">Drop Excel file or click to browse</span>
          <span className="text-[10px] text-slate-500 mt-1">Supports .xlsx, .xls format</span>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};
