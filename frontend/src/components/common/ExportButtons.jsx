import { useState } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import apiClient from '../../api/client';

export default function ExportButtons({ 
  reportType, 
  reportData, 
  filters = {},
  className = '' 
}) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState(null);

  const handleExport = async (format) => {
    setExporting(true);
    setExportType(format);

    try {
      const endpoint = `/api/v1/reports/export/${format}`;
      const payload = {
        report_type: reportType,
        data: reportData,
        filters: filters,
      };

      const response = await apiClient.post(endpoint, payload, {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Export to ${format.toUpperCase()} failed:`, error);
      alert(`Failed to export report as ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <button
        onClick={() => handleExport('pdf')}
        disabled={exporting}
        className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-150 shadow-sm hover:shadow-md"
        title="Export as PDF"
      >
        <FiFileText className="w-4 h-4" />
        <span>{exporting && exportType === 'pdf' ? 'Exporting...' : 'PDF'}</span>
      </button>

      <button
        onClick={() => handleExport('excel')}
        disabled={exporting}
        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-150 shadow-sm hover:shadow-md"
        title="Export as Excel"
      >
        <FiFile className="w-4 h-4" />
        <span>{exporting && exportType === 'excel' ? 'Exporting...' : 'Excel'}</span>
      </button>
    </div>
  );
}
