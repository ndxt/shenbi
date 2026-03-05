import React from 'react';
import { 
  FileText, 
  Search, 
  Database, 
  BugPlay, 
  Package, 
  Settings 
} from 'lucide-react';

const ActivityItem = ({ icon: Icon, active = false }: { icon: any, active?: boolean }) => (
  <div className={`
    w-full h-12 flex items-center justify-center cursor-pointer relative group
    ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
  `}>
    {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500" />}
    <Icon size={24} strokeWidth={1.5} />
  </div>
);

export function ActivityBar() {
  return (
    <div className="w-12 h-full bg-bg-activity-bar border-r border-border-ide flex flex-col justify-between items-center py-2 shrink-0">
      <div className="w-full flex flex-col items-center">
        <ActivityItem icon={FileText} active />
        <ActivityItem icon={Search} />
        <ActivityItem icon={Database} />
        <ActivityItem icon={BugPlay} />
        <ActivityItem icon={Package} />
      </div>
      <div className="w-full flex flex-col items-center">
        <ActivityItem icon={Settings} />
      </div>
    </div>
  );
}
