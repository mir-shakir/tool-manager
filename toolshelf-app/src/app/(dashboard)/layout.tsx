export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-100 p-4 dark:bg-gray-800">
        {/* Sidebar content goes here */}
        <h2 className="text-lg font-semibold">ToolShelf</h2>
        <nav className="mt-4">
          <ul>
            <li>Teams</li>
            <li>Master Catalog</li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
