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
    ${active ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}
  `}>
    {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-100" />}
    <Icon size={24} strokeWidth={1.5} />
  </div>
);

export function ActivityBar() {
  return (
    <div className="w-12 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between items-center py-2 shrink-0">
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
