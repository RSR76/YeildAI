import { Card } from '@/components/ui/Card';

export function Loading() {
  return <div className="p-4 text-stone-600">Loading...</div>;
}

export function ErrorView({ message }: { message: string }) {
  return <div className="p-4 text-red-600 bg-red-50 rounded-lg">Error: {message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">{message}</div>;
}
