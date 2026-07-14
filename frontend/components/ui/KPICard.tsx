import { motion } from 'framer-motion';

export function KPICard({ title, value, change }: { title: string; value: string; change?: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-xl shadow-sm border border-stone-200"
    >
      <h4 className="text-sm font-medium text-stone-500">{title}</h4>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-stone-900">{value}</span>
        {change && <span className="text-sm font-medium text-emerald-600">{change}</span>}
      </div>
    </motion.div>
  );
}
