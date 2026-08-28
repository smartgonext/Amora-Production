import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiUserPlus, FiCalendar, FiDollarSign, FiPlus, FiX, FiCheck, FiSearch, FiClock, FiActivity, FiBriefcase, FiAward, FiUmbrella, FiPercent } from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function HrPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAttendOpen, setIsAttendOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLoanOpen, setIsLoanOpen] = useState(false);

  // Form State - Employee
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empDesg, setEmpDesg] = useState('');
  const [empSalary, setEmpSalary] = useState(25000);
  const [empBank, setEmpBank] = useState('');
  const [empAccount, setEmpAccount] = useState('');
  const [empIfsc, setEmpIfsc] = useState('');

  // Form State - Attendance
  const [attendEmpId, setAttendEmpId] = useState('');
  const [attendStatus, setAttendStatus] = useState('Present');
  const [attendNotes, setAttendNotes] = useState('Daily log');

  // Form State - Attendance Matrix & Bulk Actions
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedDept, setSelectedDept] = useState('');
  const [bulkDate, setBulkDate] = useState(today.toISOString().split('T')[0]);
  const [attendanceViewMode, setAttendanceViewMode] = useState('grid');

  // Form State - Leave
  const [leaveEmpId, setLeaveEmpId] = useState('');
  const [leaveType, setLeaveType] = useState('Casual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Form State - Loan
  const [loanEmpId, setLoanEmpId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTenure, setLoanTenure] = useState(12);

  // Fetch Employees
  const { data: employeesResponse, isLoading: isLoadingEmp } = useQuery({
    queryKey: ['employees', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/hr/employees', {
        params: { search: searchTerm }
      });
      return response.data;
    }
  });
  const employees = employeesResponse?.data || [];

  // Fetch Monthly Attendance Matrix
  const { data: monthlyAttResponse, isLoading: isLoadingMonthlyAtt } = useQuery({
    queryKey: ['monthly-attendance', selectedYear, selectedMonth, selectedDept],
    queryFn: async () => {
      const response = await apiClient.get('/hr/attendance/monthly', {
        params: { year: selectedYear, month: selectedMonth, department: selectedDept || undefined }
      });
      return response.data;
    }
  });
  const monthlyData = monthlyAttResponse?.data;

  // Fetch Attendance logs
  const { data: attendanceResponse, isLoading: isLoadingAttend } = useQuery({
    queryKey: ['attendance-logs'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/attendance');
      return response.data;
    }
  });
  const attendanceLogs = attendanceResponse?.data || [];

  // Fetch Payroll Runs
  const { data: payrollResponse, isLoading: isLoadingPayroll } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/payroll');
      return response.data;
    }
  });
  const payrollRuns = payrollResponse?.data || [];

  // Mutations
  const createEmpMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/hr/employees', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Employee onboarded successfully!');
      setIsAddOpen(false);
      resetEmployeeForm();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to onboard employee');
    }
  });

  const logAttendMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/hr/attendance', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Attendance status logged!');
      setIsAttendOpen(false);
      resetAttendanceForm();
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to log attendance');
    }
  });

  const bulkMarkDateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/hr/attendance/bulk', payload);
      return response.data;
    },
    onSuccess: (res) => {
      toast.success(`Marked all employees Present for ${res.data?.date || bulkDate}`);
      queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to bulk mark attendance');
    }
  });

  const bulkMarkMonthMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/hr/attendance/bulk-month', payload);
      return response.data;
    },
    onSuccess: (res) => {
      toast.success(`Marked month ${res.data?.month} Present for all employees!`);
      queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to bulk mark month attendance');
    }
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ employee_id, attendance_date, status }) => {
      const response = await apiClient.put('/hr/attendance/cell', {
        employee_id,
        attendance_date,
        status
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to update cell status');
    }
  });

  const runPayrollMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/hr/payroll', { run_name: `Payroll ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}` });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Payroll cycles calculated and processed!');
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to run payroll');
    }
  });

  const statusCycle = ['Not-Set', 'Present', 'Absent', 'Half-Day', 'Leave', 'Weekly-Off'];

  const handleCellClick = (empId, dateStr, currentStatus) => {
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    updateCellMutation.mutate({
      employee_id: empId,
      attendance_date: dateStr,
      status: nextStatus
    });
  };

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-500 text-white font-bold hover:bg-emerald-600';
      case 'Absent':
        return 'bg-rose-500 text-white font-bold hover:bg-rose-600';
      case 'Half-Day':
        return 'bg-amber-500 text-white font-bold hover:bg-amber-600';
      case 'Leave':
        return 'bg-sky-500 text-white font-bold hover:bg-sky-600';
      case 'Weekly-Off':
        return 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold';
      case 'Holiday':
        return 'bg-purple-500 text-white font-bold';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400';
    }
  };

  const getStatusShort = (status) => {
    switch (status) {
      case 'Present': return 'P';
      case 'Absent': return 'A';
      case 'Half-Day': return 'HD';
      case 'Leave': return 'L';
      case 'Weekly-Off': return 'WO';
      case 'Holiday': return 'H';
      default: return '-';
    }
  };

  const resetEmployeeForm = () => {
    setEmpName('');
    setEmpPhone('');
    setEmpEmail('');
    setEmpDept('');
    setEmpDesg('');
    setEmpSalary(25000);
    setEmpBank('');
    setEmpAccount('');
    setEmpIfsc('');
  };

  const resetAttendanceForm = () => {
    setAttendEmpId('');
    setAttendStatus('Present');
    setAttendNotes('Daily log');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950 to-purple-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(244,63,94,0.2),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">HR & Payroll Suite</h1>
            <p className="text-slate-350 mt-2 text-sm max-w-xl">
              Track corporate employee files, daily check-ins, leaves, loans, shifts, and monthly salary disbursements.
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddOpen(true)}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg text-sm"
            >
              <FiUserPlus />
              <span>Add Employee</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAttendOpen(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-750 text-sm"
            >
              <FiClock />
              <span>Clock Attendance</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-x-auto">
        <div className="flex items-center space-x-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {[
            { id: 'employees', label: 'Employees', icon: FiUsers },
            { id: 'attendance', label: 'Attendance', icon: FiActivity },
            { id: 'payroll', label: 'Payroll', icon: FiDollarSign },
            { id: 'leaves', label: 'Leaves & Requests', icon: FiUmbrella },
            { id: 'shifts', label: 'Shifts & Calendar', icon: FiCalendar },
            { id: 'loans', label: 'Loans & Advances', icon: FiPercent },
            { id: 'performance', label: 'Performance', icon: FiAward }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 border whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
        {activeTab === 'employees' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Active Employee Master</h3>
              <input
                type="text"
                placeholder="Filter by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-850"
              />
            </div>
            {isLoadingEmp ? (
              <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" /></div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Salary Basis</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                      <td className="py-3 px-4 font-mono text-rose-500">{emp.employee_code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{emp.name}</td>
                      <td className="py-3 px-4">{emp.designation || 'Staff'} ({emp.department || 'General'})</td>
                      <td className="py-3 px-4 font-bold">{formatINR(emp.basic_salary)}</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-55/10 text-emerald-600 rounded text-xs">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Top Toolbar and Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                {/* View Mode Switcher */}
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAttendanceViewMode('grid')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${attendanceViewMode === 'grid' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-rose-500'}`}
                  >
                    Monthly Matrix Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceViewMode('logs')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${attendanceViewMode === 'logs' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-rose-500'}`}
                  >
                    Daily Log List
                  </button>
                </div>

                {/* Month Picker */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-semibold"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>

                {/* Year Picker */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-semibold"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Department Filter */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-semibold"
                >
                  <option value="">All Departments</option>
                  {Array.from(new Set(employees.map(e => e.department).filter(Boolean))).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons: Bulk Mark Present */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => bulkMarkDateMutation.mutate({ date: bulkDate, status: 'Present' })}
                    disabled={bulkMarkDateMutation.isPending}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <FiCheck />
                    <span>Mark All Present (Selected Date)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => bulkMarkMonthMutation.mutate({ year: selectedYear, month: selectedMonth, status: 'Present' })}
                  disabled={bulkMarkMonthMutation.isPending}
                  className="px-3 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5"
                >
                  <FiCheck />
                  <span>Mark All Present (Full Month)</span>
                </button>
              </div>
            </div>

            {/* Legend bar */}
            <div className="flex flex-wrap items-center justify-between text-xs px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Legend:</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500 text-white font-bold text-[10px]">P</span> Present</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-rose-500 text-white font-bold text-[10px]">A</span> Absent</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-amber-500 text-white font-bold text-[10px]">HD</span> Half Day</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-sky-500 text-white font-bold text-[10px]">L</span> Leave</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">WO</span> Weekly Off</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 text-[10px]">-</span> Not Set</span>
              </div>
              <span className="text-slate-400 italic text-[11px]">💡 Click any cell to cycle status (P → A → HD → L → WO)</span>
            </div>

            {/* Attendance Grid View */}
            {attendanceViewMode === 'grid' && (
              <div className="relative overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-h-[600px] overflow-y-auto">
                {isLoadingMonthlyAtt ? (
                  <div className="py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" /></div>
                ) : !monthlyData?.employees?.length ? (
                  <div className="py-12 text-center text-slate-400 text-sm">No employees found for the selected department.</div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-900 text-white shadow-md">
                      <tr>
                        <th className="py-3 px-3 sticky left-0 z-30 bg-slate-900 font-bold border-r border-slate-700 min-w-[180px]">
                          Employee
                        </th>
                        {monthlyData?.days?.map((d) => (
                          <th
                            key={d.day}
                            className={`py-2 px-1 text-center font-bold border-r border-slate-800 min-w-[32px] ${d.is_weekend ? 'bg-slate-800 text-rose-300' : ''}`}
                          >
                            <div>{d.day}</div>
                            <div className="text-[9px] uppercase font-normal opacity-75">{d.weekday}</div>
                          </th>
                        ))}
                        <th className="py-3 px-2 text-center font-bold bg-emerald-900/60 text-emerald-200 border-l border-slate-700">P</th>
                        <th className="py-3 px-2 text-center font-bold bg-rose-900/60 text-rose-200 border-l border-slate-700">A</th>
                        <th className="py-3 px-2 text-center font-bold bg-amber-900/60 text-amber-200 border-l border-slate-700">HD</th>
                        <th className="py-3 px-2 text-center font-bold bg-sky-900/60 text-sky-200 border-l border-slate-700">L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      {monthlyData?.employees?.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 sticky left-0 z-10 bg-white dark:bg-slate-900 font-semibold border-r border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="text-slate-900 dark:text-white font-bold text-xs truncate max-w-[170px]">{emp.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{emp.employee_code} • {emp.department || 'Staff'}</div>
                          </td>

                          {monthlyData?.days?.map((d) => {
                            const status = emp.attendance[String(d.day)] || 'Not-Set';
                            return (
                              <td
                                key={d.day}
                                onClick={() => handleCellClick(emp.id, d.date, status)}
                                title={`${emp.name} - ${d.date}: ${status} (Click to toggle)`}
                                className={`py-2 px-1 text-center border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-all ${d.is_weekend ? 'bg-slate-50/50 dark:bg-slate-850/50' : ''}`}
                              >
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] cursor-pointer shadow-2xs ${getBadgeStyle(status)}`}>
                                  {getStatusShort(status)}
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-2 text-center font-extrabold text-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 border-l border-slate-200 dark:border-slate-800">{emp.summary?.Present || 0}</td>
                          <td className="py-2.5 px-2 text-center font-extrabold text-rose-600 bg-rose-50/30 dark:bg-rose-950/20 border-l border-slate-200 dark:border-slate-800">{emp.summary?.Absent || 0}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-amber-600 bg-amber-50/30 dark:bg-amber-950/20 border-l border-slate-200 dark:border-slate-800">{emp.summary?.['Half-Day'] || 0}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-sky-600 bg-sky-50/30 dark:bg-sky-950/20 border-l border-slate-200 dark:border-slate-800">{emp.summary?.Leave || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Daily Log List View */}
            {attendanceViewMode === 'logs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daily Log Records</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {attendanceLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="py-3 px-4 text-slate-550">{new Date(log.attendance_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-semibold">Employee #{log.employee_id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.status === 'Present' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic">{log.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Monthly Wages & Disbursements</h3>
              <button onClick={() => runPayrollMutation.mutate()} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold">Run Payroll Cycle</button>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4">Total Gross</th>
                  <th className="py-3 px-4">Net Payout</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {payrollRuns.map(run => (
                  <tr key={run.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{run.run_name}</td>
                    <td className="py-3 px-4 font-medium">{formatINR(run.total_gross)}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">{formatINR(run.total_net)}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs">Processed</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Leave Requests & Allocations</h3>
                <p className="text-xs text-slate-450 mt-1">Review leave allocations, approved timesheets, and sick/annual requests.</p>
              </div>
              <button onClick={() => setIsLeaveOpen(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1"><FiPlus /> Apply Leave</button>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Ramesh Kumar</td>
                  <td className="py-3 px-4 font-medium">Sick Leave</td>
                  <td className="py-3 px-4 text-slate-450">Oct 12 - Oct 14</td>
                  <td className="py-3 px-4 text-slate-400 italic">Medical checkup</td>
                  <td className="py-3 px-4 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">Approved</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'shifts' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Shift Configuration & Holidays</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Active Shifts</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">Day Shift (General)</div>
                      <div className="text-slate-400 mt-0.5">09:00 AM - 06:00 PM</div>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold">Standard</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">Night Shift (Security)</div>
                      <div className="text-slate-400 mt-0.5">09:00 PM - 06:00 AM</div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded font-bold">Differential</span>
                  </div>
                </div>
              </div>
              <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Upcoming Holidays</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-900 dark:text-white">Diwali Holiday</span>
                    <span className="text-slate-450">Oct 31, 2026</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold text-slate-900 dark:text-white">New Year Eve</span>
                    <span className="text-slate-450">Dec 31, 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Employee Loans & Advance Tracking</h3>
                <p className="text-xs text-slate-450 mt-1">Manage outstanding salary advance balances and automatic EMI deductions.</p>
              </div>
              <button onClick={() => setIsLoanOpen(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1"><FiPlus /> Issue Advance</button>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Advance Amount</th>
                  <th className="py-3 px-4">Term</th>
                  <th className="py-3 px-4">EMI Deduction</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Vikas Sharma</td>
                  <td className="py-3 px-4 font-medium">{formatINR(50000)}</td>
                  <td className="py-3 px-4">10 Months</td>
                  <td className="py-3 px-4">{formatINR(5000)}/mo</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">{formatINR(35000)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Annual Performance Appraisals</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Review Cycle</th>
                  <th className="py-3 px-4">Rating / Score</th>
                  <th className="py-3 px-4">Key Remarks</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Pooja Patel</td>
                  <td className="py-3 px-4">Mid-Year 2026</td>
                  <td className="py-3 px-4"><span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold">4.8 / 5.0 (Excellent)</span></td>
                  <td className="py-3 px-4 text-slate-450">Demonstrates high operational efficiency in rentals tracking.</td>
                  <td className="py-3 px-4 text-right"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">Finalized</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD EMPLOYEE MODAL */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsAddOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Register New Employee</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                createEmpMutation.mutate({ name: empName, phone: empPhone, email: empEmail, department: empDept, designation: empDesg, basic_salary: parseFloat(empSalary), bank_name: empBank, bank_account_no: empAccount, bank_ifsc: empIfsc });
              }} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Full Name *</label>
                    <input type="text" required value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
                    <input type="text" value={empDept} onChange={(e) => setEmpDept(e.target.value)} placeholder="e.g. Operations, Sales" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Designation</label>
                    <input type="text" value={empDesg} onChange={(e) => setEmpDesg(e.target.value)} placeholder="e.g. Technician, Cashier" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Monthly Basic Salary (₹) *</label>
                    <input type="number" required value={empSalary} onChange={(e) => setEmpSalary(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createEmpMutation.isPending} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-sm shadow-md">{createEmpMutation.isPending ? 'Saving...' : 'Onboard Employee'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLOCK ATTENDANCE MODAL */}
      <AnimatePresence>
        {isAttendOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsAttendOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Clock Daily Attendance</h3>
                <button onClick={() => setIsAttendOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                logAttendMutation.mutate({ employee_id: parseInt(attendEmpId), status: attendStatus, notes: attendNotes });
              }} className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Select Employee *</label>
                  <select required value={attendEmpId} onChange={(e) => setAttendEmpId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm">
                    <option value="">-- Select --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <select value={attendStatus} onChange={(e) => setAttendStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm">
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAttendOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={logAttendMutation.isPending} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-sm shadow-md">Save Log</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APPLY LEAVE MODAL */}
      <AnimatePresence>
        {isLeaveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsLeaveOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Apply for Leave</h3>
                <button onClick={() => setIsLeaveOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                toast.success('Leave request submitted for approval!');
                setIsLeaveOpen(false);
              }} className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Employee *</label>
                  <select required value={leaveEmpId} onChange={(e) => setLeaveEmpId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm">
                    <option value="">-- Select --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Leave Type</label>
                  <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm">
                    <option value="Casual">Casual Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Earned">Earned Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
                    <input type="date" required value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
                    <input type="date" required value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsLeaveOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">Submit Request</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ISSUE ADVANCE MODAL */}
      <AnimatePresence>
        {isLoanOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsLoanOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Issue Loan / Advance</h3>
                <button onClick={() => setIsLoanOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                toast.success('Advance payout transaction disbursed!');
                setIsLoanOpen(false);
              }} className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Employee *</label>
                  <select required value={loanEmpId} onChange={(e) => setLoanEmpId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm">
                    <option value="">-- Select --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Advance Amount (₹) *</label>
                  <input type="number" required value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Tenure (Months)</label>
                  <input type="number" value={loanTenure} onChange={(e) => setLoanTenure(parseInt(e.target.value) || 12)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm" />
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsLoanOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm shadow-md">Approve & Disburse</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
