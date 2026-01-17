export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-slate-400">Page not found</p>
      <a href="/" className="mt-4 text-cyan-400 hover:underline">
        Return to Simulator
      </a>
    </div>
  );
}
