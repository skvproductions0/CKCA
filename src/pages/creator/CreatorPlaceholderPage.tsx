import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';

interface Props {
  title: string;
  step: string;
}

export default function CreatorPlaceholderPage({ title, step }: Props) {
  return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
        <Sparkles className="w-8 h-8" />
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-amber-300 border border-slate-700 mb-3">
          <Clock className="w-3.5 h-3.5" /> Scheduled for {step}
        </span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-slate-400 mt-2">
          This Creator module is planned in the implementation sequence for {step}. The foundational Creator role and navigation are now established.
        </p>
      </div>

      <div className="pt-4">
        <Link
          to="/creator/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Creator Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
