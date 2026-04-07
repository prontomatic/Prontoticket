export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {children}
    </div>
  );
}
