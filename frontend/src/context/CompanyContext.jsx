import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';

const CompanyContext = createContext();

export function CompanyProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [company, setCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load company data from user or fetch from API
  useEffect(() => {
    if (isAuthenticated && user) {
      // Company data comes from auth response
      if (user.company) {
        setCompany(user.company);
      } else {
        // Fetch company data if not in user object
        fetchCompanyData();
      }
      
      // Fetch branches for the company
      if (user.company_id) {
        fetchBranches();
      }
      
      // Set selected branch from user or localStorage
      const savedBranchId = localStorage.getItem('selected_branch_id');
      if (savedBranchId) {
        setSelectedBranch(parseInt(savedBranchId));
      } else if (user.branch_id) {
        setSelectedBranch(user.branch_id);
        localStorage.setItem('selected_branch_id', user.branch_id.toString());
      }
    }
  }, [isAuthenticated, user]);

  const fetchCompanyData = async () => {
    if (!user?.company_id) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get(`/companies/${user.company_id}`);
      setCompany(response.data.data);
    } catch (error) {
      console.error('Failed to fetch company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    if (!user?.company_id) return;
    
    try {
      const response = await apiClient.get(`/branches?company_id=${user.company_id}`);
      setBranches(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const updateCompany = async (companyId, data) => {
    try {
      const response = await apiClient.put(`/companies/${companyId}`, data);
      setCompany(response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Failed to update company:', error);
      throw error;
    }
  };

  const uploadLogo = async (companyId, logoFile) => {
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      
      const response = await apiClient.post(`/companies/${companyId}/logo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Update company with new logo
      const updatedCompany = { ...company, logo: response.data.data.logo, logo_url: response.data.data.logo_url };
      setCompany(updatedCompany);
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to upload logo:', error);
      throw error;
    }
  };

  const deleteLogo = async (companyId) => {
    try {
      await apiClient.delete(`/companies/${companyId}/logo`);
      
      // Update company to remove logo
      const updatedCompany = { ...company, logo: null, logo_url: null };
      setCompany(updatedCompany);
    } catch (error) {
      console.error('Failed to delete logo:', error);
      throw error;
    }
  };

  const updateSettings = async (companyId, settings) => {
    try {
      const response = await apiClient.post(`/companies/${companyId}/settings`, settings);
      return response.data;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  const selectBranch = async (branchId) => {
    try {
      // Call backend to update JWT token with branch_id
      const response = await apiClient.post('/auth/select-branch', { branch_id: branchId });
      
      // Update the access token in storage
      if (response.data.data?.access_token) {
        localStorage.setItem('access_token', response.data.data.access_token);
        // Update apiClient default headers
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.access_token}`;
      }
      
      // Update local state
      setSelectedBranch(branchId);
      if (branchId) {
        localStorage.setItem('selected_branch_id', branchId.toString());
      } else {
        localStorage.removeItem('selected_branch_id');
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to select branch:', error);
      throw error;
    }
  };

  const refreshBranches = () => {
    fetchBranches();
  };

  const value = {
    company,
    branches,
    selectedBranch,
    loading,
    setCompany,
    updateCompany,
    uploadLogo,
    deleteLogo,
    updateSettings,
    selectBranch,
    refreshBranches,
    getSelectedBranch: () => branches.find(b => b.id === selectedBranch),
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}
