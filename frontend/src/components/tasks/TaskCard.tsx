import React, { useState } from 'react';
import { Play, Pause, Square, BarChart3, Trash2, ListTree, AlertCircle, Edit2, Check, X } from 'lucide-react';
import type { Task, TaskHistory } from '../../types';
import { useSound } from '../../hooks/useSound';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onExploreChunks: (task: Task) => void;
  onSaveLog?: (taskId: string, log: TaskHistory) => void;
  onClick?: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onExploreChunks, onClick }) => {
  const { playClick, playDelete, playTimer, playPop, playSuccess } = useSound();

  const [isEditing, setIsEditing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionSatisfaction, setCompletionSatisfaction] = useState(50);
  const [editValue, setEditValue] = useState(task.description);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEdit = () => {
    onUpdate(task.id, { description: editValue });
    setIsEditing(false);
  };

  const priorityStyles = {
    low: 'opacity-80',
    medium: 'bg-highlighter-yellow/5 skew-y-1',
    high: 'border-double border-4 border-ink bg-highlighter-pink/5 -skew-y-1'
  };

  const priorityMarkers = {
    low: <AlertCircle size={24} className="text-ink-light fill-ink-light" />,
    medium: <AlertCircle size={14} className="text-highlighter-yellow fill-highlighter-yellow" />,
    high: <AlertCircle size={14} className="text-highlighter-pink fill-highlighter-pink" />
  };

  const isOverdue = task.status === 'overdue' || (
    task.deadline && 
    new Date(task.deadline).getTime() < Date.now() && 
    task.status !== 'completed' && 
    task.status !== 'archived'
  );

  return (
    <div 
      onClick={() => onClick?.(task)}
      className={`tape-effect sketch-border p-5 bg-white transform transition-all duration-300 hover:rotate-0 hover:scale-105 max-w-sm cursor-pointer ${task.id.length % 2 === 0 ? 'rotate-1' : '-rotate-1'} ${task.status === 'completed' ? 'opacity-50' : ''} ${isOverdue ? 'border-4 border-highlighter-pink/80 bg-red-50' : priorityStyles[task.priority]}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 mr-2 min-w-0">
          {isEditing ? (
             <div className="flex gap-1 items-center">
                <input 
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full font-marker text-xl border-b border-ink focus:outline-none bg-paper-bg/50 px-1"
                />
                <button onClick={() => { playClick(); handleEdit(); }} className="text-green-600"><Check size={20}/></button>
                <button onClick={() => { playClick(); setIsEditing(false); }} className="text-red-600"><X size={20}/></button>
             </div>
          ) : (
            <div className="flex items-start gap-2 group/title cursor-pointer" onClick={() => { playClick(); setIsEditing(true); }}>
              <div className="shrink-0 mt-1">
                {priorityMarkers[task.priority]}
              </div>
              <h3 
                className="marker-text text-xl leading-tight wrap-break-word line-clamp-2 border-b-2 border-transparent group-hover/title:border-highlighter-yellow transition-all"
                title={task.description}
              >
                {task.description}
              </h3>
              <Edit2 size={12} className="opacity-0 group-hover/title:opacity-30 ml-auto shrink-0 mt-2" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onExploreChunks(task); }}
            className="text-ink hover:text-highlighter-yellow p-1 transition-colors"
            title="Break down chunks"
          >
            <ListTree size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); playDelete(); onDelete(task.id); }}
            className="text-ink-light hover:text-highlighter-pink p-1 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {isOverdue && (
          <div className="mb-2">
            <span className="font-marker text-sm bg-highlighter-pink text-white px-2 py-0.5 shadow-sm transform -rotate-2 inline-block">
              ! OVERDUE
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
           <BarChart3 size={12} className="opacity-40" />
           <span className="font-sketch text-xs uppercase opacity-60">{task.priority}</span>  
        </div>
        
        <div className="flex items-center gap-4 opacity-70 font-sketch text-xs mt-2">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1">
              <span className="underline decoration-highlighter-pink">Due:</span>
              <span className={isOverdue ? "text-highlighter-pink font-bold" : ""}>{new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            {isOverdue && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  playPop();
                  const newDeadline = new Date();
                  newDeadline.setDate(newDeadline.getDate() + 1);
                  onUpdate(task.id, { 
                    deadline: newDeadline.toISOString(),
                    status: 'idle' 
                  });
                }}
                className="text-highlighter-pink underline hover:text-ink transition-colors mt-1"
                title="Reschedule to tomorrow"
              >
                Reschedule (+1 Day)
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span>Est:</span>
            <span className="bg-highlighter-yellow/30 px-1">{task.estimatedTime}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t-2 border-ink/10 border-dashed">
        <div className="flex items-center gap-3">
          {task.status !== 'completed' && (
            <>
              {task.status === 'running' ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); playTimer(); onUpdate(task.id, { status: 'paused' }); }}
                  className="hover:text-highlighter-yellow transition-colors"
                >
                  <Pause size={20} fill="currentColor" />
                </button>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); playTimer(); onUpdate(task.id, { status: 'running' }); }}
                  className="hover:text-highlighter-yellow transition-colors"
                >
                  <Play size={20} fill="currentColor" />
                </button>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  playPop();
                  setIsCompleting(true);
                }}
                className="hover:text-highlighter-pink transition-colors relative z-10"
              >
                <Square size={16} fill="currentColor" />
              </button>
            </>
          )}
        </div>

        {isCompleting && (
          <div 
             className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200"
             onClick={(e) => e.stopPropagation()}
          >
             <h4 className="font-marker text-lg mb-2 text-ink">Rate Satisfaction</h4>
             <div className="w-full px-2 mb-4">
               <div className="flex justify-between text-[10px] font-sketch uppercase opacity-40 mb-1">
                 <span>Meh</span>
                 <span>{completionSatisfaction}%</span>
                 <span>Joy!</span>
               </div>
               <input 
                 type="range" 
                 min="0" 
                 max="100" 
                 step="5"
                 autoFocus
                 value={completionSatisfaction}
                 onChange={(e) => setCompletionSatisfaction(parseInt(e.target.value))}
                 className="w-full accent-highlighter-pink cursor-pointer"
               />
             </div>
             <div className="flex gap-2">
               <button 
                 onClick={() => {
                   playSuccess();
                   onUpdate(task.id, { 
                     status: 'completed',
                     actualSatisfaction: completionSatisfaction 
                   });
                   setIsCompleting(false);
                 }}
                 className="px-3 py-1 bg-highlighter-pink text-ink font-bold text-sm border-2 border-ink hover:scale-105 transition-transform"
               >
                 I'm Done!
               </button>
               <button 
                 onClick={() => { playPop(); setIsCompleting(false); }}
                 className="px-3 py-1 text-ink opacity-50 hover:opacity-100 font-hand text-sm underline"
               >
                 Cancel
               </button>
             </div>
          </div>
        )}


        <div className="text-right">
          <span className="font-sketch text-[10px] uppercase opacity-40 block tracking-widest leading-none">Record</span>
          <div className="font-type text-lg tracking-tight">
            {formatTime(task.totalTimeSeconds || 0)}
          </div>
        </div>
      </div>

      {task.status === 'completed' && (
        <div className="absolute inset-0 bg-white/20 flex items-center justify-center pointer-events-none rotate-3">
          <div className="font-marker text-4xl text-green-700 border-4 border-green-700 px-4 py-1 transform -rotate-12 shadow-md">
            MASTERED
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
