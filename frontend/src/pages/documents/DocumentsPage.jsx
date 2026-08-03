import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFile, FiFolder, FiUploadCloud, FiX, FiCheck, FiTrash2, FiDownload, FiSearch, FiClock, FiTag, FiRotateCcw } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState('General');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null); // for version history
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form State
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docFolder, setDocFolder] = useState('General');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(2500000);
  const [docTags, setDocTags] = useState('contracts, q3');

  // Fetch Documents
  const { data: docsResponse, isLoading } = useQuery({
    queryKey: ['documents', selectedFolder],
    queryFn: async () => {
      const response = await apiClient.get('/documents/', {
        params: { folder: selectedFolder }
      });
      return response.data;
    }
  });
  const documents = docsResponse?.data || [];

  // Create Document Mutation
  const uploadDocMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/documents/', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document uploaded and registered successfully!');
      setIsUploadOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to upload document');
    }
  });

  // Delete Document Mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId) => {
      const response = await apiClient.delete(`/documents/${docId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document removed from archives.');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err) => {
      toast.error('Failed to delete document.');
    }
  });

  const resetForm = () => {
    setDocTitle('');
    setDocDesc('');
    setDocFolder('General');
    setFileName('');
    setFileSize(2500000);
    setDocTags('contracts, q3');
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!fileName) {
      toast.error('Choose a file to upload.');
      return;
    }
    uploadDocMutation.mutate({
      title: docTitle,
      description: docDesc,
      folder: docFolder,
      file_name: fileName,
      file_type: fileName.split('.').pop() || 'pdf',
      file_size: fileSize,
      tags: docTags
    });
  };

  const handleRestoreVersion = (versionNum) => {
    toast.success(`Document restored to Version ${versionNum}!`);
    setIsHistoryOpen(false);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Secure Archives</h1>
            <p className="text-slate-350 mt-2 text-sm max-w-xl">
              Upload customer contracts, agreements, certification logs, and version control audit trails.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
          >
            <FiUploadCloud />
            <span>Upload Document</span>
          </motion.button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Folders Menu */}
        <div className="w-full lg:w-60 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2.5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Folders</h4>
          <div className="space-y-1">
            {['General', 'Contracts', 'Agreements', 'Invoices', 'Other'].map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider w-full text-left transition-colors ${
                  selectedFolder === folder
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-bold'
                    : 'bg-transparent text-slate-655 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FiFolder className="text-base" />
                <span>{folder}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Files Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{selectedFolder} Directory</h3>
            <span className="text-xs text-slate-400 font-semibold">{documents.length} files archived</span>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
          ) : documents.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FiFile className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-350">No documents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 flex items-start gap-4 hover:shadow-sm transition-all">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-lg"><FiFile className="text-2xl" /></div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600" onClick={() => { setSelectedDoc(doc); setIsHistoryOpen(true); }}>{doc.title}</h4>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedDoc(doc); setIsHistoryOpen(true); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded" title="Version Control"><FiClock /></button>
                        <button onClick={() => deleteDocMutation.mutate(doc.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded"><FiTrash2 /></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{doc.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/45 text-[10px] font-semibold text-indigo-600"><FiTag /> critical</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500">v2.0</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
                      <span>{doc.file_name} ({formatBytes(doc.file_size)})</span>
                      <a href={doc.file_url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline font-bold"><FiDownload /> Get File</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD DOCUMENT MODAL */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsUploadOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Upload New Document</h3>
                <button onClick={() => setIsUploadOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Document Title *</label>
                  <input type="text" required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Lease Agreement Q3" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Archive Folder</label>
                    <select value={docFolder} onChange={(e) => setDocFolder(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                      <option value="General">General</option>
                      <option value="Contracts">Contracts</option>
                      <option value="Agreements">Agreements</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Tags (comma separated)</label>
                    <input type="text" value={docTags} onChange={(e) => setDocTags(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Choose File (Simulated) *</label>
                  <input type="text" required value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. lease_agreement_3.pdf" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsUploadOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">Save File</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VERSION HISTORY MODAL */}
      <AnimatePresence>
        {isHistoryOpen && selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Version Control Audit Trail</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">{selectedDoc.title}</p>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  {[
                    { version: 'v2.0 (Active)', author: 'Admin User', date: 'Oct 28, 2026 14:32', size: '1.4 MB' },
                    { version: 'v1.1', author: 'Ramesh K.', date: 'Oct 15, 2026 09:12', size: '1.2 MB' },
                    { version: 'v1.0', author: 'Onboarding System', date: 'Sep 30, 2026 11:00', size: '1.0 MB' }
                  ].map((v, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-850 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{v.version}</div>
                        <div className="text-[10px] text-slate-400">{v.date} | Uploaded by {v.author}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{v.size}</span>
                        {i > 0 && (
                          <button onClick={() => handleRestoreVersion(2 - i + 1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 rounded flex items-center gap-1 font-semibold" title="Restore this version">
                            <FiRotateCcw /> Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
