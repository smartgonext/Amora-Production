import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFolder, FiFolderPlus, FiPlus, FiX, FiCheck, FiArrowRight, FiUser, FiActivity, FiTag, FiTrendingUp, FiCheckSquare, FiCalendar, FiMessageSquare, FiPaperclip } from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState(null);
  const [isAddProjOpen, setIsAddProjOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [projectTab, setProjectTab] = useState('kanban'); // kanban, gantt, calendar, comments

  // Form States - Project
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projPriority, setProjPriority] = useState('Medium');
  const [projBudget, setProjBudget] = useState(50000);

  // Form States - Task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskStatus, setTaskStatus] = useState('Todo');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [commentsList, setCommentsList] = useState([
    { id: 1, author: 'Admin User', text: 'Kicked off the sprint. Let’s focus on priority items.', date: 'Today, 10:15 AM' },
    { id: 2, author: 'Ramesh K.', text: 'I am taking up the Rack A restocking task.', date: 'Today, 11:30 AM' }
  ]);

  // Fetch Projects
  const { data: projectsResponse, isLoading: isLoadingProjs } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await apiClient.get('/projects/');
      return response.data;
    }
  });
  const projects = projectsResponse?.data || [];

  // Fetch Tasks
  const { data: tasksResponse, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return null;
      const response = await apiClient.get(`/projects/${selectedProject.id}/tasks`);
      return response.data;
    },
    enabled: !!selectedProject?.id
  });
  const tasks = tasksResponse?.data || [];

  // Create Project Mutation
  const createProjMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/projects/', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Project created successfully!');
      setIsAddProjOpen(false);
      resetProjectForm();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create project');
    }
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post(`/projects/${selectedProject.id}/tasks`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Task scheduled successfully!');
      setIsAddTaskOpen(false);
      resetTaskForm();
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProject.id] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create task');
    }
  });

  // Update Task Status Mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }) => {
      const response = await apiClient.put(`/projects/tasks/${taskId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProject.id] });
    },
    onError: (err) => {
      toast.error('Failed to shift task status.');
    }
  });

  const resetProjectForm = () => {
    setProjName('');
    setProjDesc('');
    setProjPriority('Medium');
    setProjBudget(50000);
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('Medium');
    setTaskStatus('Todo');
  };

  const handleProjSubmit = (e) => {
    e.preventDefault();
    createProjMutation.mutate({
      name: projName,
      description: projDesc,
      priority: projPriority,
      budget: parseFloat(projBudget)
    });
  };

  const handleTaskSubmit = (e) => {
    e.preventDefault();
    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      status: taskStatus
    });
  };

  const handleMoveTask = (taskId, currentStatus) => {
    const statusWorkflow = {
      'Todo': 'InProgress',
      'InProgress': 'Review',
      'Review': 'Done',
      'Done': 'Todo'
    };
    updateTaskMutation.mutate({
      taskId,
      payload: { status: statusWorkflow[currentStatus] }
    });
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentsList([
      ...commentsList,
      { id: Date.now(), author: 'Admin User', text: newComment, date: 'Just now' }
    ]);
    setNewComment('');
    toast.success('Comment posted!');
  };

  const getPriorityBadge = (prio) => {
    const colors = {
      'Critical': 'bg-rose-50 text-rose-600',
      'High': 'bg-orange-50 text-orange-600',
      'Medium': 'bg-indigo-50 text-indigo-600',
      'Low': 'bg-slate-50 text-slate-600'
    };
    return `px-2 py-0.5 rounded text-[10px] font-bold ${colors[prio] || 'bg-slate-50'}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              {selectedProject && (
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-350 px-3 py-1 rounded-lg border border-slate-700 mb-1 mr-2 transition-all"
                >
                  ← Back to Projects
                </button>
              )}
              <h1 className="text-3xl font-extrabold text-white tracking-tight animate-fade-in">
                {selectedProject ? `${selectedProject.name}` : 'Collaboration & Projects'}
              </h1>
            </div>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              {selectedProject
                ? `${selectedProject.description || 'Sprint tasks and milestones.'}`
                : 'Create team projects, configure budgets, assign milestones, and manage drag-and-drop Kanban workflow boards.'}
            </p>
          </div>
          <div className="flex gap-2">
            {!selectedProject ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAddProjOpen(true)}
                className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
              >
                <FiFolderPlus />
                <span>Create Project</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAddTaskOpen(true)}
                className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
              >
                <FiPlus />
                <span>New Task</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {selectedProject && (
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
          {[
            { id: 'kanban', label: 'Kanban Board', icon: FiCheckSquare },
            { id: 'gantt', label: 'Gantt Timeline', icon: FiTrendingUp },
            { id: 'calendar', label: 'Shared Calendar', icon: FiCalendar },
            { id: 'comments', label: 'Discussion & Files', icon: FiMessageSquare }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setProjectTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                projectTab === tab.id
                  ? 'bg-indigo-650 text-white shadow-md'
                  : 'text-slate-650 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      {!selectedProject ? (
        // PROJECTS LIST
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <motion.div
              key={proj.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedProject(proj)}
              className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className={getPriorityBadge(proj.priority)}>{proj.priority} Priority</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{proj.status}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{proj.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{proj.description}</p>
              </div>
              <div className="border-t border-slate-50 dark:border-slate-800/80 pt-4 flex justify-between items-center text-xs">
                <span className="text-slate-400">Budget: <strong className="text-slate-700 dark:text-slate-200">{formatINR(proj.budget)}</strong></span>
                <span className="text-indigo-600 font-semibold flex items-center gap-1">Open Board <FiArrowRight /></span>
              </div>
            </motion.div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400">No active projects. Create one to get started.</div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          {projectTab === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {['Todo', 'InProgress', 'Review', 'Done'].map((col) => {
                const colTasks = tasks.filter(t => t.status === col);
                return (
                  <div key={col} className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/20 p-4 space-y-3 min-h-[450px]">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-655 uppercase tracking-wider">{col}</h4>
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">{colTasks.length}</span>
                    </div>
                    <div className="space-y-3">
                      {colTasks.map((task) => (
                        <div key={task.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                          <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white">{task.title}</h5>
                          <p className="text-[11px] text-slate-500">{task.description}</p>
                          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center text-xs">
                            <span className="text-[10px] text-slate-400"><FiUser className="inline mr-1" /> Team</span>
                            <button onClick={() => handleMoveTask(task.id, task.status)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-indigo-650"><FiArrowRight /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {projectTab === 'gantt' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Project Gantt Timeline</h3>
              <div className="space-y-4">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-4 text-xs">
                    <span className="w-32 font-semibold text-slate-900 dark:text-white truncate">{t.title}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-6 rounded-lg overflow-hidden relative">
                      <div className="absolute left-1/4 w-1/2 bg-indigo-600 h-full flex items-center justify-center text-[10px] text-white font-bold rounded-lg shadow">
                        {t.status === 'Done' ? '100% Completed' : 'In Progress'}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && <div className="text-center py-10 text-slate-400">No timeline schedules mapped.</div>}
              </div>
            </div>
          )}

          {projectTab === 'calendar' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white uppercase">Shared Calendar Board</h3>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-450 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>
              <div className="grid grid-cols-7 gap-2 h-72">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className="border border-slate-100 dark:border-slate-800 rounded p-1 text-[10px] text-left relative bg-slate-50 dark:bg-slate-850/40">
                    <span className="text-slate-400">{i + 1}</span>
                    {i === 12 && <div className="mt-1 bg-indigo-100 text-indigo-700 px-1 rounded truncate font-semibold">Verify stock count</div>}
                    {i === 20 && <div className="mt-1 bg-emerald-100 text-emerald-700 px-1 rounded truncate font-semibold">Monthly review</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projectTab === 'comments' && (
            <div className="space-y-6">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5"><FiPaperclip /> Task Attachments</h4>
                <div className="flex items-center gap-3">
                  <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center gap-2 bg-slate-50 dark:bg-slate-850/50">
                    <FiPaperclip className="text-slate-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">restock_sheet_v3.xlsx</div>
                      <div className="text-[10px] text-slate-400">1.2 MB | Excel sheet</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5"><FiMessageSquare /> Task comments & discussion</h4>
                <div className="space-y-3">
                  {commentsList.map(c => (
                    <div key={c.id} className="border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1 bg-slate-50/50 dark:bg-slate-850/10">
                      <div className="flex justify-between items-center text-xs text-slate-450">
                        <strong className="text-slate-800 dark:text-white font-semibold">{c.author}</strong>
                        <span>{c.date}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-350">{c.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ask a question or provide progress updates..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none"
                  />
                  <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-755 text-white font-semibold text-xs rounded-lg shadow-sm">Send</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {isAddProjOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setIsAddProjOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Create New Project</h3>
                <button onClick={() => setIsAddProjOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <form onSubmit={handleProjSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Project Name *</label>
                  <input type="text" required value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. Q3 Spare Parts Restock" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddProjOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createProjMutation.isPending} className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">Save Project</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
