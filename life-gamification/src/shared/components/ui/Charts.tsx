import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { format, subDays, startOfDay, isAfter, isBefore, parseISO } from 'date-fns';
import type { Task, User } from '../../types';

interface XPProgressChartProps {
  tasks: Task[];
  user: User | null;
  days?: number;
}

export const XPProgressChart: React.FC<XPProgressChartProps> = ({ 
  tasks, 
  user, 
  days = 7 
}) => {
  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = subDays(today, days - 1);
    
    // Create array of dates
    const dateRange = Array.from({ length: days }, (_, i) => {
      const date = subDays(today, days - 1 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // Calculate XP gained per day
    const xpByDay = dateRange.map(dateStr => {
      const dayTasks = tasks.filter(task => {
        if (!task.completed_at) return false;
        const taskDate = format(parseISO(task.completed_at), 'yyyy-MM-dd');
        return taskDate === dateStr;
      });

      const xpGained = dayTasks.reduce((sum, task) => sum + task.base_experience_reward, 0);
      
      return {
        date: dateStr,
        dateFormatted: format(parseISO(dateStr), 'MMM dd'),
        xp: xpGained,
        tasksCompleted: dayTasks.length,
      };
    });

    return xpByDay;
  }, [tasks, days]);

  const totalXPGained = chartData.reduce((sum, day) => sum + day.xp, 0);

  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">XP Progress (Last {days} Days)</h3>
        <div className="text-sm text-gray-400">
          Total XP: <span className="text-theme-accent font-medium">{totalXPGained}</span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="dateFormatted" 
            stroke="#9CA3AF"
            fontSize={12}
          />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value: number, name: string) => [
              <span style={{ color: '#10B981' }}>{value} XP</span>,
              'XP Gained'
            ]}
          />
          <Line
            type="monotone"
            dataKey="xp"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface TaskCategoryChartProps {
  tasks: Task[];
}

export const TaskCategoryChart: React.FC<TaskCategoryChartProps> = ({ tasks }) => {
  const chartData = useMemo(() => {
    const categoryStats = tasks.reduce((acc, task) => {
      if (task.status !== 'completed') return acc;
      
      if (!acc[task.category]) {
        acc[task.category] = {
          category: task.category,
          count: 0,
          xp: 0,
        };
      }
      
      acc[task.category].count += 1;
      acc[task.category].xp += task.base_experience_reward;
      
      return acc;
    }, {} as Record<string, { category: string; count: number; xp: number }>);

    return Object.values(categoryStats);
  }, [tasks]);

  const colors = [
    '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
      <h3 className="text-lg font-semibold mb-4">Tasks by Category</h3>
      
      {chartData.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Complete some tasks to see category breakdown</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="category" 
              stroke="#9CA3AF"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#F3F4F6' }}
              formatter={(value: number, name: string, props: any) => [
                <span style={{ color: colors[props.payload.index % colors.length] }}>
                  {value} {name === 'count' ? 'tasks' : 'XP'}
                </span>,
                name === 'count' ? 'Tasks Completed' : 'XP Earned'
              ]}
            />
            <Bar dataKey="count" name="count">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

interface DifficultyDistributionChartProps {
  tasks: Task[];
}

export const DifficultyDistributionChart: React.FC<DifficultyDistributionChartProps> = ({ tasks }) => {
  const chartData = useMemo(() => {
    const difficultyStats = tasks.reduce((acc, task) => {
      if (task.status !== 'completed') return acc;
      
      const difficulty = `Level ${task.difficulty}`;
      if (!acc[difficulty]) {
        acc[difficulty] = 0;
      }
      acc[difficulty] += 1;
      
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(difficultyStats).map(([difficulty, count]) => ({
      difficulty,
      count,
    }));
  }, [tasks]);

  const colors = [
    '#6B7280', '#10B981', '#22C55E', '#FDE047', '#FBBF24',
    '#FB923C', '#F97316', '#EF4444', '#DC2626', '#8B5CF6'
  ];

  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
      <h3 className="text-lg font-semibold mb-4">Difficulty Distribution</h3>
      
      {chartData.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Complete some tasks to see difficulty distribution</p>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="difficulty"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ difficulty, percent }) => 
                  `${difficulty} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [
                  <span style={{ color: '#F3F4F6' }}>{value} tasks</span>,
                  'Completed'
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

interface ActivityHeatmapProps {
  tasks: Task[];
  days?: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ 
  tasks, 
  days = 30 
}) => {
  const heatmapData = useMemo(() => {
    const today = new Date();
    const startDate = subDays(today, days - 1);
    
    // Create grid of days
    const weeks: Array<Array<{ date: Date; activity: number; dateStr: string }>> = [];
    let currentWeek: Array<{ date: Date; activity: number; dateStr: string }> = [];
    
    for (let i = 0; i < days; i++) {
      const date = subDays(today, days - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Count tasks completed on this date
      const dayTasks = tasks.filter(task => {
        if (!task.completed_at) return false;
        const taskDate = format(parseISO(task.completed_at), 'yyyy-MM-dd');
        return taskDate === dateStr;
      });
      
      currentWeek.push({
        date,
        activity: dayTasks.length,
        dateStr,
      });
      
      // Start new week on Sunday (day 0)
      if (date.getDay() === 6 || i === days - 1) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }
    
    return weeks;
  }, [tasks, days]);

  const getActivityColor = (activity: number) => {
    if (activity === 0) return '#1F2937';
    if (activity === 1) return '#065F46';
    if (activity === 2) return '#047857';
    if (activity >= 3) return '#10B981';
    return '#1F2937';
  };

  const maxActivity = Math.max(...heatmapData.flat().map(d => d.activity));

  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Activity Heatmap</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Less</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(level => (
              <div
                key={level}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getActivityColor(level) }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {heatmapData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex gap-1">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className="w-4 h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-theme-accent/50 transition-all"
                  style={{ backgroundColor: getActivityColor(day.activity) }}
                  title={`${format(day.date, 'MMM dd, yyyy')}: ${day.activity} tasks completed`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-400">
        {days} days • Max activity: {maxActivity} tasks in a day
      </div>
    </div>
  );
};