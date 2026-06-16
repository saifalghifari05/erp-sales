/** Pembungkus untuk halaman biasa (bukan board): mengisi tinggi, scroll vertikal, padding konsisten. */
export function PageScroll({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`px-6 lg:px-10 py-8 ${wide ? "w-full max-w-[1600px]" : "w-full max-w-[1100px]"}`}>
        {children}
      </div>
    </div>
  );
}
